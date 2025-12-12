"""
모델 추론 통합 로직 (최소 수정 및 통합 버전)
YOLO, ConditionalViT (CNN) 모델을 연결하여 7단계 규칙 기반 Pass/Fail 및 제품 모델 분류
"""

import numpy as np
import torch
import time 
from typing import Dict, List, Optional, Tuple 
from PIL import Image, ImageDraw
from collections import Counter
import io
import os
import traceback
import base64
import cv2

# 외부 모듈 임포트 유지
from .yolo_model import YOLOModel 
from .cnn_model import CNNModel

# ============================================================
# 제품 스펙테이블 및 레이블 (V1 원본 코드와 동일)
# ============================================================
PRODUCT_SPEC = {
    "FM2-V160-000": {"button": "ID",   "lang": "CN"},
    "FM2-V161-000": {"button": "Back", "lang": None},
    "FM2-V162-000": {"button": "Back", "lang": "EN"},
    "FM2-V163-000": {"button": "Back", "lang": "CN"},
    "FM2-V164-000": {"button": "Back", "lang": "KR"},
    "FM2-V165-000": {"button": "Back", "lang": "TW"},
    "FM2-V166-000": {"button": "ID",   "lang": "EN"},
    "FM2-V167-000": {"button": "Back", "lang": "JP"},
}

LANG_LABEL = ["CN", "EN", "JP", "KR", "TW"] # V1에선 튜플로 정의되었으나, 리스트로 통일하여 사용
CLASS_NAMES = ['Home', 'Back', 'ID', 'Stat', 'Monitor_Small', 'Monitor_Big', 'sticker', 'Text']
CLASS_MAP = { 0: 'Home', 1: 'Back', 2: 'ID', 3: 'Stat', 4: 'Monitor_Small', 
              5: 'Monitor_Big', 6: 'sticker', 7: 'Text'
}

# 전역 모델 인스턴스
yolo_model = None
cnn_model = None
transform = None # CNNModel 내부에서 관리되므로 여기서는 사용하지 않음
DEVICE = "cpu"

# ============================================================
# 제품 모델 자동 분류 함수 (V1 원본 코드와 동일)
# ============================================================
def classify_model(found_back, found_id, text_langs):
    # (1) 텍스트 언어 결정
    if len(text_langs) == 0:
        lang = None
    else:
        lang = Counter(text_langs).most_common(1)[0][0] 

    # (2) Back/ID 결정
    if found_back and (not found_id):
        btn_type = "Back"  
    elif found_id and (not found_back):
        btn_type = "ID"
    else:
        return None, "Back/ID Mismatch" 

    # (3) 후보 제품 찾기
    candidates = []
    for name, spec in PRODUCT_SPEC.items():
        # V1 원본 코드는 'Back' 버튼이 STAT 모델군으로 분류되는 로직이 없었으므로,
        # 이전에 제공된 코드를 참고하여 'Back' -> 'STAT'으로 강제 변환합니다. (만약 필요하다면)
        # 하지만 V1 원본 코드를 최대한 따르기 위해 'Back'으로 유지합니다.
        
        if spec["lang"] == lang and spec["button"] == btn_type:
            candidates.append(name)

    if len(candidates) == 1:
        return candidates[0], None # 성공
    elif len(candidates) > 1:
        return None, "AmbiguousModel" # 실패
    else:
        return None, "UnknownModel" # 실패

# ============================================================
# NumPy 타입 변환 함수 (V1 원본 코드와 동일)
# ============================================================
def convert_numpy_types(data):
    if isinstance(data, dict):
        return {k: convert_numpy_types(v) for k, v in data.items()}
    if isinstance(data, (list, tuple)):
        return [convert_numpy_types(i) for i in data]
    if isinstance(data, np.integer):
        return int(data)
    if isinstance(data, np.floating):
        return float(data)
    if isinstance(data, np.ndarray):
        return data.tolist()
    return data

# ============================================================
# 모델 초기화 함수 (V1 원본 코드와 동일)
# ============================================================
def initialize_models(
    yolo_path: str = "models/YOLO.pt",
    cnn_path: str = "models/CNN_classifier.pt",
):
    """모델 초기화 (서버 시작 시 호출)"""
    global yolo_model, cnn_model, DEVICE
    
    # YOLO 모델 초기화
    if yolo_model is None:
        try:
            # YOLOModel 클래스는 Device를 자체적으로 결정함
            yolo_model = YOLOModel(model_path=yolo_path) 
            DEVICE = yolo_model.device # YOLO 모델의 디바이스 설정 따름
        except Exception as e:
            print(f"YOLO 모델 로드 실패: {e}")
            
    # CNN/Text 모델 초기화
    if cnn_model is None:
        try:
            cnn_model = CNNModel(model_path=cnn_path)
            print("CNN/Text 모델 로드 완료.")
        except Exception as e:
            print(f"CNN/Text 모델 로드 실패: {e}")
            cnn_model = None
            
    return yolo_model, cnn_model

# ============================================================
# 이미지 분석 메인 함수 (최소 통합 버전)
# ============================================================
def analyze_image(image: np.ndarray) -> Dict:
    """
    이미지 분석 메인 함수: 7단계 복합 검사 파이프라인 수행 및 결과 JSON 반환
    """
    if yolo_model is None or cnn_model is None:
        initialize_models()
        if cnn_model is None:
            raise RuntimeError("CNN/Text 모델이 로드되지 않았습니다.")
    
    try:
        # V1: BGR to RGB 변환 후 PIL 생성 (YOLO 모델이 RGB를 기대한다고 가정)
        if len(image.shape) == 3 and image.shape[2] == 3:
            # OpenCV 이미지는 보통 BGR이므로, PIL을 위해 RGB로 변환
            img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(img_rgb).convert("RGB")
        else:
            pil_img = Image.fromarray(image).convert("RGB") 

        # 시각화용 이미지 (OpenCV는 BGR을 사용하므로, 원본 BGR 이미지를 사용하거나 복사)
        draw_img = image.copy() 
        
        # 1. YOLO 객체 검출
        yolo_results = yolo_model.detect(img_rgb) # YOLO 모델이 RGB를 기대한다고 가정
        
        # --- 2. YOLO 결과 플래그 및 CNN 데이터 수집 ---
        found_home = False
        found_stat = False
        found_monitor = False
        found_back = False
        found_id = False
        cnn_fail = False # Rule C 판정을 위한 플래그
        
        cnn_results = []
        roi_pass_list = [] 
        text_langs = []
        yolo_detections = []
        confidence_scores = []
        cnn_button_status_map = {} 
        button_classes = ['Home', 'Back', 'ID', 'Stat']
        
        start_time_cnn_total = time.time() 

        for detection in yolo_results.get("detections", []):
            cls_name = detection["class"]
            bbox = detection["bbox"]
            conf = detection["confidence"]
            
            x1, y1, x2, y2 = map(int, bbox)
            if x1 >= x2 or y1 >= y2: continue
                
            # PIL 이미지는 RGB 원본에서 Crop (CNNModel에 전달)
            crop_pil = pil_img.crop((x1, y1, x2, y2)) 
            
            # --- 플래그 설정 ---
            base_cls = cls_name.replace('Btn_', '')
            if base_cls == 'Home': found_home = True
            elif base_cls == 'Back': found_back = True
            elif base_cls == 'ID': found_id = True
            elif base_cls == 'Stat': found_stat = True
            elif cls_name in ['Monitor_Small', 'Monitor_Big', 'Monitor']: found_monitor = True

            # --- 3. CNN 수행 (버튼 & 텍스트) ---
            current_status = None
            prob = 0.0
            
            if base_cls in button_classes:
                # CNNModel의 predict_roi는 PIL Image (Grayscale)를 기대한다고 가정
                prob, is_pass = cnn_model.predict_roi(crop_pil.convert("L"), cls_name)
                current_status = "Pass" if is_pass else "Fail"
                
                roi_pass_list.append(is_pass) 
                if not is_pass:
                    cnn_fail = True
                
                # CNN 상태 맵 업데이트
                if base_cls in cnn_button_status_map and cnn_button_status_map[base_cls] == "Fail":
                     pass
                else:
                    cnn_button_status_map[base_cls] = current_status
                
                cnn_results.append({
                    "class": base_cls,
                    "bbox": bbox,
                    "probability": round(prob, 4), 
                    "status": current_status
                })
                confidence_scores.append(prob * 100) # CNN 확률도 신뢰도에 포함

            elif base_cls == 'Text':
                # CNNModel의 predict_roi는 텍스트 감지 결과를 반환하도록 수정되어야 함
                prob, lang = cnn_model.predict_roi(crop_pil.convert("L"), cls_name)
                current_status = lang if isinstance(lang, str) else "Unknown" # Text는 Pass/Fail 대신 언어 코드를 반환
                text_langs.append(current_status)
                confidence_scores.append(prob * 100)
            
            # --- 4. 시각화 데이터 준비 ---
            final_label = f"{base_cls} {current_status or ''}".strip()
            
            # 색상 결정 (V1 원본 로직 유지)
            if current_status == 'Pass': color = (0, 255, 0) # Green
            elif current_status == 'Fail': color = (0, 0, 255) # Red
            else: color = (0, 200, 255) # Default (Cyan/Yellow)

            # BBox 그리기
            cv2.rectangle(draw_img, (x1, y1), (x2, y2), color, 2)
            cv2.putText(draw_img, final_label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2, cv2.LINE_AA)
            cv2.putText(draw_img, final_label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)

            yolo_detections.append({
                "class": base_cls, "bbox": bbox, "confidence": round(conf, 4)
            })
            confidence_scores.append(conf * 100)
            
        time_cnn_total = time.time() - start_time_cnn_total
        print(f"[TIME CHECK] CNN 총 추론 시간: {time_cnn_total:.4f} 초")

        # --- 5. 7가지 규칙 기반 판정 시작 (V1 원본 로직) ---
        prod, model_err = classify_model(found_back, found_id, text_langs)
        
        fails = []
        
        # 1. 필수 요소 확인 (Rule A)
        if not found_home: fails.append("Home Missing")
        if not found_stat: fails.append("Stat Missing")
        if not found_monitor: fails.append("Monitor Missing")

        # 2. Back XOR ID (Rule B)
        if found_back and found_id: fails.append("Back and ID Both Present")
        if (not found_back) and (not found_id): fails.append("Back/ID Missing")

        # 3. CNN (Rule C)
        if cnn_fail: fails.append("Button Fail")

        # 4. Text 조건 (Rule D)
        text_count = len(text_langs)
        if not (text_count == 0 or text_count >= 3): fails.append(f"Text Count Invalid (N={text_count})")

        # 5. 모델 분류 결과 (Rule E)
        if prod is None: fails.append(model_err)
        
        # 6. 최종 판정
        is_pass = (len(fails) == 0)
        final_status = "PASS" if is_pass else "FAIL" 
        reason = "; ".join(fails) if fails else None
        
        # --- 7. 최종 결과 이미지에 요약 정보 추가 (main 루프의 시각화 로직) ---
        
        # 제품명 표시 (V1 main 로직)
        title = prod if prod else "UNKNOWN"
        cv2.putText(draw_img, title, (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 0), 2) # BGR: Cyan/Yellow

        # 최종 상태 표시 (V1 main 로직)
        if is_pass:
            status_color = (0, 255, 0) # Green
            cv2.putText(draw_img, "PASS", (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 1.0, status_color, 3)
        else:
            status_color = (0, 0, 255) # Red
            cv2.putText(draw_img, "FAIL", (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 1.0, status_color, 3)
            
            # 실패 사유 목록 출력
            y = 140
            for r in fails:
                cv2.putText(draw_img, r, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
                y += 30

        # --- 8. Base64 인코딩 및 결과 반환 ---
        
        _, buffer = cv2.imencode('.jpg', draw_img)
        annotated_image_str = base64.b64encode(buffer).decode('utf-8')

        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
        
        # 최종 결과 객체 구성 (프론트엔드 ResultsGrid와 호환되도록)
        final_result = {
            "status": final_status,
            "reason": reason,
            "confidence": round(avg_confidence, 2),
            "details": {
                "product_model": prod,
                "language": Counter(text_langs).most_common(1)[0][0] if text_langs else None,
                "model_status": "Pass" if prod else "Fail",
                "text_count": text_count,
                
                # 이전 V1 코드를 참고하여 세분화된 상태 재구성
                "home_status": cnn_button_status_map.get('Home', 'Fail'),
                "id_back_status": cnn_button_status_map.get('ID', 'Fail') if found_id else cnn_button_status_map.get('Back', 'Fail'),
                "status_status": cnn_button_status_map.get('Stat', 'Fail'),
                "screen_status": "Pass" if found_monitor else "Fail",
                
                "yolo_detections": yolo_detections,
                "cnn_results": cnn_results,
                "annotated_image": annotated_image_str
            }
        }
        
        return convert_numpy_types(final_result)
        
    except Exception as e:
        traceback.print_exc()
        error_result = {
            "status": "FAIL",
            "reason": f"분석 중 오류 발생: {type(e).__name__} - {str(e)}",
            "confidence": 0,
            "details": {}
        }
        return convert_numpy_types(error_result)


def analyze_frame(image: np.ndarray) -> Dict:
    """
    실시간 프레임 분석 (analyze_image와 동일)
    """
    return analyze_image(image)
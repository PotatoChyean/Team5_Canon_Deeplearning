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
import cv2 # OpenCV 임포트 유지

# 외부 모듈 임포트 유지
from .yolo_model import YOLOModel 
from .cnn_model import CNNModel

# ============================================================
# 제품 스펙테이블 및 레이블 (V1 원본 코드와 동일)
# ... (PRODUCT_SPEC, LANG_LABEL, CLASS_NAMES, CLASS_MAP 유지) ...
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

LANG_LABEL = ["CN", "EN", "JP", "KR", "TW"] 
CLASS_NAMES = ['Home', 'Back', 'ID', 'Stat', 'Monitor_Small', 'Monitor_Big', 'sticker', 'Text']
CLASS_MAP = { 0: 'Home', 1: 'Back', 2: 'ID', 3: 'Stat', 4: 'Monitor_Small', 
              5: 'Monitor_Big', 6: 'sticker', 7: 'Text'
}

# 전역 모델 인스턴스
yolo_model = None
cnn_model = None

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
            yolo_model = YOLOModel(model_path=yolo_path) 
            DEVICE = yolo_model.device
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
# 이미지 분석 메인 함수 (명도/조도 적용 로직 추가)
# ============================================================
def analyze_image(image: np.ndarray, 
    # 💡 [수정] 명도/조도 인수를 받도록 시그니처 수정
    brightness: float = 0.0, 
    exposure_gain: float = 1.0) -> Dict:
    """
    이미지 분석 메인 함수: 7단계 복합 검사 파이프라인 수행 및 결과 JSON 반환
    """
    if yolo_model is None or cnn_model is None:
        initialize_models()
        if cnn_model is None:
            raise RuntimeError("CNN/Text 모델이 로드되지 않았습니다.")
    
    try:
        # TODO: 디버그
        print(f"[DEBUG] Brightness: {brightness}, Exposure: {exposure_gain}")
        
        # 입력 이미지를 RGB 포맷으로 변환
        pil_img_temp = Image.fromarray(image).convert("RGB")
        img_rgb = np.array(pil_img_temp) 
        pil_img = pil_img_temp
            
        original_img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        
        # BGR 포맷으로 변환 (OpenCV 처리를 위해)
        processed_img_bgr = original_img_bgr
        
        brightness_int = int(brightness)
        
        # 디폴트 값이 아닐 때 보정
        if brightness_int != 0 or exposure_gain != 1.0:
             processed_img_bgr = cv2.convertScaleAbs(original_img_bgr, 
                                                 alpha=exposure_gain, 
                                                 beta=brightness_int)

        draw_img = processed_img_bgr.copy()
        
    
        # 모델 입력 이미지를 RGB로 재변환 (YOLO 모델이 RGB를 기대한다고 가정)
        # 명도/조도 적용된 BGR 이미지를 RGB로 변환하여 모델에 전달
        img_rgb_corrected = cv2.cvtColor(processed_img_bgr, cv2.COLOR_BGR2RGB)
            
        # 1. YOLO 객체 검출
        yolo_results = yolo_model.detect(img_rgb_corrected) 
        
        # --- 2. YOLO 결과 플래그 및 CNN 데이터 수집 ---
        found_home = False
        found_stat = False
        found_monitor = False
        found_back = False
        found_id = False
        cnn_fail = False 
        
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
                
            # PIL 이미지는 원본 (수정 전)에서 Crop을 수행
            # CNNModel에 전달할 때는 명도 조절이 필요없다고 가정 (모델이 Robust하다고 가정)
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
                confidence_scores.append(prob * 100)

            elif base_cls == 'Text':
                prob, lang = cnn_model.predict_roi(crop_pil.convert("L"), cls_name)
                current_status = lang if isinstance(lang, str) else "Unknown"
                text_langs.append(current_status)
                confidence_scores.append(prob * 100)
            
            # --- 4. 시각화 데이터 준비 (명도/조도 적용된 draw_img에 그리기) ---
            final_label = f"{base_cls} {current_status or ''}".strip()
            
            # 색상 결정 (V1 원본 로직 유지)
            if current_status == 'Pass': color = (0, 255, 0) # Green (BGR)
            elif current_status == 'Fail': color = (0, 0, 255) # Red (BGR)
            else: color = (0, 200, 255) # Default (Cyan/Yellow) (BGR)

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
        
        # ... (이하 7단계 판정 로직 유지) ...
        # 1. 필수 요소 확인 (Rule A)
        if not found_home: fails.append("Home Missing")
        if not found_stat: fails.append("Stat Missing")
        if not found_monitor: fails.append("Monitor Missing")

        # 2. Back XOR ID (Rule B)
        button_type = None
        current_id_back_status = "Fail"
        
        if found_back and found_id: 
            fails.append("Back and ID Both Present")
        elif (not found_back) and (not found_id):
            fails.append("Back/ID Missing")
        elif found_back:
            button_type = "Back"
        elif found_id:
            button_type = "ID"

        # 3. Rule C: CNN Fail을 최종 Fail 목록에 명시적으로 추가 
        if button_type is not None:
            cnn_status = cnn_button_status_map.get(button_type, 'Fail')
        
            if cnn_status == "Pass" and prod is not None:
                current_id_back_status = "Pass"
                
            if cnn_status == "Fail":
                fails.append(f"{button_type} Button CNN Fail")
            if cnn_button_status_map.get('Stat') == "Fail":
                fails.append("Stat Button CNN Fail")
            
        # 4. 전체 CNN Fail 플래그 기반 Rule C 추가 (다른 버튼 포함)
        if cnn_fail: 
            if "Rule C: General Button Failure" not in fails:
                 pass 
                        
        # 5. Text 조건 (Rule D)
        text_count = len(text_langs)
        if not (text_count == 0 or text_count >= 3): fails.append(f"Text Count Invalid (N={text_count})")

        # 6. 모델 분류 결과 (Rule E)
        if prod is None: fails.append(model_err)
        
        # 7. 최종 판정
        is_pass = (len(fails) == 0)
        final_status = "PASS" if is_pass else "FAIL" 
        reason = "; ".join(fails) if fails else None
        
        # --- 7. 최종 결과 이미지에 요약 정보 추가 (명도/조도 적용된 draw_img에 그리기) ---
        
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

        final_result = {
            "status": final_status,
            "reason": reason,
            "confidence": round(avg_confidence, 2),
            "details": {
                # ... (중략) ...
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


def analyze_frame(image: np.ndarray, 
    brightness: float = 0.0, 
    exposure_gain: float = 1.0) -> Dict: 
    """
    실시간 프레임 분석 (analyze_image에 인수를 전달)
    """
    return analyze_image(image, brightness=brightness, exposure_gain=exposure_gain)
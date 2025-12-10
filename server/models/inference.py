"""
모델 추론 통합 로직 (수정 및 통합 버전)
YOLO, ConditionalViT (CNN) 모델을 연결하여 7단계 규칙 기반 Pass/Fail 및 제품 모델 분류
"""

import numpy as np
import torch
import time 
from typing import Dict, List, Optional
from PIL import Image
from collections import Counter
from ultralytics import YOLO
from torchvision import transforms
from transformers import ViTModel
import io
import os
import traceback

# 외부 모듈 임포트 (가정)
# 🚨 이 임포트가 실제 YOLO와 CNN 모델 클래스를 포함하는 파일입니다.
from models.yolo_model import YOLOModel 
from models.cnn_model import CNNModel
from .cnn_model import ConditionalViT

# ============================================================
# 제품 스펙테이블 및 레이블 (생략: 이전 코드와 동일)
# ============================================================
PRODUCT_SPEC = {
    "FM2-V160-000": {"button": "ID",   "lang": "CN"},
    "FM2-V161-000": {"button": "STAT", "lang": None},
    "FM2-V162-000": {"button": "STAT", "lang": "EN"},
    "FM2-V163-000": {"button": "STAT", "lang": "CN"},
    "FM2-V164-000": {"button": "STAT", "lang": "KR"},
    "FM2-V165-000": {"button": "STAT", "lang": "TW"},
    "FM2-V166-000": {"button": "ID",   "lang": "EN"},
    "FM2-V167-000": {"button": "STAT", "lang": "JP"},
}

LANG_LABEL = ["CN", "EN", "JP", "KR", "TW"]

CLASS_NAMES = ['Home', 'Back', 'ID', 'Stat', 'Monitor', 'Text', 'Monitor_Small', 'Monitor_Big', 'sticker']
CLASS_MAP = { 
    0: 'Home', 1: 'Back', 2: 'ID', 3: 'Stat', 4: 'Monitor', 5: 'Text', 
    6: 'Monitor_Small', 7: 'Monitor_Big', 8: 'sticker'
}

# 전역 모델 인스턴스
yolo_model = None
cnn_model = None
transform = None
DEVICE = "cpu"

# ============================================================
# 제품 모델 자동 분류 함수 (생략: 이전 코드와 동일)
# ============================================================
def classify_model(found_back, found_id, text_langs):
    # (1) 텍스트 언어 결정
    if len(text_langs) == 0:
        lang = None
    else:
        lang = Counter(text_langs).most_common(1)[0][0] 

    # (2) Back/ID 결정
    if found_back and (not found_id):
        btn_type = "STAT"  
    elif found_id and (not found_back):
        btn_type = "ID"
    else:
        return None, "Back/ID Mismatch (XOR Fail)" 

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
# NumPy 타입 변환 함수 (생략: 이전 코드와 동일)
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
# 모델 초기화 함수 (생략: 이전 코드와 동일)
# ============================================================
def initialize_models(
    yolo_path: str = "models/YOLO.pt",
    cnn_path: str = "models/CNN_classifier.pt",
):
    """모델 초기화 (서버 시작 시 호출)"""
    global yolo_model, cnn_model, transform, DEVICE
    
    # YOLO 모델 초기화
    if yolo_model is None:
        try:
            yolo_model = YOLOModel(model_path=yolo_path) 
        except Exception as e:
            print(f"YOLO 모델 로드 실패: {e}")
            
    # CNN/Text 모델 초기화
    if cnn_model is None:
        try:
            DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
            cnn_model = ConditionalViT() 
            cnn_model.load_state_dict(torch.load(cnn_path, map_location=DEVICE))
            cnn_model.eval()
            cnn_model = cnn_model.to(DEVICE)
            transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
            ])
            print("CNN/Text 모델 로드 완료.")
        except Exception as e:
            print(f"CNN/Text 모델 로드 실패: {e}")
            cnn_model = None
            
    return yolo_model, cnn_model

# ============================================================
# 이미지 분석 메인 함수 (최종 수정: 버튼 상태 독립성 강화)
# ============================================================
def analyze_image(image: np.ndarray) -> Dict:
    """
    이미지 분석 메인 함수: 7단계 복합 검사 파이프라인 수행 및 결과 구조 변경 반영
    """
    if yolo_model is None or cnn_model is None or transform is None:
        initialize_models()
        if cnn_model is None:
            raise RuntimeError("CNN/Text 모델이 로드되지 않았습니다.")
    
    try:
        # 이미지 전처리 (생략)
        if len(image.shape) == 3 and image.shape[2] == 3:
            pil_img = Image.fromarray(image).convert("RGB")
        else:
            pil_img = Image.fromarray(image).convert("RGB") 

        # 1. YOLO 객체 검출
        start_time_yolo = time.time()
        yolo_results = yolo_model.detect(image) 
        time_yolo = time.time() - start_time_yolo
        # print(f"\n[TIME CHECK] YOLO 객체 검출 시간: {time_yolo:.4f} 초")
        detected_classes_raw = [d["class"] for d in yolo_results.get("detections", [])]
        
        # --- 2. YOLO 결과 플래그 및 CNN 데이터 수집 ---
        found_home = False
        found_stat = False
        found_monitor = False
        found_back = False
        found_id = False

        cnn_results = []
        roi_pass_list = [] 
        text_langs = []
        
        # 🚨 [신규] 버튼 클래스별 CNN 결과를 저장하는 맵
        cnn_button_status_map = {} 
        button_classes = ['Home', 'Back', 'ID', 'Stat', 'Btn_Home', 'Btn_Back', 'Btn_ID', 'Btn_Stat']
        
        start_time_cnn_total = time.time() 

        for detection in yolo_results.get("detections", []):
            cls_name = detection["class"]
            bbox = detection["bbox"]
            
            if bbox[0] >= bbox[2] or bbox[1] >= bbox[3]: continue
                
            crop_pil = pil_img.crop((bbox[0], bbox[1], bbox[2], bbox[3])) 
            
            # 플래그 설정
            if cls_name in ['Home', 'Btn_Home']: found_home = True
            elif cls_name in ['Back', 'Btn_Back']: found_back = True
            elif cls_name in ['ID', 'Btn_ID']: found_id = True
            elif cls_name in ['Stat', 'Btn_Stat']: found_stat = True
            elif cls_name == 'Monitor': found_monitor = True
            elif cls_name in ['Monitor_Small', 'Monitor_Big']: found_monitor = True
            
            # --- 3. CNN 수행 (버튼 & 텍스트) ---
            if cls_name in button_classes:
                cond = torch.tensor([0]).to(DEVICE)
                with torch.no_grad():
                    t = transform(crop_pil).unsqueeze(0).to(DEVICE)
                    out = cnn_model(t, cond)[0]
                
                prob_pass = torch.softmax(out[:2], dim=0)[0].item() 
                is_pass = (torch.argmax(out[:2]).item() == 0) # 0이 Pass
                current_status = "Pass" if is_pass else "Fail"
                
                roi_pass_list.append(is_pass) 
                
                # 🚨 [수정] 맵에 해당 버튼의 상태를 저장 (Btn_ 제거, Fail 우선)
                base_cls_name = cls_name.replace('Btn_', '') 
                
                # 하나라도 Fail이면 Fail로 기록 (보수적 접근)
                if base_cls_name in cnn_button_status_map and cnn_button_status_map[base_cls_name] == "Fail":
                     pass
                else:
                    cnn_button_status_map[base_cls_name] = current_status
                
                cnn_results.append({
                    "class": cls_name,
                    "bbox": bbox,
                    "probability": round(prob_pass, 4), 
                    "status": current_status
                })

            elif cls_name == 'Text':
                # Text CNN 로직 (생략: 이전 코드와 동일)
                cond = torch.tensor([1]).to(DEVICE)
                with torch.no_grad():
                    t = transform(crop_pil).unsqueeze(0).to(DEVICE)
                    out = cnn_model(t, cond)[0]
                lang_idx = torch.argmax(out).item()
                lang = LANG_LABEL[lang_idx]
                prob_lang = torch.softmax(out, dim=0)[lang_idx].item()
                text_langs.append(lang)
                cnn_results.append({
                    "class": cls_name, "bbox": bbox, "probability": round(prob_lang, 4), 
                    "status": "OK", "lang": lang
                })
                
        time_cnn_total = time.time() - start_time_cnn_total
        # print(f"[TIME CHECK] CNN 총 추론 시간: {time_cnn_total:.4f} 초")


        # --- 4. 7가지 규칙 기반 판정 시작 ---
        yolo_presence_ok = found_home and found_stat and found_monitor
        yolo_xor_ok = found_back ^ found_id
        cnn_ok = all(roi_pass_list) if roi_pass_list else False # 전체 Rule C는 여전히 모든 버튼이 Pass해야 함
        text_count = len(text_langs)
        text_ok = (text_count == 0) or (text_count >= 3)
        detected_prod, model_err = classify_model(found_back, found_id, text_langs)
        model_ok = (detected_prod is not None)
        
        # --- 5. 최종 판정 (Rule A-E 모두 만족해야 PASS) ---
        final_pass = yolo_presence_ok and yolo_xor_ok and cnn_ok and text_ok and model_ok
        final_status = "PASS" if final_pass else "FAIL" 
        
        # --- 6. Fail 사유 수집 및 세분화된 상태 판단 (독립성 강화) ---
        reasons = []
        if not yolo_presence_ok: 
            missing = []
            if not found_home: missing.append("Home")
            if not found_stat: missing.append("Stat")
            if not found_monitor: missing.append("Monitor")
            reasons.append(f"필수 객체 미검출 ({', '.join(missing)})")
            
        if not yolo_xor_ok: 
            reasons.append("Back/ID 조건 불만족 (XOR 실패)")
            
        # 🚨 Rule C 실패 시 개별 버튼 품질 불량 명시 (이전 코드 유지)
        if not cnn_ok: 
            failed_buttons = [
                res["class"] for res in cnn_results 
                if res["status"] == "Fail" and res["class"] in button_classes
            ]
            if failed_buttons:
                reasons.append(f"버튼 CNN 품질 불량: {', '.join(failed_buttons)} (FAIL)")
            elif roi_pass_list:
                reasons.append("버튼 CNN 검증 실패 (세부 버튼 확인 필요)")

        if not text_ok: reasons.append(f"텍스트 개수 불만족 (N={text_count})")
        if not model_ok: reasons.append(model_err) 

        reason = "; ".join(reasons) if reasons else None
        
        # 🚨 [핵심 수정]: 세분화된 상태 판단 (개별 버튼의 CNN 상태에만 의존)
        
        # 1. HOME 상태: HOME 버튼 검출(YOLO) & Home 버튼 CNN Pass
        home_cnn_status = cnn_button_status_map.get('Home', 'Fail')
        home_status = "Pass" if found_home and (home_cnn_status == 'Pass') else "Fail"
        
        # 2. ID/BACK 상태: ID/BACK XOR 조건(YOLO) & 탐지된 버튼 (ID or Back)의 CNN Pass
        id_back_cnn_ok = (found_id and cnn_button_status_map.get('ID', 'Fail') == 'Pass') or \
                         (found_back and cnn_button_status_map.get('Back', 'Fail') == 'Pass')
                         
        # YOLO XOR 조건이 충족되고, 탐지된 해당 버튼의 CNN이 Pass여야 Pass
        id_back_status = "Pass" if yolo_xor_ok and id_back_cnn_ok else "Fail"
        
        # 3. STATUS 상태: STAT 버튼 검출(YOLO) & Stat 버튼 CNN Pass
        status_cnn_status = cnn_button_status_map.get('Stat', 'Fail')
        status_status = "Pass" if found_stat and (status_cnn_status == 'Pass') else "Fail"
        
        # 4. SCREEN 상태: Monitor 검출(YOLO) (CNN 품질 검증 없음)
        screen_status = "Pass" if found_monitor else "Fail"

        # --- 7. 신뢰도 계산 및 결과 구성 ---
        # ... (생략: 신뢰도 계산 및 final_result 딕셔너리 생성) ...
        
        confidence_scores = []
        for detection in yolo_results.get("detections", []):
            confidence_scores.append(detection.get("confidence", 0) * 100)
        for cnn_result in cnn_results:
            confidence_scores.append(cnn_result.get("probability", 0) * 100)
        
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
        
        final_result = {
            "status": final_status,
            "reason": reason,
            "confidence": round(avg_confidence, 2),
            "details": {
                "product_model": detected_prod,
                "language": Counter(text_langs).most_common(1)[0][0] if text_langs else None,
                
                "home_status": home_status,
                "id_back_status": id_back_status,
                "status_status": status_status,
                "screen_status": screen_status,
                
                "model_status": "Pass" if model_ok else "Fail",
                "text_count": text_count,
                "yolo_detections": yolo_results.get("detections", []),
                "cnn_results": cnn_results, 
                "detected_classes": detected_classes_raw
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
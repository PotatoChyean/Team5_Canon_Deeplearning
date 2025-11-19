"""
모델 추론 통합 로직
YOLO, OCR, CNN 모델을 연결하여 Pass/Fail 판단
"""

import numpy as np
from typing import Dict, List, Optional, Any
from PIL import Image
import pandas as pd
import os
import traceback
from models.yolo_model import YOLOModel
from models.ocr_model import OCRModel
from models.cnn_model import CNNModel

# 전역 모델 인스턴스 (서버 시작 시 한 번만 로드)
yolo_model = None
ocr_model = None
cnn_model = None
ocr_table = None

# YOLO 클래스 이름
CLASS_NAMES = ['Btn_Home', 'Btn_Back', 'Btn_ID', 'Btn_Stat', 'Monitor_Small', 'Monitor_Big', 'sticker']


def initialize_models(
    yolo_path: str = "models/yolov8m.pt",
    cnn_path: str = "models/cnn_4class_conditional.pt",
    ocr_csv_path: str = "models/OCR_lang.csv"
):
    """모델 초기화 (서버 시작 시 호출)"""
    global yolo_model, ocr_model, cnn_model, ocr_table
    
    if yolo_model is None:
        yolo_model = YOLOModel(model_path=yolo_path)
    
    if ocr_model is None:
        ocr_model = OCRModel()
    
    if cnn_model is None:
        cnn_model = CNNModel(model_path=cnn_path)
    
    # OCR CSV 테이블 로드
    if ocr_table is None and os.path.exists(ocr_csv_path):
        try:
            ocr_table = pd.read_csv(ocr_csv_path)
            print(f"OCR 테이블 로드 완료: {ocr_csv_path}")
        except Exception as e:
            print(f"OCR 테이블 로드 실패: {e}")
            ocr_table = None
    
    return yolo_model, ocr_model, cnn_model


# 🚨 [제거]: JSON 직렬화는 main.py의 app.json_encoders가 담당하므로 
# convert_numpy_to_python_types 함수는 제거합니다. (원본 코드에 이 함수가 없다고 가정)
# 만약 이 함수가 남아있다면 반드시 제거해야 합니다!

def analyze_image(image: np.ndarray) -> Dict:
    """
    이미지 분석 메인 함수
    """
    # 모델 초기화 확인
    if yolo_model is None or ocr_model is None or cnn_model is None:
        initialize_models()
    
    try:
        # 이미지를 PIL Image로 변환 (그레이스케일)
        if len(image.shape) == 3:
            pil_img = Image.fromarray(image).convert("L")
        else:
            pil_img = Image.fromarray(image, mode='L')
        
        # 1. OCR 언어 탐지 및 텍스트 인식
        # detect_language 함수도 이제 raw 결과를 반환해야 합니다.
        ocr_lang, ocr_status, ocr_boxes = detect_language(pil_img) 
        
        # 2. YOLO 객체 검출
        yolo_results = yolo_model.detect(image)
        detected_classes = [d["class"] for d in yolo_results.get("detections", [])]
        
        # 3. CNN ROI 검증
        cnn_results = []
        roi_pass_list = []
        conditions = ['Btn_Back', 'Btn_Home', 'Btn_ID', 'Btn_Stat']
        
        for detection in yolo_results.get("detections", []):
            cls_name = detection["class"]
            if cls_name not in conditions:
                continue
            
            bbox = detection["bbox"]  # [x1, y1, x2, y2]
            # BBox를 float으로 명시적 변환하여 사용 (타입 충돌 최소화)
            bbox = [float(x) for x in bbox] 
            
            crop = pil_img.crop((bbox[0], bbox[1], bbox[2], bbox[3]))
            
            prob, is_pass = cnn_model.predict_roi(crop, cls_name)
            roi_pass_list.append(is_pass)
            
            cnn_results.append({
                "class": cls_name,
                "bbox": bbox, 
                "probability": float(prob), # float으로 명시적 변환
                "status": "Pass" if is_pass else "Fail"
            })
        
        # 4. YOLO 판정
        yolo_ok = (
            ('Btn_Home' in detected_classes and 'Btn_Stat' in detected_classes) and
            (('Btn_Back' in detected_classes) ^ ('Btn_ID' in detected_classes)) and
            (('Monitor_Small' in detected_classes) or ('Monitor_Big' in detected_classes))
        )
        
        # 5. CNN 판정
        cnn_ok = all(roi_pass_list) if roi_pass_list else False
        
        # 🚨 [디버그 로그]: CNN 실패 시 상세 정보 출력 (이전 대화에서 추가 요청한 내용 유지)
        if not cnn_ok:
            print("-" * 50)
            print("🚨 CNN 검증 실패 발생!")
            for result in cnn_results:
                if result.get('status') == 'Fail': 
                    print(f"  실패 객체: {result.get('class')}, Prob: {result.get('probability')}")
            print("-" * 50)
        
        # 6. 최종 판정
        final_status = "PASS" if (ocr_status == "Pass" and yolo_ok and cnn_ok) else "FAIL"
        
        # 7. Fail 사유 수집
        reasons = []
        if ocr_status != "Pass":
            reasons.append(f"OCR 검증 실패 (언어: {ocr_lang})")
        if not yolo_ok:
            reasons.append("YOLO 객체 검출 조건 불만족")
        if not cnn_ok:
            reasons.append("CNN ROI 검증 실패")
        
        reason = "; ".join(reasons) if reasons else None
        
        # 8. 신뢰도 계산 (모두 float으로 처리)
        confidence_scores = []
        for detection in yolo_results.get("detections", []):
            confidence_scores.append(float(detection.get("confidence", 0) * 100)) 
        for cnn_result in cnn_results:
            confidence_scores.append(cnn_result.get("probability", 0) * 100)
        
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
        
        # 9. 최종 반환 딕셔너리 생성
        raw_output = {
            "status": final_status,
            "reason": reason,
            "confidence": round(float(avg_confidence), 2), # float으로 명시적 변환
            "details": {
                "ocr_status": ocr_status,
                "ocr_lang": ocr_lang,
                "yolo_status": "Pass" if yolo_ok else "Fail",
                "cnn_status": "Pass" if cnn_ok else "Fail",
                "yolo_detections": yolo_results.get("detections", []),
                "ocr_results": ocr_boxes,
                "cnn_results": cnn_results,
                "detected_classes": detected_classes
            }
        }
        
        # 🚨 [핵심 수정]: 시스템 인코더를 믿고 raw_output을 그대로 반환합니다.
        return raw_output 
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "FAIL",
            "reason": f"분석 중 오류 발생: {str(e)}",
            "confidence": 0.0,
            "details": {}
        }


def analyze_frame(image: np.ndarray) -> Dict:
    """
    실시간 프레임 분석 (analyze_image와 동일)
    """
    return analyze_image(image)


def detect_language(img: Image.Image) -> tuple:
    """
    OCR 언어 탐지 및 텍스트 인식
    """
    global ocr_table
    
    if ocr_table is None:
        return "Nonlingual", "Pass", []
    
    img_np = np.array(img)
    
    if not hasattr(ocr_model, 'readers') or not ocr_model.readers:
        return "Nonlingual", "Pass", []
    
    for lang in ocr_model.readers.keys():
        reader = ocr_model.readers[lang]
        if reader is None:
            continue
        
        try:
            has_group0 = False
            has_xor = False
            xor_multi = False
            
            results = reader.readtext(
                img_np, 
                detail=1, 
                text_threshold=0.4, 
                low_text=0.3, 
                contrast_ths=0.05
            )
            
            if not results:
                continue
            
            recognized = " ".join([r[1] for r in results])
            subset = ocr_table[ocr_table['lang'] == lang]
            matched = subset[subset['term'].apply(lambda t: t in recognized)]
            
            if matched.empty:
                continue
            
            group0_terms = subset[subset['group'] == 0]['term'].tolist()
            has_group0 = all(term in recognized for term in group0_terms)
            
            group1_terms = subset[subset['group'] == 1]['term'].tolist()
            has_xor = any(term in recognized for term in group1_terms)
            xor_multi = sum(term in recognized for term in group1_terms) > 1
            
            # 🚨 [핵심 수정]: OCR 결과도 이제 시스템 인코더가 처리하도록 raw results를 반환
            if has_group0 and has_xor and not xor_multi:
                return lang, "Pass", results
            else:
                return lang, "Fail", results
            
        except Exception as e:
            print(f"OCR 언어 {lang} 탐지 오류: {e}")
            continue
    
    return "Nonlingual", "Pass", []
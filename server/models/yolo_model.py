"""
YOLO 모델 로드 및 추론
"""

import numpy as np
from typing import Dict, List
import torch
from ultralytics import YOLO
import os


class YOLOModel:
    """YOLO 모델 래퍼 클래스"""
    
    def __init__(self, model_path: str = "models/YOLO.pt"):
        self.model_path = model_path
        self.model = None
        self.class_names = ['Btn_Home', 'Btn_Back', 'Btn_ID', 'Btn_Stat', 'Monitor', 'Text'] 
        
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.load_model()
    
    def load_model(self):
        """모델 로드"""
        try:
            if os.path.exists(self.model_path):
                self.model = YOLO(self.model_path)
                print(f"YOLO 모델 로드 완료: {self.model_path}")
            else:
                print(f"YOLO 모델 파일을 찾을 수 없습니다: {self.model_path}")
                print("기본 yolov8m.pt 모델을 사용합니다.")
                self.model = YOLO("yolov8m.pt")
        except Exception as e:
            print(f"YOLO 모델 로드 실패: {e}")
            print("기본 yolov8m.pt 모델을 사용합니다.")
            try:
                self.model = YOLO("yolov8m.pt")
            except:
                self.model = None
    
    def detect(self, image: np.ndarray, conf_threshold: float = 0.5) -> Dict:
        """
        이미지에서 객체 검출 (Flask 코드와 동일한 방식)
        
        Args:
            image: numpy array 형태의 이미지 (H, W, C)
            conf_threshold: 신뢰도 임계값
            
        Returns:
            {
                "detections": [
                    {
                        "bbox": [x1, y1, x2, y2],
                        "class": "class_name",
                        "confidence": 0.0-1.0
                    },
                    ...
                ],
                "image_shape": [height, width]
            }
        """
        if self.model is None:
            return {
                "detections": [],
                "image_shape": list(image.shape[:2]) if len(image.shape) >= 2 else [0, 0]
            }
        
        try:
            results = self.model.predict(
                source=image,
                conf=conf_threshold,
                imgsz=800,
                device=self.device,
                verbose=False
            )
            
            detections = []
            if results and len(results) > 0:
                r = results[0]
                boxes = r.boxes.xyxy.cpu().numpy().astype(int)
                cls_ids = r.boxes.cls.cpu().numpy().astype(int)
                confidences = r.boxes.conf.cpu().numpy()
                
                for (x1, y1, x2, y2), cls_id, conf in zip(boxes, cls_ids, confidences):
                    if cls_id < len(self.class_names):
                        cls_name = self.class_names[int(cls_id)]
                    else:
                        cls_name = f"class_{int(cls_id)}"
                    
                    detections.append({
                        "bbox": [int(x1), int(y1), int(x2), int(y2)],
                        "class": cls_name,
                        "confidence": float(conf)
                    })
            
            return {
                "detections": detections,
                "image_shape": list(image.shape[:2]) if len(image.shape) >= 2 else [0, 0]
            }
        
        except Exception as e:
            print(f"YOLO 검출 오류: {e}")
            import traceback
            traceback.print_exc()
            return {
                "detections": [],
                "image_shape": list(image.shape[:2]) if len(image.shape) >= 2 else [0, 0]
            }


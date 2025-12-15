"""
CNN 모델 (ViTClassifier) 로드 및 추론
"""

import torch
import torch.nn as nn
from torchvision import transforms
from transformers import ViTModel
from PIL import Image
import numpy as np
from typing import Dict, Tuple

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

class ViTClassifier(nn.Module):
    """Vision Transformer 기반 분류 모델"""
    def __init__(self):
        super().__init__()
        # 사전 학습된 ViT 모델 로드 (3-channel input)
        self.vit = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

        # 분류 헤드 정의
        dim = self.vit.config.hidden_size
        self.head_btn = nn.Linear(dim, 2)
        self.head_txt = nn.Linear(dim, 5)

    def forward(self, x, condition_str: str):
        # condition_str에 따라 숫자 조건(cond) 생성
        B = x.size(0)
        cond_val = 0 if 'Btn' in condition_str else 1
        cond = torch.tensor([cond_val] * B, device=x.device)
        
        # ViT 모델 추론
        out = self.vit(x).pooler_output
        btn_logits = self.head_btn(out)
        txt_logits = self.head_txt(out)

        # 최종 출력 텐서 초기화
        final_logits = torch.zeros((B, 5), device=x.device)

        # 조건에 따라 로짓 채우기
        btn_indices = (cond == 0)
        txt_indices = (cond == 1)

        if btn_indices.sum() > 0:
            final_logits[btn_indices, :2] = btn_logits[btn_indices]
        if txt_indices.sum() > 0:
            final_logits[txt_indices] = txt_logits[txt_indices]
            
        return final_logits, out

LANG_LABEL = ["CN", "EN", "JP", "KR", "TW"]

class CNNModel:
    """CNN 모델 래퍼 클래스"""
    
    def __init__(self, model_path: str = "models/CNN_classifier.pt", num_classes: int = 4):
        self.model_path = model_path
        self.num_classes = num_classes
        self.model = None
        
        try:
            resampling = Image.Resampling.LANCZOS
        except AttributeError:
            resampling = Image.LANCZOS
        
        # 1-channel (grayscale) -> 3-channel 변환을 포함하도록 전처리 수정
        self.transform = transforms.Compose([
            transforms.Resize((224, 224), interpolation=resampling),
            transforms.Grayscale(num_output_channels=3),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
        ])
        self.conditions = ['Btn_Back', 'Btn_Home', 'Btn_ID', 'Btn_Stat', "Text"]
        self.load_model()
    
    def load_model(self):
        """모델 로드"""
        try:
            self.model = ViTClassifier().to(DEVICE)
            # 저장된 state_dict를 직접 로드합니다.
            self.model.load_state_dict(torch.load(self.model_path, map_location=DEVICE), strict=False)
            self.model.eval()
            print(f"CNN 모델 로드 완료: {self.model_path}")
        except Exception as e:
            print(f"CNN 모델 로드 실패: {e}")
            print("경로를 확인하거나 모델 파일이 존재하는지 확인하세요.")
            self.model = None
    
    def predict_roi(self, image: Image.Image, condition: str) -> Tuple[float, str | bool]:
        """
        ROI 이미지에 대한 예측 수행 (버튼: PASS or FAIL / Text: Language Code)
        """
        if self.model is None or condition not in self.conditions:
            return 0.0, False
        
        try:
            # 1. 이미지 전처리 및 디바이스 이동
            x = self.transform(image).unsqueeze(0).to(DEVICE)
            
            # 2. 추론
            with torch.no_grad():
                logits, _ = self.model(x, condition)
                
                # 3. 버튼 품질 검사 ('Btn' 조건)
                if 'Btn' in condition:
                    btn_logits = logits[:, :2] # Pass, Fail
                    probabilities = torch.softmax(btn_logits, dim=1)
                    
                    predicted_idx = torch.argmax(btn_logits, dim=1).item()
                    is_pass = (predicted_idx == 0) # 0이 Pass라고 가정
                    prob = probabilities[0, predicted_idx].item()
                    
                    return prob, is_pass 
                    
                # 4. 텍스트 언어 감지 ('Text' 조건)
                elif condition == 'Text':
                    txt_logits = logits # 5개 언어 로짓
                    probabilities = torch.softmax(txt_logits, dim=1)
                    predicted_idx = torch.argmax(txt_logits, dim=1).item()
                    
                    # 5개 클래스 (CN, EN, JP, KR, TW)
                    if 0 <= predicted_idx < len(LANG_LABEL):
                        lang_code = LANG_LABEL[predicted_idx]
                    else:
                        lang_code = "Unknown"
                        
                    prob = probabilities[0, predicted_idx].item()
                    
                    return prob, lang_code # 확률과 언어 코드 str 반환
                    
                else:
                    return 0.0, False # 예상치 못한 조건

        except Exception as e:
            print(f"CNN 예측 오류: {e}")
            return 0.0, False 

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


class CNNModel:
    """CNN 모델 래퍼 클래스"""
    
    def __init__(self, model_path: str = "models/CNN_classifier.pt", num_classes: int = 4):
        """
        CNN 모델 초기화
        
        Args:
            model_path: 학습된 CNN 모델 경로
            num_classes: 조건 클래스 수 (ViT에서는 직접 사용되지 않을 수 있음)
        """
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
        self.conditions = ['Btn_Back', 'Btn_Home', 'Btn_ID', 'Btn_Stat']
        self.load_model()
    
    def load_model(self):
        """모델 로드"""
        try:
            self.model = ViTClassifier().to(DEVICE)
            # 저장된 state_dict를 직접 로드합니다.
            # strict=False는 일부 일치하지 않는 키를 무시하도록 허용합니다.
            self.model.load_state_dict(torch.load(self.model_path, map_location=DEVICE), strict=False)
            self.model.eval()
            print(f"CNN 모델 로드 완료: {self.model_path}")
        except Exception as e:
            print(f"CNN 모델 로드 실패: {e}")
            print("경로를 확인하거나 모델 파일이 존재하는지 확인하세요.")
            self.model = None
    
    def predict_roi(self, image: Image.Image, condition: str) -> Tuple[float, bool]:
        """
        ROI 이미지에 대한 예측 수행
        
        Args:
            image: PIL Image (그레이스케일)
            condition: 조건 클래스 이름 ('Btn_Back', 'Btn_Home', 'Btn_ID', 'Btn_Stat')
            
        Returns:
            (probability, is_pass): 확률값과 Pass 여부 (0.5 이상이면 Pass)
        """
        if self.model is None:
            return 0.0, False
        
        if condition not in self.conditions:
            return 0.0, False
        
        try:
            # 이미지 전처리
            x = self.transform(image).unsqueeze(0).to(DEVICE)
            
            # 추론
            with torch.no_grad():
                # ViT 모델은 condition 문자열을 직접 받음
                logits, _ = self.model(x, condition)
                
                # 'Btn' 조건인 경우, 처음 2개 로짓만 사용
                if 'Btn' in condition:
                    btn_logits = logits[:, :2]
                    probabilities = torch.softmax(btn_logits, dim=1)
                else:
                    # 'Txt' 조건인 경우 (현재는 Btn만 처리)
                    # 여기서는 5개 로짓 모두 사용
                    probabilities = torch.softmax(logits, dim=1)
                
                # head_btn의 출력이 [Pass, Fail] 순서라고 가정 (0: Pass, 1: Fail)
                predicted_idx = torch.argmax(btn_logits, dim=1).item() # Get index of max logit
                is_pass = (predicted_idx == 0) # If predicted index is 0, then it's Pass
                
                # Return the probability of the predicted class
                prob = probabilities[0, predicted_idx].item()
            
            return prob, is_pass
        
        except Exception as e:
            print(f"CNN 예측 오류: {e}")
            return 0.0, False


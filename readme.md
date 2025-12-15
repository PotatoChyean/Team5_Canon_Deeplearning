
---

# 📸 Canon 복합기 PASS / FAIL 자동 분류 시스템

### Deeplearning-based Quality Inspection System

본 프로젝트는 YOLO (You Only Look Once) 및 ViT/CNN 기반 딥러닝 모델을 활용하여
캐논 복합기 제품의 품질 검사 기준(PASS / FAIL)에 따라 불량 여부를 자동으로 판별하는
**지능형 품질 검사 시스템**입니다.

**FastAPI 기반의 고성능 Backend 서버**와
**사용자 친화적인 웹 클라이언트 인터페이스**를 통해
제조 현장에서 **신속하고 정확한 품질 관리(Quality Inspection)**를 지원합니다.

---

## 🎯 프로젝트 개요 (Overview)

* 딥러닝 기반 이미지 분석을 통한 **자동 품질 판정**
* 실시간 웹캠 스트리밍 검사 지원
* 제조 환경에 최적화된 밝기 및 조도 제어
* 검사 이력 관리 및 Excel 리포트 자동 생성

---

## 🌟 주요 기능 (Core Features)

### 📂 파일 기반 이미지 분석

* 이미지 업로드를 통해 즉시 **PASS / FAIL 결과 확인**
* 딥러닝 모델을 활용한 자동 분류

### 🎥 실시간 웹캠 스트리밍 분석

* 웹캠을 통한 제품 실시간 모니터링
* 스트리밍 영상에 대한 연속적 품질 검사

### 💡 분석 환경 최적화

* 웹캠의 **명도(Brightness)** 및 **조도(Illuminance)** 조절
* 검사 정확도를 높이기 위한 환경 튜닝 기능 제공

### 📊 데이터 관리 및 리포트

* 과거 및 현재 검사 결과 시각화
* 검사 결과를 **Excel 파일로 추출**하여 리포트화

---

## 🛠️ 기술 스택 (Tech Stack)

| 구분                                    | 기술 / 프레임워크                    |
| ------------------------------------- | ----------------------------- |          |
| **Server**                            | Uvicorn, python-multipart,Python, FastAPI|
| **Deep Learning**                     | PyTorch (GPU 지원)              |
| **Object Detection / Classification** | YOLO (Ultralytics)            |                     |
| **Image / Data Processing**           | OpenCV, NumPy, Pandas, Pillow |

---

## 🚀 시작하기 (Getting Started)

### 1️⃣ 전제 조건 (Prerequisites)

* Python **3.10.19**
* Git
* CUDA / cuDNN (GPU 가속 사용 시 권장)

---

### 2️⃣ 설치 (Installation)

#### 🔹 저장소 복제

```bash
git clone https://github.com/PotatoChyean/Team5_Canon_Deeplearning.git
cd Team5_Canon_Deeplearning
```

#### 🔹 가상 환경 설정 (권장)
✅ 방법 1. venv 사용 (Python 기본 가상환경)
```bash
python -m venv venv

# Linux / macOS
source venv/bin/activate

# Windows (PowerShell)
.\venv\Scripts\activate
```

✅ 방법 2. Conda 사용 
```bash
conda create -n canon_dl python=3.10.19 -y
conda activate canon_dl

⚠️ 주의
Conda 환경에서도 pip을 사용하여 의존성을 설치합니다.
GPU 사용 시 PyTorch 설치 오류가 발생한다면,
공식 PyTorch 가이드를 참고하여 CUDA 버전에 맞게 재설치하세요.


#### 🔹 의존성 설치

```bash
cd server

> ⚠️ **주의**
> GPU 환경이 아닐 경우, CPU 전용 PyTorch 버전으로 수정하여 설치해 주세요.
> CPU 버전으로 설치하는 방법

pip install torch torchvision torchaudio \
  --index-url https://download.pytorch.org/whl/cpu

conda install pytorch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 cpuonly -c pytorch


pip install -r requirements.txt

```


---

### 3️⃣ 프로젝트 실행 (Running the Project)


#### 3.1 Backend 서버 실행

```bash
cd server
python.exe main.py
```

---
#### 3.2 Frontend 클라이언트 실행

> 클라이언트가 별도 디렉토리에 존재하는 경우

```bash
# 예시 (Node.js 기반 클라이언트)
cd client
npm install
npm run dev
```

---

"""
FastAPI 백엔드 서버
YOLO + OCR 모델을 사용한 이미지 분석 API (완성본)
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
import uvicorn
from datetime import datetime
import numpy as np # NumPy 타입 처리를 위해 필요
from PIL import Image
import io
import os
import traceback
from fastapi.encoders import jsonable_encoder # 🚨 [추가]: jsonable_encoder 임포트

# --- 1. 통합된 모델 및 DB 모듈 임포트 ---
from models.inference import analyze_image, analyze_frame, initialize_models
from database.db import save_result, get_statistics, get_results 


# --- 2. FastAPI 앱 초기화 및 설정 ---
app = FastAPI(title="Cannon Project API", version="1.0.0")


# 이 코드가 어떤 경로로 들어오는 NumPy 타입이든 자동으로 Python int/float으로 변환합니다.
app.json_encoders = {
    np.int_: int, np.intc: int, np.intp: int, np.int8: int, np.int16: int, 
    np.int32: int, np.int64: int, np.uint8: int, np.uint16: int, 
    np.uint32: int, np.uint64: int, np.float32: float, np.float64: float, 
    np.generic: float, # 모든 NumPy 타입을 float으로 처리
}

# CORS 설정 (Next.js 프론트엔드와 통신)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- 3. 모델 초기화 이벤트 (서버 시작 시 1회 실행) ---
@app.on_event("startup")
async def startup_event():
    """서버 시작 시 모델 로드 및 DB 연결 준비"""
    print("모델 초기화 및 DB 연결 준비 중...")
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    yolo_path = os.path.join(BASE_DIR, "models", "yolov8m.pt")
    cnn_path = os.path.join(BASE_DIR, "models", "cnn_4class_conditional.pt")
    ocr_csv_path = os.path.join(BASE_DIR, "models", "OCR_lang.csv")
    
    initialize_models(
        yolo_path=yolo_path,
        cnn_path=cnn_path,
        ocr_csv_path=ocr_csv_path
    )
    print("모델 초기화 완료")
    
    try:
        from database.db import init_db 
        init_db() 
        print("DB 초기화 완료")
    except Exception as e:
        print(f"DB 초기화 중 오류 발생: {e}")


# --- 4. API 엔드포인트 정의 ---

@app.post("/api/analyze-image")
async def analyze_image_endpoint(file: UploadFile = File(...)):
    """단일 이미지 파일을 분석하여 Pass/Fail 결과 반환"""
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_array = np.array(image)
        
        result = analyze_image(image_array) 

        saved_result = save_result(
            filename=file.filename,
            status=result["status"],
            reason=result.get("reason"),
            confidence=result.get("confidence", 0),
            details=result.get("details", {})
        )
        
        # 🚨 [수정]: jsonable_encoder 적용
        return JSONResponse(content=jsonable_encoder({
            "id": saved_result["id"],
            "filename": file.filename,
            "status": result["status"],
            "reason": result.get("reason"),
            "confidence": result.get("confidence", 0),
            "details": result.get("details", {}),
            "timestamp": saved_result["timestamp"]
        }))
    
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"분석 중 오류 발생: {str(e)}")


@app.post("/api/analyze-batch")
async def analyze_batch_endpoint(files: List[UploadFile] = File(...)):
    """여러 이미지 파일을 일괄 분석"""
    results = []
    
    for file in files:
        try:
            contents = await file.read()
            image = Image.open(io.BytesIO(contents))
            image_array = np.array(image)
            
            result = analyze_image(image_array)
            
            saved_result = save_result(
                filename=file.filename,
                status=result["status"],
                reason=result.get("reason"),
                confidence=result.get("confidence", 0),
                details=result.get("details", {})
            )
            
            results.append({
                "id": saved_result["id"],
                "filename": file.filename,
                "status": result["status"],
                "reason": result.get("reason"),
                "confidence": result.get("confidence", 0),
                "details": result.get("details", {}),
                "timestamp": saved_result["timestamp"]
            })
        
        except Exception as e:
            results.append({
                "filename": file.filename,
                "status": "ERROR",
                "reason": f"처리 실패: {str(e)}",
                "confidence": 0
            })
    
    # 🚨 [수정]: jsonable_encoder 적용
    return JSONResponse(content={"results": jsonable_encoder(results)})


@app.post("/api/analyze-frame")
async def analyze_frame_endpoint(file: UploadFile = File(...)):
    """실시간 카메라 프레임 분석"""
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_array = np.array(image)
        
        result = analyze_frame(image_array)
        
        # 🚨 [수정]: jsonable_encoder 적용
        return JSONResponse(content=jsonable_encoder({
            "status": result["status"],
            "reason": result.get("reason"),
            "confidence": result.get("confidence", 0),
            "details": result.get("details", {})
        }))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프레임 분석 중 오류 발생: {str(e)}")


@app.get("/api/statistics")
async def get_statistics_endpoint(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """분석 결과 통계 조회 (DB read)"""
    try:
        stats = get_statistics(start_date, end_date)
        # 🚨 [수정]: jsonable_encoder 적용
        return JSONResponse(content=jsonable_encoder(stats))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"통계 조회 중 오류 발생: {str(e)}")


@app.get("/api/results")
async def get_results_endpoint(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """분석 결과 목록 조회 (DB read)"""
    try:
        results = get_results(status=status, limit=limit, offset=offset)
        # 🚨 [수정]: jsonable_encoder 적용
        return JSONResponse(content={"results": jsonable_encoder(results)})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"결과 조회 중 오류 발생: {str(e)}")


@app.get("/health")
async def health_check():
    """서버 상태 확인"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# --- 5. 서버 실행 ---
if __name__ == "__main__":
    print("FastAPI 서버 시작: http://localhost:5000")
    uvicorn.run(app, host="0.0.0.0", port=5000)
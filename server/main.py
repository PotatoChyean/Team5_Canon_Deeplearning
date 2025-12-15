"""
FastAPI 백엔드 서버
YOLO + OCR 모델을 사용한 이미지 분석 API
"""

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from typing import List, Optional
import uvicorn
from datetime import datetime
import numpy as np
from PIL import Image
import io
import csv
from models.yolo_model import YOLOModel
from models.cnn_model import CNNModel
import os
import asyncio
import base64
from urllib.parse import quote
import time

import models.inference as inference_module
from models.inference import analyze_image, analyze_frame, initialize_models, convert_numpy_types

from database.db import save_result, get_statistics, get_results

yolo_model = None
cnn_model = None
app = FastAPI(title="Cannon Project API", version="1.0.0")

# 모델 실행 확인
@app.get("/api/model_status")
async def get_model_status():
    """모델 로드 상태를 확인하는 임시 엔드포인트"""
    global cnn_model, yolo_model
    
    status = {
        "cnn_loaded": inference_module.cnn_model is not None,
        "yolo_loaded": inference_module.yolo_model is not None
    }
    
    if status["cnn_loaded"]:
        # 로드된 경우, 모델 타입도 확인
        status["cnn_type"] = type(inference_module.cnn_model).__name__
    
    return status

analysis_progress = {
    "total_count": 0,
    "completed_count": 0,
    "is_running": False,
    "last_processed_info": { 
        "filename": "N/A",
        "elapsed_time_sec": 0.0,
        "status": "Ready"
    }
}

@app.get("/api/analysis-progress")
async def get_analysis_progress():
    """프론트엔드 Polling 요청에 현재 분석 진행 상황을 제공"""
    global analysis_progress
    
    # 이 엔드포인트는 진행 상황 객체를 그대로 반환합니다.
    return {
        "total_count": analysis_progress["total_count"],
        "completed_count": analysis_progress["completed_count"],
        "is_running": analysis_progress["is_running"]
    }


# 서버 시작 시 모델 초기화
@app.on_event("startup")
async def startup_event():
    """서버 시작 시 모델 로드"""
    print("모델 초기화 중...")
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # 모델 경로 설정 
    yolo_path = os.path.join(BASE_DIR, "models", "YOLO.pt")
    cnn_path = os.path.join(BASE_DIR, "models", "CNN_classifier.pt")

    # 경로가 없으면 상대 경로로 시도
    if not os.path.exists(yolo_path):
        yolo_path = "models/YOLO.pt"
    if not os.path.exists(cnn_path):
        cnn_path = "models/CNN_classifier.pt"

    
    initialize_models(
        yolo_path=yolo_path,
        cnn_path=cnn_path
    )
    print("모델 초기화 완료")

# CORS 설정 (Next.js 프론트엔드와 통신)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js 개발 서버
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/analyze-image")
async def analyze_image_endpoint(file: UploadFile = File(...)):
    """
    이미지 파일을 분석하여 Pass/Fail 결과 반환
    """
    try:
        # 이미지 파일 읽기
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="빈 파일입니다.")
        
        try:
            image = Image.open(io.BytesIO(contents))
            # 이미지를 RGB로 변환 (RGBA나 다른 형식 대응)
            if image.mode != 'RGB':
                image = image.convert('RGB')
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"이미지 파일 형식 오류: {str(e)}")
        
        image_array = np.array(image)
        
        # 모델 추론 실행
        result = analyze_image(image_array)
        
        # 결과 저장
        saved_result = save_result(
            filename=file.filename,
            status=result["status"],
            reason=result.get("reason"),
            confidence=result.get("confidence", 0),
            details=result.get("details", {})
        )
        
        return JSONResponse(content={
            "id": saved_result["id"],
            "filename": file.filename,
            "status": result["status"],
            "reason": result.get("reason"),
            "confidence": result.get("confidence", 0),
            "details": result.get("details", {}),
            "timestamp": saved_result["timestamp"]
        })
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"분석 중 오류 발생: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)  # 디버그 위함, 서버 로그에 출력
        raise HTTPException(status_code=500, detail=f"분석 중 오류 발생: {str(e)}")


@app.post("/api/analyze-batch")
async def analyze_batch_endpoint(files: List[UploadFile] = File(...)):
    global analysis_progress
    
    analysis_progress["total_count"] = len(files)
    analysis_progress["completed_count"] = 0
    analysis_progress["is_running"] = True
    analysis_progress["last_processed_info"] = {
        "filename": "N/A", 
        "elapsed_time_sec": 0.0, 
        "status": "Running"
    } 
    
    await asyncio.sleep(0.01)
    results = []
    
    for file in files:
        file_result = None
        elapsed_time = 0.0
        start_time = time.time()
        await asyncio.sleep(0.2)
        try:
            contents = await file.read()
            if not contents:
                results.append({
                    "filename": file.filename,
                    "status": "ERROR",
                    "reason": "빈 파일입니다.",
                    "confidence": 0,
                    "elapsed_time": 0.0
                })
                continue

            try:
                image = Image.open(io.BytesIO(contents))
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                    
            except Exception as e:
                results.append({
                    "filename": file.filename,
                    "status": "ERROR",
                    "reason": f"이미지 파일 형식 오류: {str(e)}",
                    "confidence": 0,
                    "elapsed_time": round(elapsed_time, 4)
                })
                continue
            start_time = time.time()
            
            image_array = np.array(image)
            result_raw = analyze_image(image_array)
            
            result = convert_numpy_types(result_raw)
            
            lapsed_time = time.time() - start_time
            
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
                "timestamp": saved_result["timestamp"],
                "elapsed_time": round(elapsed_time, 4)
            })
        
        except Exception as e:
            results.append({
                "filename": file.filename,
                "status": "ERROR",
                "reason": f"처리 실패: {str(e)}",
                "confidence": 0,
                "elapsed_time": round(elapsed_time, 4)
            })
            
        finally:
            analysis_progress["completed_count"] += 1
            if file_result:
                analysis_progress["last_processed_info"] = {
                 "filename": file.filename,
                 "elapsed_time_sec": file_result.get("elapsed_time", 0.0),
                 "status": file_result.get("status", "ERROR")
                }
                results.append(file_result)
                
            analysis_progress["is_running"] = False
    
    return JSONResponse(content={"results": results})


@app.post("/api/analyze-frame")
async def analyze_frame_endpoint(file: UploadFile = File(...),
    brightness: str = Form("0.0"), 
    exposure_gain: str = Form("1.0")
):
    """
    실시간 카메라 프레임 분석
    """
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="빈 파일입니다.")
        
        try:
            brightness_val = float(brightness)
            exposure_val = float(exposure_gain)
        except ValueError:
            print(f"[ERROR] 잘못된 명도/조도 값이 수신되었습니다. Brightness: {brightness}, Exposure: {exposure_gain}")
            brightness_val = 0.0
            exposure_val = 1.0
            
        try:
            image = Image.open(io.BytesIO(contents))
            if image.mode != 'RGB':
                image = image.convert('RGB')
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"이미지 파일 형식 오류: {str(e)}")
        
        image_array = np.array(image)
        print(f"[DEBUG - FastAPI] Final Brightness Value: {brightness_val}, Exposure Value: {exposure_val}")
        
        result: dict
        processed_image: Image.Image
        result = analyze_frame(
            image_array, 
            brightness=brightness_val, 
            exposure_gain=exposure_val
        )
        encoded_image = result.get("details", {}).get("annotated_image")
        
        saved_result = save_result(
            filename=f"CAMERA_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}",
            status=result["status"],
            reason=result.get("reason"),
            confidence=result.get("confidence", 0),
            details=result.get("details", {})
        )

        return JSONResponse(content={
            "id": saved_result["id"], 
            "filename": saved_result["filename"], 
            "timestamp": saved_result["timestamp"],
            "status": result["status"],
            "reason": result.get("reason"),
            "confidence": result.get("confidence", 0),
            "details": result.get("details", {}),
            "processed_image_b64": encoded_image
        })
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"프레임 분석 중 오류 발생: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)  # 서버 로그에 출력
        raise HTTPException(status_code=500, detail=f"프레임 분석 중 오류 발생: {str(e)}")


@app.get("/api/report")
async def get_report_endpoint(
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    분석 결과를 CSV 리포트로 다운로드
    """
    results = get_results(
        status=status, 
        start_date=start_date, 
        end_date=end_date,
        limit=10000 
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # CSV 헤더 작성
    header = [
        "ID", 
        "Filename", 
        "Timestamp", 
        "Final Status", 
        "Home Button",
        "Status Button", 
        "Screen", 
        "ID/Back Button", 
        "Text Language",
        "Fail Reason", 
        "Confidence", 
        "Product Model",
    ]
    writer.writerow(header)

    # CSV 데이터 행 작성
    for result in results:
        details = result.get("details", {})
        text_language = details.get("language", "N/A") 
        product_model = details.get("product_model", "N/A")

        row = [
            result.get("id"),
            result.get("filename"),
            result.get("timestamp"),
            result.get("status"),                                 
            details.get("home_status", "N/A"),
            details.get("status_status", "N/A"),
            details.get("screen_status", "N/A"),
            details.get("id_back_status", "N/A"),
            text_language,                                         
            result.get("reason"),  
            result.get("confidence"),                              
            product_model                                        
        ]
        writer.writerow(row)

    output.seek(0)
    
    report_filename = f"analysis_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    content_disposition = f"attachment; filename=\"{report_filename}\""

    headers = {
        "Content-Disposition": content_disposition, 
        "Access-Control-Expose-Headers": "Content-Disposition"
    }

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers=headers
)

@app.get("/api/statistics")
async def get_statistics_endpoint(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    분석 결과 통계 조회
    """
    try:
        stats = await asyncio.to_thread(get_statistics, start_date, end_date) 
        return JSONResponse(content=stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"통계 조회 중 오류 발생: {str(e)}")
    
@app.get("/api/results")
async def get_results_endpoint(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    분석 결과 목록 조회
    """
    try:
        results = await asyncio.to_thread(get_results, status=status, limit=limit, offset=offset)
        return JSONResponse(content={"results": results})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"결과 조회 중 오류 발생: {str(e)}")


@app.get("/health")
async def health_check():
    """서버 상태 확인"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)


"""
데이터베이스 연동 (MySQL 버전)
FastAPI의 비동기 환경을 고려하여 Connection Pool 사용
"""

import mysql.connector
from mysql.connector import pooling
from datetime import datetime
from typing import Dict, List, Optional
import json
import os
from dotenv import load_dotenv

# .env 파일에서 환경 변수 로드
load_dotenv()

# --- MySQL 연결 설정 (Node.js 코드의 정보를 Python에 맞게 적용) ---
POOL_NAME = "analysis_pool"

# 환경 변수에서 DB 정보 가져오기
DB_CONFIG = {
    'host': os.getenv('DB_HOST') or "localhost",
    'user': os.getenv('DB_USER') or "root",
    'password': os.getenv('DB_PASSWORD') or "Jangchaeyean2023!", # 사용자님의 비밀번호
    'database': os.getenv('DB_NAME') or "testdb",
    'pool_size': 10,
}

# Connection Pool 생성 (서버 시작 시 한 번만 생성)
try:
    db_pool = mysql.connector.pooling.MySQLConnectionPool(
        pool_name=POOL_NAME,
        pool_size=DB_CONFIG['connection_limit'],
        **DB_CONFIG
    )
    print(f"MySQL Connection Pool '{POOL_NAME}' 생성 완료.")
except Exception as e:
    print(f"MySQL 연결 풀 생성 실패: {e}")
    db_pool = None


def get_connection():
    """풀에서 연결 하나를 가져오는 함수"""
    if db_pool is None:
        raise Exception("MySQL 연결 풀이 초기화되지 않았습니다.")
    # dictionary=True를 사용하여 결과 행을 딕셔너리 형태로 받습니다 (SQLite의 row_factory=sqlite3.Row와 유사).
    return db_pool.get_connection(dictionary=True)


def init_db():
    """데이터베이스 초기화 (테이블 생성)"""
    if db_pool is None:
        print("DB 초기화 스킵: 연결 풀 오류")
        return
        
    conn = get_connection()
    cursor = conn.cursor()
    
    # SQLite 테이블 정의를 MySQL 문법에 맞게 수정 (AUTOINCREMENT -> AUTO_INCREMENT)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_results (
            id INT PRIMARY KEY AUTO_INCREMENT,
            filename VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL,
            reason TEXT,
            confidence DECIMAL(5, 2),
            details JSON,
            timestamp DATETIME NOT NULL
        )
    """)
    
    conn.commit()
    cursor.close()
    conn.close()


def save_result(
    filename: str,
    status: str,
    reason: Optional[str] = None,
    confidence: float = 0.0,
    details: Optional[Dict] = None
) -> Dict:
    """분석 결과 저장"""
    if db_pool is None:
        print("결과 저장 스킵: DB 연결 오류")
        return {}
        
    conn = get_connection()
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    # details는 MySQL의 JSON 타입으로 저장합니다.
    details_json = json.dumps(details) if details else None
    
    cursor.execute("""
        INSERT INTO analysis_results (filename, status, reason, confidence, details, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (filename, status, reason, confidence, details_json, timestamp))
    
    result_id = cursor.lastrowid
    conn.commit()
    cursor.close()
    conn.close()
    
    # 저장된 결과 반환 (main.py의 요구 형식)
    return {
        "id": result_id,
        "filename": filename,
        "status": status,
        "reason": reason,
        "confidence": confidence,
        "details": details, # Python dict 형태로 반환
        "timestamp": timestamp
    }


def get_results(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> List[Dict]:
    """분석 결과 조회"""
    if db_pool is None: return []

    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM analysis_results WHERE 1=1"
    params = []
    
    if status:
        query += " AND status = %s"
        params.append(status)
        
    query += " ORDER BY timestamp DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    # JSON 필드를 Python dict로 변환하여 반환
    results = []
    for row in rows:
        row['details'] = json.loads(row['details']) if row.get('details') else {}
        results.append(row)

    return results


def get_statistics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict:
    """통계 조회"""
    if db_pool is None: return {}

    conn = get_connection()
    cursor = conn.cursor()
    
    # 날짜 필터 조건
    date_filter = ""
    params = []
    if start_date:
        date_filter += " AND timestamp >= %s"
        params.append(start_date)
    if end_date:
        date_filter += " AND timestamp <= %s"
        params.append(end_date)
    
    # 전체 통계 쿼리 (MySQL 문법)
    cursor.execute(f"""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END) as pass_count,
            SUM(CASE WHEN status = 'FAIL' THEN 1 ELSE 0 END) as fail_count
        FROM analysis_results
        WHERE 1=1 {date_filter}
    """, params)
    
    stats_row = cursor.fetchone()
    total = stats_row["total"] or 0
    pass_count = stats_row["pass_count"] or 0
    fail_count = stats_row["fail_count"] or 0
    pass_rate = (pass_count / total * 100) if total > 0 else 0
    
    # Fail 사유별 통계 쿼리
    cursor.execute(f"""
        SELECT reason, COUNT(*) as count
        FROM analysis_results
        WHERE status = 'FAIL' AND reason IS NOT NULL {date_filter}
        GROUP BY reason
        ORDER BY count DESC
    """, params)
    
    fail_reasons = {row["reason"]: row["count"] for row in cursor.fetchall()}
    
    cursor.close()
    conn.close()
    
    return {
        "total": total,
        "pass": pass_count,
        "fail": fail_count,
        "pass_rate": round(pass_rate, 2),
        "fail_reasons": fail_reasons
    }
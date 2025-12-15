# 데이터베이스 리셋 (cd server, python.exe reset_db.py)
import sys
import os

from database.db import get_connection 

def clear_analysis_data():
    """SQLite DB의 analysis_results 테이블의 데이터와 AUTOINCREMENT 카운터를 초기화합니다."""
    print("--- 분석 데이터베이스 초기화 시작 ---")
    
    conn = None # 연결 객체 초기화
    try:
        conn = get_connection() 
        cursor = conn.cursor()
        
        # 1. 모든 데이터 삭제
        cursor.execute("DELETE FROM analysis_results") 
        
        # 2. AUTOINCREMENT 카운터를 1로 재설정 (ID를 0부터 다시 시작)
        cursor.execute("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'analysis_results'")
        
        conn.commit()
        print("✅ 분석 데이터가 초기화되었습니다. ID 카운터도 재설정되었습니다.")

    except Exception as e:
        print(f"🚨 오류 발생: DB 초기화 실패.")
        print(f"DB가 실행 중인지 또는 get_connection() 함수가 올바른 연결을 반환하는지 확인하세요.")
        print(f"오류 내용: {e}")
        sys.exit(1)
        
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    clear_analysis_data()
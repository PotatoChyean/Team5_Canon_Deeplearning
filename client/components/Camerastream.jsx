import { useEffect, useRef, useState } from "react";
import React from 'react'; 

export default function CameraStream() {
  const videoRef = useRef(null); 
  const [status, setStatus] = useState("waiting...");

  useEffect(() => {
    async function initCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // 🚨 [수정]: 널 체크 (Null Check)만 사용하여 안전하게 할당
      if (videoRef.current) {
         videoRef.current.srcObject = stream;
      }
    }
    initCamera();

    const interval = setInterval(async () => {
      // 🚨 [수정]: 널 체크만 유지하고 불필요한 타입 단언을 제거
      if (!videoRef.current) return;
      const videoElement = videoRef.current; 

      // videoElement가 HTMLVideoElement임을 가정하고 속성 사용
      const canvas = document.createElement("canvas");
      canvas.width = videoElement.videoWidth; 
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return; 
      
      ctx.drawImage(videoElement, 0, 0);

      const dataUrl = canvas.toDataURL("image/jpeg");

      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      
      try {
        const res = await fetch(`${API_URL}/api/messages/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frame: dataUrl }),
        });

        const data = await res.json();
        setStatus(data.result || "N/A");
        
      } catch (e) {
        setStatus("Backend Error");
        console.error("Backend fetch failed:", e);
      }
    }, 500);

    // 컴포넌트 언마운트 시 인터벌 및 미디어 트랙 정리
    return () => {
        clearInterval(interval);
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject;
            // 미디어 트랙 정리 (스트림이 MediaStream 객체임을 가정)
            if (stream instanceof MediaStream) {
                stream.getTracks().forEach(track => track.stop());
            }
        }
    };
  }, []);

  // 상태에 따라 동적으로 Tailwind CSS 클래스 적용
  const statusColorClass = status.toLowerCase().includes("pass") 
    ? "text-emerald-500" // PASS 색상
    : status.toLowerCase().includes("fail") || status.toLowerCase().includes("error") 
        ? "text-red-500" // FAIL/ERROR 색상
        : "text-amber-500"; // WAITING/OTHER 색상

  return (
    <div className="p-4 bg-card rounded-xl shadow-lg">
      <video 
        ref={videoRef} 
        autoPlay 
        className="w-full max-w-lg rounded-lg border border-border" 
      />
      
      {/* 하드코딩된 인라인 스타일 대신 Tailwind 클래스 사용 */}
      <h2 className={`text-2xl font-bold mt-4 ${statusColorClass}`}>
        {status}
      </h2>
    </div>
  );
}
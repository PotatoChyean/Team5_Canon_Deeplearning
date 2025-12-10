"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Square } from "lucide-react"

export function LiveCamera({ setIsProcessing, setResults }: any) {
  const [isRunning, setIsRunning] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  // 1. Ref 카운터 추가
  const internalFrameCountRef = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // 컴포넌트 언마운트 시 정리
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return

    // 2. Ref 카운터 증가 및 고유 번호 저장
    internalFrameCountRef.current += 1
    const currentFrameNumber = internalFrameCountRef.current

    // UI 상태 업데이트
    setFrameCount(currentFrameNumber)

    // 캔버스 크기를 비디오 크기에 맞춤
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // 프레임 캡처
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // 이미지로 변환하여 API 호출
    canvas.toBlob(async (blob) => {
      if (!blob) return

      try {
        const formData = new FormData()
        formData.append("file", blob, "frame.jpg")

        const response = await fetch("http://localhost:5000/api/analyze-frame", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`서버 오류: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()

        // 3. 고유 ID 생성 (키 중복 해결) 및 분석 이미지 변수 할당
        const uniqueId = `${Date.now()}-${currentFrameNumber}`;
        const analyzedImageUrl = result.analyzed_image_base64;

        setResults((prev: any[]) => [
          {
            id: uniqueId, // 👈 고유 키 사용
            ...result,
            name: `Frame ${currentFrameNumber}`, // 👈 UI 표시용 번호 사용
            imageUrl: analyzedImageUrl, // 👈 분석된 이미지 URL 사용
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ])
      } catch (error: any) {
        console.error("프레임 분석 오류:", error)
        // 네트워크 오류 처리 로직
        if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
          setError("백엔드 서버 연결 실패")
          // 자동으로 중지
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
          }
          if (videoRef.current) {
            videoRef.current.srcObject = null
          }
          setIsRunning(false)
          setIsProcessing(false)
        }
      }
    }, "image/jpeg", 0.9)
  }

  const handleStartDetection = async () => {
    try {
      // ... (Health Check 로직 유지) ...

      // 카메라 접근
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 800 },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }

      setIsProcessing(true)
      setIsRunning(true)
      // 4. Ref와 상태 모두 초기화
      internalFrameCountRef.current = 0
      setFrameCount(0)
      setError(null)

      // 주기적으로 프레임 캡처 및 분석 (예: 1초마다)
      intervalRef.current = setInterval(() => {
        // setFrameCount((prev) => prev + 1) -> 제거됨. captureFrame 내부에서 처리함
        captureFrame()
      }, 1000)
    } catch (error: any) {
      // ... (오류 처리 로직 유지) ...
    }
  }

  const handleStop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsRunning(false)
    setIsProcessing(false)
    // 5. Ref와 상태 모두 초기화
    internalFrameCountRef.current = 0
    setFrameCount(0)
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Camera Feed Display */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl">
        <div className="aspect-video bg-gradient-to-br from-muted to-card flex items-center justify-center relative overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ display: isRunning ? "block" : "none" }}
          />
          <canvas ref={canvasRef} className="hidden" />
          {!isRunning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center z-10">
                <div className="w-24 h-24 rounded-full border-4 border-blue-500/30 mx-auto mb-4 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-4 border-blue-500/50"></div>
                </div>
                <p className="font-medium text-muted-foreground">카메라 준비 완료 </p>
              </div>
            </div>
          )}
          {isRunning && (
            <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded text-white text-sm">
              Frame: {frameCount}
            </div>
          )}
        </div>

        {/* Camera Info Bar */}
        <div className="bg-card border-t border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>해상도: 1280 × 800</span>
            <span>•</span>
            <span>FPS: 15</span>
            <span>•</span>
            <span>Status: {isRunning ? "녹화 중" : "대기 중"}</span>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-4">
        {!isRunning ? (
          <button
            onClick={handleStartDetection}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-green-500/30"
          >
            <Play className="w-5 h-5" />
            Start Detection
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-500 hover:from-red-700 hover:to-pink-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-red-500/30"
          >
            <Square className="w-5 h-5" />
            Stop Detection
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
          <p className="text-red-200 font-medium">⚠️ {error}</p>
        </div>
      )}

      {/* Analysis Indicator */}
      {isRunning && !error && (
        <div className="bg-card border border-text-foreground rounded-lg p-4 text-center">
          <p className="text-blue-200 font-medium animate-pulse">Analyzing frames, please wait...</p>
        </div>
      )}
    </div>
  )
}
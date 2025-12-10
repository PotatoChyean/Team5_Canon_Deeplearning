"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Square } from "lucide-react"

export function LiveCamera({ setIsProcessing, setResults }: any) {
  const [isRunning, setIsRunning] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
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
        // 실시간 결과를 results에 추가할 수 있음
        // setResults((prev: any[]) => [...prev, { ...result, name: `Frame ${frameCount}` }])
      } catch (error: any) {
        console.error("프레임 분석 오류:", error)
        // 네트워크 오류인 경우 사용자에게 알림
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
      // 먼저 백엔드 서버 연결 확인
      setError(null)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000) // 3초 타임아웃
        
        const healthCheck = await fetch("http://localhost:5000/health", {
          method: "GET",
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        
        if (!healthCheck.ok) {
          throw new Error("서버가 응답하지 않습니다")
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          setError("백엔드 서버 연결 시간 초과")
          alert("백엔드 서버에 연결할 수 없습니다 (시간 초과).\n\n확인 사항:\n1. 백엔드 서버가 실행 중인지 확인 (http://localhost:5000)\n2. 터미널에서 'python main.py' 실행\n3. 방화벽이 포트 5000을 차단하지 않는지 확인")
        } else {
          setError("백엔드 서버에 연결할 수 없습니다")
          alert("백엔드 서버에 연결할 수 없습니다.\n\n확인 사항:\n1. 백엔드 서버가 실행 중인지 확인 (http://localhost:5000)\n2. 터미널에서 'python main.py' 실행\n3. 브라우저 콘솔(F12)에서 자세한 오류 확인")
        }
        return
      }

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
      setFrameCount(0)
      setError(null)

      // 주기적으로 프레임 캡처 및 분석 (예: 1초마다)
      intervalRef.current = setInterval(() => {
        setFrameCount((prev) => prev + 1)
        captureFrame()
      }, 1000) // 1초마다 분석
    } catch (error: any) {
      console.error("카메라 접근 오류:", error)
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        alert("카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라 권한을 허용해주세요.")
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        alert("카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인하세요.")
      } else {
        alert(`카메라 접근 오류: ${error.message}`)
      }
      setIsProcessing(false)
      setIsRunning(false)
      setError(error.message)
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
                      <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded text-foreground text-sm">
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

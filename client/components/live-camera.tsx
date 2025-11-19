"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Square } from "lucide-react"

export function LiveCamera({ setIsProcessing, setResults }: any) {
  const [isRunning, setIsRunning] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
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

        if (response.ok) {
          const result = await response.json()
          // 실시간 결과를 results에 추가할 수 있음
          // setResults((prev: any[]) => [...prev, { ...result, name: `Frame ${frameCount}` }])
        }
      } catch (error) {
        console.error("프레임 분석 오류:", error)
      }
    }, "image/jpeg", 0.9)
  }

  const handleStartDetection = async () => {
    try {
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

      // 주기적으로 프레임 캡처 및 분석 (예: 1초마다)
      intervalRef.current = setInterval(() => {
        setFrameCount((prev) => prev + 1)
        captureFrame()
      }, 1000) // 1초마다 분석
    } catch (error) {
      console.error("카메라 접근 오류:", error)
      alert("카메라 접근 권한이 필요합니다.")
      setIsProcessing(false)
      setIsRunning(false)
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
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center relative overflow-hidden">
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
                <p className="text-slate-300 font-medium">Camera Ready - 1280×800</p>
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
        <div className="bg-slate-900 border-t border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>Resolution: 1280×800</span>
            <span>•</span>
            <span>FPS: 15</span>
            <span>•</span>
            <span>Status: {isRunning ? "Recording" : "Idle"}</span>
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

      {/* Analysis Indicator */}
      {isRunning && (
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 text-center">
          <p className="text-blue-200 font-medium animate-pulse">Analyzing frames, please wait...</p>
        </div>
      )}
    </div>
  )
}

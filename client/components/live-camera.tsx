"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Square } from "lucide-react"


export function LiveCamera({ setIsProcessing, setResults, onDownload }: any) {
    const [isRunning, setIsRunning] = useState(false)
    const [frameCount, setFrameCount] = useState(0)
    const [isStreamReady, setIsStreamReady] = useState(false)
    
    const BRIGHTNESS_MAX = 50; // 이전 코드의 기준값
    const EXPOSURE_MAX = 2.0; 
    
    const [brightness, setBrightness] = useState(0); 
    const [exposure, setExposure] = useState(1.0); 

    const internalFrameCountRef = useRef(0)
    const [error, setError] = useState<string | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    // --- 카메라 스트림 제어 함수 ---

    const stopCameraStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
        setIsStreamReady(false)
    }

    const startCameraStream = useCallback(async () => {
        try {
            setError(null)
            if (streamRef.current) return
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 800 },
            })

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                streamRef.current = stream
                setIsStreamReady(true)
            }
            setIsProcessing(false) 

        } catch (err: any) {
            console.error("카메라 접근 오류:", err)
            setError("카메라 접근 불가: 권한을 확인하거나 다른 앱에서 사용 중이 아닌지 확인하세요.")
            stopCameraStream()
            setIsStreamReady(false)
        }
    }, [setIsProcessing])


    const handleStop = useCallback((stopStream: boolean) => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
        
        if (stopStream) {
            stopCameraStream()
        }

        setIsRunning(false)
        setIsProcessing(false)
        internalFrameCountRef.current = 0
        setFrameCount(0)
    }, [setIsProcessing])


    useEffect(() => {
        startCameraStream()
        return () => {
            handleStop(true) 
        }
    }, [startCameraStream, handleStop])


 
    const handleDownloadImage = (imageUrl: string, fileName: string) => {
        try {
            if (!imageUrl) {
                console.error("다운로드할 이미지 URL이 없습니다.");
                alert("다운로드할 이미지가 없습니다.");
                return;
            }

            // <a> 태그를 동적으로 생성하여 다운로드 트리거
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = fileName; // 파일 이름 설정

            // DOM에 추가 후 클릭하여 다운로드 시작, 바로 제거
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("이미지 다운로드 오류:", error);
            alert("이미지 다운로드에 실패했습니다.");
        }
    };
    
    // --- 프레임 캡처 및 분석 함수 ---
    
    const captureFrame = async () => {
        if (!videoRef.current || !canvasRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")

        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return

        internalFrameCountRef.current += 1
        const currentFrameNumber = internalFrameCountRef.current
        setFrameCount(currentFrameNumber)

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(async (blob) => {
            if (!blob) return

            try {
                const formData = new FormData()
                formData.append("file", blob, "frame.jpg")
                formData.append("brightness", brightness.toString())
                formData.append("exposure_gain", exposure.toString()) 

                const response = await fetch("http://localhost:5000/api/analyze-frame", {
                    method: "POST",
                    body: formData,
                })

                if (!response.ok) {
                    throw new Error(`서버 오류: ${response.status} ${response.statusText}`)
                }

                const result = await response.json()

                const uniqueId = `${Date.now()}-${currentFrameNumber}`;
                // 백엔드가 처리한 이미지 URL 또는 Base64 데이터
                const analyzedImageUrl = result.analyzed_image_base64 || result.details?.annotated_image; 
                
                setResults((prev: any[]) => [
                    {
                        id: uniqueId, 
                        ...result,
                        name: `Frame ${currentFrameNumber}`, 
                        // imageUrl 필드가 base64로 오면 앞에 접두사 추가
                        imageUrl: analyzedImageUrl ? `data:image/jpeg;base64,${analyzedImageUrl}` : null, 
                        timestamp: new Date().toLocaleTimeString(),
                        brightness: brightness, 
                        exposure: exposure, 
                    },
                    ...prev,
                ])
            } catch (error: any) {
                console.error("프레임 분석 오류:", error)
                if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
                    setError("백엔드 서버 연결 실패")
                    handleStop(true) // 서버 오류 시 완전히 멈춤
                }
            }
        }, "image/jpeg", 0.9)
    }

    // --- 감지 시작/중지 핸들러 ---

    const handleStartDetection = async () => {
        
        if (!streamRef.current) {
            await startCameraStream() 
            if (!streamRef.current) {
                setError("카메라 스트림을 시작할 수 없습니다. 권한을 확인해 주세요.")
                return
            }
        }

        // 1. 백엔드 서버 연결 확인
        setError(null)
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 3000) 
            
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
                alert("백엔드 서버에 연결할 수 없습니다 (시간 초과).")
            } else {
                setError("백엔드 서버에 연결할 수 없습니다")
                alert("백엔드 서버에 연결할 수 없습니다.")
            }
            return 
        }

        // 서버 연결 성공, 감지 시작 로직
        setIsProcessing(true)
        setIsRunning(true)
        internalFrameCountRef.current = 0
        setFrameCount(0)

        // 주기적으로 프레임 캡처 및 분석 (1초마다)
        intervalRef.current = setInterval(() => {
            captureFrame()
        }, 1000)
    }
    
    // --- 렌더링 ---

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
                        style={{ filter: `brightness(${(100 + brightness * 2)}%) contrast(${exposure})` }} 
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* 미리보기 화면이 준비되지 않았거나 (에러), 감지 중이 아닐 때의 오버레이 */}
                    {!streamRef.current && !error && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center z-10">
                                <div className="w-24 h-24 rounded-full border-4 border-blue-500/30 mx-auto mb-4 flex items-center justify-center">
                                    <div className="w-20 h-20 rounded-full border-4 border-blue-500/50"></div>
                                </div>
                                <p className="font-medium text-muted-foreground">카메라 준비 중...</p>
                            </div>
                        </div>
                    )}
                    
                    {/* Error Message Overlay */}
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                            <p className="text-red-400 font-bold text-lg p-4 border border-red-500 rounded-lg">
                                ⚠️ {error}
                            </p>
                        </div>
                    )}

                    {/* Frame Count는 isRunning일 때만 표시 */}
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
                        <span>Status: {isRunning ? "감지 중" : streamRef.current ? "미리보기" : "대기 중"}</span>
                    </div>
                </div>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-4">
                {!isRunning ? (
                    <button
                        onClick={handleStartDetection}
                        disabled={!streamRef.current || !!error} 
                        className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-green-500/30 ${!streamRef.current || !!error ? 'opacity-50 cursor-not-allowed' : 'hover:from-green-700 hover:to-emerald-600'}`}
                    >
                        <Play className="w-5 h-5" />
                        분석 시작
                    </button>
                ) : (
                    <button
                        onClick={() => handleStop(false)} 
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-500 hover:from-red-700 hover:to-pink-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-red-500/30"
                    >
                        <Square className="w-5 h-5" />
                        Stop Detection
                    </button>
                )}
            </div>
            
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">이미지 보정</h3>

                {/* 명도 (Brightness) 조절 */}
                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                        명도: <span className="text-foreground font-mono">{brightness}</span>
                    </label>
                    <input
                        type="range"
                        min={-BRIGHTNESS_MAX}
                        max={BRIGHTNESS_MAX}
                        step={5} 
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        disabled={isRunning || !streamRef.current}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>어둡게 ({-BRIGHTNESS_MAX})</span>
                        <span>기본 (0)</span>
                        <span>밝게 ({BRIGHTNESS_MAX})</span>
                    </div>
                </div>

                {/* 조도/대비 (Exposure/Gain) 조절 */}
                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                        조도: <span className="text-foreground font-mono">{exposure.toFixed(1)}</span>
                    </label>
                    <input
                        type="range"
                        min={0} 
                        max={EXPOSURE_MAX}
                        step={0.1}
                        value={exposure}
                        onChange={(e) => setExposure(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        disabled={isRunning || !streamRef.current}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>최저 ({0})</span>
                        <span>기본 (1.0)</span>
                        <span> ({EXPOSURE_MAX})</span>
                    </div>
                </div>
                
                <p className="text-xs text-yellow-500">
                    ⚠️ 조절은 감지 시작 전에만 가능합니다. (분석 중에는 변경 불가)
                </p>
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
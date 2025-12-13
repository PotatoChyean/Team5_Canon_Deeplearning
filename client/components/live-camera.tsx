"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Square } from "lucide-react"

export function LiveCamera({ setIsProcessing, setResults }: any) {
    const [isRunning, setIsRunning] = useState(false)
    const [frameCount, setFrameCount] = useState(0)
    const [isStreamReady, setIsStreamReady] = useState(false)

    // 💡 명도(brightness, -50~50) 및 조도/대비(exposure, 0~2.0) 상태
    const BRIGHTNESS_MAX = 50;
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

    // --- Effect: 컴포넌트 마운트 시 스트림 자동 시작 및 언마운트 시 정리 ---

    useEffect(() => {
        startCameraStream()
        return () => {
            handleStop(true)
        }
    }, [startCameraStream, handleStop])

    // --- Polling 보조 함수 ---

    const processCompletedFrame = (result: any, currentFrameNumber: number) => {
        // Base64 이미지 처리 및 결과 5개만 유지 로직
        const analyzedImageUrl = result.processed_image_b64 || result.details?.annotated_image;

        setResults((prev: any[]) => {
            const newResult = {
                id: `${Date.now()}-${currentFrameNumber}`,
                ...result,
                name: `Frame ${currentFrameNumber}`,
                // 이미지 표시를 위한 Base64 접두사 (백엔드에서 받은 결과는 이미 base64 인코딩 상태)
                imageUrl: analyzedImageUrl ? `data:image/jpeg;base64,${analyzedImageUrl}` : null,
                timestamp: new Date().toLocaleTimeString(),
                brightness: brightness,
                exposure: exposure,
            };
            // 결과는 최대 5개만 유지 (성능 최적화)
            const updatedResults = [newResult, ...prev];
            return updatedResults.slice(0, 5);
        });
    }

    const pollForFrameResult = (frameId: string, currentFrameNumber: number) => {
        return new Promise<void>((resolve) => {
            const intervalId = setInterval(async () => {
                try {
                    // 백엔드 Polling 엔드포인트 호출
                    const res = await fetch(`http://localhost:5000/api/frame-progress/${frameId}`);
                    const data = await res.json();

                    if (data.status === "COMPLETED") {
                        clearInterval(intervalId);
                        processCompletedFrame(data.result.result, currentFrameNumber);
                        resolve();

                    } else if (data.status === "ERROR" || data.status === "NOT_FOUND") {
                        clearInterval(intervalId);
                        setError(`프레임 분석 오류: ${data.result?.reason || '처리 실패'}`);
                        resolve();
                    }

                } catch (err) {
                    console.error("Polling 중 네트워크 오류:", err);
                }
            }, 500); // 500ms 간격으로 Polling

            // 최대 10초 타임아웃
            setTimeout(() => {
                clearInterval(intervalId);
                console.warn(`Frame ${currentFrameNumber} Polling Timeout`);
                resolve();
            }, 10000);
        });
    }


    // --- 프레임 캡처 및 분석 함수 (핵심 Polling 시작) ---

    const captureFrame = async () => {
        // [디버그] 캡처 시도 로그
        console.log(`[DEBUG] Capturing Frame: ${internalFrameCountRef.current + 1}`);

        if (!videoRef.current || !canvasRef.current || !isRunning) return

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")

        // 비디오 준비 상태 체크
        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
            console.warn(`[WARN] Video not ready. ReadyState: ${video.readyState}`);
            return
        }

        internalFrameCountRef.current += 1
        const currentFrameNumber = internalFrameCountRef.current
        setFrameCount(currentFrameNumber)

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // 🚨 Blob 생성 실패 시 문제가 발생하므로, PNG로 변환하고 오류 처리 강화
        canvas.toBlob(async (blob) => {
            
            if (!blob) {
                // Blob 생성 실패 시 UI 오류 표시 및 종료
                console.error("[ERROR] FATAL: Canvas to Blob conversion failed.");
                setError("카메라 프레임 데이터 생성 실패 (코덱 또는 권한 문제). 감지를 중지합니다.");
                handleStop(true); 
                return
            }

            console.log(`[DEBUG] Blob created successfully. Size: ${blob.size}`);
            
            try {
                // FormData 준비
                const formData = new FormData()
                formData.append("file", blob, "frame.png") // 🚨 PNG로 전송
                formData.append("brightness", brightness.toString())
                formData.append("exposure_gain", exposure.toString())

                // 1. 분석 시작 요청 (Polling 시작점)
                const response = await fetch("http://localhost:5000/api/analyze-frame", {
                    method: "POST",
                    body: formData,
                })

                if (!response.ok) {
                    throw new Error(`서버 오류: ${response.status} ${response.statusText}`)
                }

                const start_result = await response.json()
                const frameId = start_result.frame_id // Polling에 사용할 ID
                console.log(`[DEBUG] Polling started for Frame ID: ${frameId}`);

                if (start_result.status === "STARTED") {
                    // 2. Polling 시작 및 결과 대기
                    await pollForFrameResult(frameId, currentFrameNumber)
                }

            } catch (error: any) {
                console.error("프레임 분석 오류:", error)
                if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
                    setError("백엔드 서버 연결 실패")
                    handleStop(true)
                } else if (error.message === "Canvas Blob 생성 실패") {
                     // 이미 처리됨
                }
            }
        }, "image/png") // 🚨 PNG 형식 사용
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
        captureFrame() // 즉시 첫 프레임 실행
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
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                        style={{ filter: `brightness(${(100 + brightness * 2)}%) contrast(${exposure})` }}
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* ... (오버레이 및 UI 로직 유지) ... */}
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

            {/* 명도/조도 조절 UI */}
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
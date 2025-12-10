"use client"

import { CheckCircle, AlertCircle } from "lucide-react"
import { useState } from "react"

export function ResultsGrid({ results }: any) {
    // ✅ [수정] 1. 훅 호출 위치 수정: 컴포넌트 본문 내부로 이동 (Hook Rules 준수)
    // LiveCamera에서 넘어오는 결과를 처리하기 위해 File 대신 결과 객체를 저장합니다.
    const [selectedImageResult, setSelectedImageResult] = useState<any | null>(null)

    if (results.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">No results yet. Start analysis to see results here.</p>
            </div>
        )
    }

    // File → Blob URL 생성 함수 (유지)
    const getBlobURL = (file: File) => URL.createObjectURL(file)

    // 상태 상세 정보를 렌더링하는 헬퍼 컴포넌트 (유지)
    const StatusDetail = ({ label, status }: { label: string, status: string }) => {
        if (!status) return null;

        const isPass = status.toLowerCase() === "pass";
        const statusClass = isPass ? "text-emerald-400" : "text-red-400";

        return (
            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}:</span>
                <span className={`font-medium ${statusClass}`}>
                    {status}
                </span>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex gap-4 justify-between items-center">
                <h2 className="text-2xl font-bold text-foreground">Analysis Results</h2>
                <select
                    className="px-4 py-2 bg-card border border-border text-card-foreground rounded-lg text-sm"
                >
                    <option>All</option>
                    <option>PASS</option>
                    <option>FAIL</option>
                </select>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((result: any) => {

                    // 🚨 [추가] 이미지 소스 결정
                    const imageSource = result.imageUrl
                        ? result.imageUrl // LiveCamera (Base64 URL)
                        : (result.file ? getBlobURL(result.file) : null); // File Upload (Blob URL)

                    return (
                        <div
                            key={result.id}
                            className="bg-card border border-border rounded-lg overflow-hidden hover:border-accent transition-all hover:shadow-lg hover:shadow-slate-900/50"
                        >
                            {/* Thumbnail */}
                            <div
                                className="aspect-square bg-background flex items-center justify-center relative overflow-hidden cursor-pointer group"
                                // 🚨 [수정 2] onClick 핸들러: imageSource가 있을 때만 모달 상태 업데이트
                                onClick={() => imageSource && setSelectedImageResult(result)}
                            >
                                {imageSource ? (
                                    <>
                                        <img
                                            // 🚨 [수정 3] src: imageSource 사용 (Base64 또는 Blob)
                                            src={imageSource}
                                            alt={result.name}
                                            className="w-full h-full object-cover"
                                            // Blob URL 사용 시에만 revokeObjectURL 호출
                                            onLoad={(e) => {
                                                if (result.file) URL.revokeObjectURL(e.currentTarget.src)
                                            }}
                                            onError={() => console.error("이미지 로드 실패:", result.name)}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                            <p className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                클릭하여 확대
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center z-10">
                                        <p className="text-xs text-muted-foreground">이미지 없음</p>
                                    </div>
                                )}
                            </div>

                            {/* Info Area (유지) */}
                            <div className="p-4 space-y-3">
                                <p className="text-sm font-medium text-card-foreground truncate">{result.name}</p>

                                {/* ... (상태 표시 로직 유지) ... */}

                                {result.reason && (
                                    <p
                                        className="text-muted-foreground bg-muted/50 px-2 py-1 rounded text-xs"
                                    >
                                        {result.reason}
                                    </p>
                                )}

                                {/* 상세 정보 */}
                                {result.details && (
                                    <div
                                        className="space-y-1 pt-2 border-t border-border"
                                    >
                                        <StatusDetail label="HOME" status={result.details.home_status} />
                                        <StatusDetail label="ID/BACK" status={result.details.id_back_status} />
                                        <StatusDetail label="STATUS" status={result.details.status_status} />
                                        <StatusDetail label="Screen" status={result.details.screen_status} />
                                    </div>
                                )}

                                <div
                                    className="flex items-center justify-between pt-2 border-t border-border"
                                >
                                    <span className="text-xs text-muted-foreground">신뢰도</span>
                                    <span className="text-sm font-semibold text-cyan-400">
                                        {result.confidence}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Image Modal */}
            {/* 🚨 [수정 4] 모달 렌더링: selectedImageResult 사용 */}
            {selectedImageResult && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedImageResult(null)} // 모달 닫기 핸들러
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <img
                            // 🚨 [수정 5] 모달 이미지 소스
                            src={selectedImageResult.imageUrl ? selectedImageResult.imageUrl : getBlobURL(selectedImageResult.file)}
                            alt="확대 이미지"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                            // Blob URL만 revokeObjectURL 호출
                            onLoad={(e) => {
                                if (selectedImageResult.file) URL.revokeObjectURL(e.currentTarget.src)
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />

                        <button
                            onClick={() => setSelectedImageResult(null)}
                            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
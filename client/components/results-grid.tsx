"use client"

import { CheckCircle, AlertCircle } from "lucide-react"
import { useState } from "react"

interface AnalysisResult {
    id: string;
    name: string; 
    status: string;
    reason?: string;
    confidence: number;
    details: any;
    file?: File;
    processed_image_b64?: string; 
    imageUrl?: string; 
}
interface ResultsGridProps {
    results: AnalysisResult[]; 
}


// 상태 상세 정보 렌더링 헬퍼 컴포넌트
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

export function ResultsGrid({ results }: ResultsGridProps) {
    const [selectedImageResult, setSelectedImageResult] = useState<AnalysisResult | null>(null)
    const getBlobURL = (file: File) => URL.createObjectURL(file)

    // 이미지 소스 결정 로직 통일 및 함수 정의 (Base64 우선, Live URL, Blob 순)
    const getImageSrc = (result: AnalysisResult) => {
        if (result.details?.annotated_image) {
        return `data:image/jpeg;base64,${result.details.annotated_image}`;
    }
        if (result.processed_image_b64) {
            return `data:image/jpeg;base64,${result.processed_image_b64}`;
        }
        if (result.imageUrl) {
            return result.imageUrl;
        }
        if (result.file) {
            return getBlobURL(result.file);
        }
        return "";
    }

    // 결과 없음 처리만 단독으로 실행
    if (results.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">No results yet. Start analysis to see results here.</p>
            </div>
        )
    }

    // 단일 리턴 블록 (Shadcn/ui 테마 적용된 로직 기반)
    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header and Filter */}
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
                {results.map((result: AnalysisResult) => { 
                    const imageSource = getImageSrc(result); 

                    return (
                        <div
                            key={result.id}
                            className="bg-card border border-border rounded-lg overflow-hidden hover:border-accent transition-all hover:shadow-lg hover:shadow-slate-900/50"
                        >
                            {/* Thumbnail */}
                            <div
                                className="aspect-square bg-background flex items-center justify-center relative overflow-hidden cursor-pointer group"
                                onClick={() => imageSource && setSelectedImageResult(result)}
                            >
                                {imageSource ? (
                                    <>
                                        <img
                                            src={imageSource}
                                            alt={result.name}
                                            className="w-full h-full object-cover"
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

                            {/* Info Area */}
                            <div className="p-4 space-y-3">
                                <p className="text-sm font-medium text-card-foreground truncate">{result.name}</p>

                                <div className="flex items-center gap-2">
                                    {result.status === "PASS" ? (
                                        <>
                                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                                            <span className="text-sm font-semibold text-emerald-400">PASS</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                            <span className="text-sm font-semibold text-red-400">FAIL</span>
                                        </>
                                    )}
                                </div>

                                {result.reason && (
                                    <p 
                                        className="text-muted-foreground bg-muted/50 px-2 py-1 rounded text-xs"
                                    >
                                        {result.reason}
                                    </p>
                                )}

                                {/* 상세 정보 (StatusDetail 헬퍼 사용) */}
                                {result.details && (
                                    <div className="space-y-1 pt-2 border-t border-border">
                                        <StatusDetail label="HOME" status={result.details.home_status} />
                                        <StatusDetail label="ID/BACK" status={result.details.id_back_status} />
                                        <StatusDetail label="STATUS" status={result.details.status_status} />
                                        <StatusDetail label="Screen" status={result.details.screen_status} />
                                        <StatusDetail label="Model Check" status={result.details.model_status} /> <br></br>
                                        {result.details?.product_model && (
                                    <p className="text-sm text-foreground bg-secondary px-2 py-1 rounded-sm border border-border">
                                        PRODUCT MODEL: {result.details.product_model}
                                    </p>
                                )}
                                    </div>
                                )}

                                {/* 신뢰도 */}
                                <div className="flex items-center justify-between pt-2 border-t border-border">
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
            {selectedImageResult && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedImageResult(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <img
                            src={getImageSrc(selectedImageResult)} 
                            alt="확대 이미지"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
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
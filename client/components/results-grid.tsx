"use client"

import { CheckCircle, AlertCircle } from "lucide-react"
import { useState } from "react"

export function ResultsGrid({ results }: any) {
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)

    if (results.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">No results yet. Start analysis to see results here.</p>
            </div>
        )
    }

    // File → Blob URL 생성 함수
    const getBlobURL = (file: File) => URL.createObjectURL(file)

    // 상태 상세 정보를 렌더링하는 헬퍼 컴포넌트
    const StatusDetail = ({ label, status }: { label: string, status: string }) => {
        if (!status) return null; 
        
        const isPass = status.toLowerCase() === "pass"; 
        const statusClass = isPass ? "text-emerald-400" : "text-red-400";

        return (
            <div className="flex items-center justify-between text-xs">
                {/* 🚨 수정: text-slate-500 -> text-muted-foreground */}
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
                {/* 🚨 수정: text-white -> text-foreground */}
                <h2 className="text-2xl font-bold text-foreground">Analysis Results</h2>
                <select 
                    // 🚨 수정: bg-slate-800, border-slate-700, text-slate-300 -> bg-card, border-border, text-card-foreground
                    className="px-4 py-2 bg-card border border-border text-card-foreground rounded-lg text-sm"
                >
                    <option>All</option>
                    <option>PASS</option>
                    <option>FAIL</option>
                </select>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((result: any) => (
                    <div
                        key={result.id}
                        // 🚨 수정: bg-slate-800, border-slate-700, hover:border-slate-600 -> bg-card, border-border, hover:border-accent
                        className="bg-card border border-border rounded-lg overflow-hidden hover:border-accent transition-all hover:shadow-lg hover:shadow-slate-900/50"
                    >
                        {/* Thumbnail */}
                        <div
                            // 🚨 수정: bg-gradient-to-br from-slate-900 to-slate-950 -> bg-background
                            className="aspect-square bg-background flex items-center justify-center relative overflow-hidden cursor-pointer group"
                            onClick={() => result.file && setSelectedImageFile(result.file)}
                        >
                            {result.file ? (
                                <>
                                    {/* ... 이미지 태그는 유지 ... */}
                                    <img
                                        src={getBlobURL(result.file)}
                                        alt={result.name}
                                        className="w-full h-full object-cover"
                                        onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                                        onError={() => console.error("이미지 로드 실패:", result.name)}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                        {/* 🚨 수정: text-white -> text-foreground (오버레이 위) */}
                                        <p className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            클릭하여 확대
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center z-10">
                                    {/* 🚨 수정: text-slate-500 -> text-muted-foreground */}
                                    <p className="text-xs text-muted-foreground">이미지 없음</p>
                                </div>
                            )}
                        </div>

                        {/* Info Area */}
                        <div className="p-4 space-y-3">
                            {/* 🚨 수정: text-slate-300 -> text-card-foreground */}
                            <p className="text-sm font-medium text-card-foreground truncate">{result.name}</p>

                            <div className="flex items-center gap-2">
                                {/* PASS/FAIL 상태 색상은 유지 */}
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
                                    // 🚨 수정: text-slate-400, bg-slate-900/50 -> text-muted-foreground, bg-muted/50
                                    className="text-muted-foreground bg-muted/50 px-2 py-1 rounded text-xs"
                                >
                                    {result.reason}
                                </p>
                            )}

                            {/* 상세 정보 */}
                            {result.details && (
                                <div 
                                    // 🚨 수정: border-slate-700 -> border-border
                                    className="space-y-1 pt-2 border-t border-border"
                                >
                                    {/* 1. HOME */}
                                    <StatusDetail label="HOME" status={result.details.home_status} />
                                    
                                    {/* 2. ID/BACK */}
                                    <StatusDetail label="ID/BACK" status={result.details.id_back_status} />
                                    
                                    {/* 3. STATUS */}
                                    <StatusDetail label="STATUS" status={result.details.status_status} />
                                    
                                    {/* 4. SCREEN */}
                                    <StatusDetail label="Screen" status={result.details.screen_status} />
                                    
                                </div>
                            )}

                            <div 
                                // 🚨 수정: border-slate-700 -> border-border
                                className="flex items-center justify-between pt-2 border-t border-border"
                            >
                                {/* 🚨 수정: text-slate-500 -> text-muted-foreground */}
                                <span className="text-xs text-muted-foreground">신뢰도</span>
                                {/* Confidence 색상은 유지 */}
                                <span className="text-sm font-semibold text-cyan-400">
                                    {result.confidence}%
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Image Modal */}
            {selectedImageFile && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedImageFile(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <img
                            src={getBlobURL(selectedImageFile)}
                            alt="확대 이미지"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                            onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                            onClick={(e) => e.stopPropagation()}
                        />

                        <button
                            onClick={() => setSelectedImageFile(null)}
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
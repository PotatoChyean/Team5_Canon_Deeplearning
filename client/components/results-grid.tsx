"use client"

import { CheckCircle, AlertCircle, File as FileIcon } from "lucide-react"

export function ResultsGrid({ results }: any) {
    if (results.length === 0) {
        return (
            <div className="text-center py-12">
                {/* 🚨 [수정]: 텍스트 색상을 CSS 변수로 변경 */}
                <p className="text-muted-foreground">No results yet. Start analysis to see results here.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex gap-4 justify-between items-center">
                {/* 🚨 [수정]: 텍스트 색상을 CSS 변수로 변경 */}
                <h2 className="text-2xl font-bold text-foreground">Analysis Results</h2>
                {/* 🚨 [수정]: 셀렉트 박스 배경 및 텍스트 색상을 CSS 변수로 변경 */}
                <select className="px-4 py-2 bg-card border border-border text-foreground rounded-lg text-sm">
                    <option>All</option>
                    <option>PASS</option>
                    <option>FAIL</option>
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((result: any) => (
                    <div
                        key={result.id}
                        // 🚨 [수정]: 배경, 테두리, 그림자 CSS 변수로 변경
                        className="bg-card border border-border rounded-lg overflow-hidden hover:border-muted hover:shadow-lg hover:shadow-card/50 transition-all"
                    >
                        {/* Thumbnail */}
                        <div className="aspect-square bg-gradient-to-br from-card to-background flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 opacity-20">
                                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_30%,rgba(255,255,255,.1)_50%,transparent_70%)]"></div>
                            </div>
                            <div className="text-center z-10">
                                {result.previewUrl ? (
                                    <img src={result.previewUrl} alt={result.name} className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                    // 🚨 [수정]: 텍스트 색상을 CSS 변수로 변경
                                    <FileIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                )}
                                {/* 🚨 [수정]: 텍스트 색상을 CSS 변수로 변경 */}
                                <p className="text-xs text-muted-foreground z-20 absolute bottom-2 left-1/2 transform -translate-x-1/2">
                                    {result.previewUrl ? '' : 'No Preview'}
                                </p>
                            </div>
                        </div>

                        {/* Result Info */}
                        <div className="p-4 space-y-3">
                            <div className="truncate">
                                {/* 🚨 [수정]: 텍스트 색상을 CSS 변수로 변경 */}
                                <p className="text-sm font-medium text-foreground truncate">{result.name}</p>
                            </div>

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

                            {/* FAIL 사유 표시 로직 */}
                            {result.reason != null && (
                                <p className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                                    {result.reason || "N/A (사유 없음)"}
                                </p>
                            )}
                            <div className="flex items-center justify-between pt-2 border-t border-border">
                                {/* 🚨 [수정]: 텍스트 색상을 CSS 변수로 변경 */}
                                <span className="text-xs text-muted-foreground">Confidence</span>
                                <span className="text-sm font-semibold text-cyan-400">{result.confidence}%</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// 🚨 [삭제]: 사용되지 않는 File 컴포넌트 정의 제거
/*
function File({ className }: { className: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" />
}
*/
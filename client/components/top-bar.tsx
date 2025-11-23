"use client"

import { Clock } from "lucide-react"

// 🚨 [추가]: Props 인터페이스 정의
interface TopBarProps {
    isProcessing: boolean;
    completedCount: number;
    uploadedCount: number;
}

// 🚨 [수정]: props를 구조 분해하여 사용
export function TopBar({ isProcessing, completedCount, uploadedCount }: TopBarProps) {
    return (
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div
                        className={`w-3 h-3 rounded-full transition-colors ${isProcessing ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}
                    ></div>
                    <span className="text-sm font-medium text-slate-300">
                        Status: <span className="text-white">
                            {/* 🚨 [수정]: completedCount와 uploadedCount를 사용하여 진행률 표시 */}
                            {isProcessing
                                ? `로딩중.... ${completedCount} / ${uploadedCount} 완료`
                                : "Idle"}
                        </span>
                    </span>
                </div>
            </div>
            {/* Last run 섹션은 변경 없음 */}
            <div className="flex items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Last run: 2 hours ago</span>
                </div>
            </div>
        </div>
    )
}
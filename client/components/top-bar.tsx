"use client"

import { Clock } from "lucide-react"
import { Progress } from "@/components/ui/progress"

// Props 인터페이스 정의 (변경 없음)
interface TopBarProps {
    isProcessing: boolean;
    completedCount: number;
    uploadedCount: number;
}

// 🚨 [수정]: props를 구조 분해하여 사용
export function TopBar({ isProcessing, completedCount, uploadedCount }: TopBarProps) {
    const progressValue = uploadedCount > 0 ? (completedCount / uploadedCount) * 100 : 0;

    return (
        // 🚨 [수정]: 배경(bg-card), 테두리(border-border) 색상을 CSS 변수로 변경
        <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4 w-1/3">
                {isProcessing ? (
                    <div className="w-full">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-amber-500">Processing...</span>
                            <span className="text-sm font-medium text-muted-foreground">{completedCount} / {uploadedCount}</span>
                        </div>
                        <Progress value={progressValue} className="w-full h-2" />
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <span className="text-sm font-medium text-muted-foreground">
                            Status: <span className="text-foreground">Ready</span>
                        </span>
                    </div>
                )}
            </div>
            {/* Last run 섹션 */}
            <div className="flex items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {/* 🚨 [수정]: Last run 텍스트 색상 (text-muted-foreground)을 CSS 변수로 변경 */}
                    <span className="text-muted-foreground">Last run: 2 hours ago</span>
                </div>
            </div>
        </div>
    )
}
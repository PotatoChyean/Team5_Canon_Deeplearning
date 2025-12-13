"use client"

import { Clock } from "lucide-react"
import { Progress } from "@/components/ui/progress"

// Props 인터페이스 정의 (변경 없음)
interface TopBarProps {
    isProcessing: boolean;
    completedCount: number;
    uploadedCount: number;
    lastRunTime: string | number; // 문자열 (예: 'N/A' 또는 'YYYY-MM-DD HH:mm:ss') 또는 숫자 (타임스탬프)
}

// 🚨 [수정]: lastRunTime prop을 구조 분해하여 사용
export function TopBar({ isProcessing, completedCount, uploadedCount, lastRunTime }: TopBarProps) {
    const progressValue = uploadedCount > 0 ? (completedCount / uploadedCount) * 100 : 0;
    
    // lastRunTime을 표시할 문자열로 변환하는 함수 (필요에 따라 복잡하게 구현 가능)
    const formatLastRunTime = (time: string | number) => {
        if (time === 'N/A' || time === 0) {
            return 'Never run';
        }
        // 만약 time이 Date 객체의 문자열 포맷(예: "Wed Dec 10 2025 10:00:00 GMT+0900")이라고 가정하고 변환
        // 실제 프로젝트에서는 라이브러리(date-fns, moment)를 사용하는 것이 좋습니다.
        try {
            if (typeof time === 'string') {
                return new Date(time).toLocaleString();
            }
            if (typeof time === 'number') {
                return new Date(time).toLocaleString();
            }
        } catch (e) {
            return String(time);
        }
        return 'Invalid time';
    };
    
    // 🚨 [수정]: lastRunTime 값에 따라 표시할 텍스트 결정
    const lastRunDisplay = formatLastRunTime(lastRunTime);

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
            {/* Last run 섹션 (동적 값 적용) */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {/* 🚨 [수정]: 동적으로 lastRunTime 값 표시 */}
                    <span className="text-muted-foreground">Last run: {lastRunDisplay}</span>
                </div>
            </div>
        </div>
    )
}
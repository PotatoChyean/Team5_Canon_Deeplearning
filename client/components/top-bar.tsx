"use client"

import { Clock } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface TopBarProps {
    isProcessing: boolean;
    completedCount: number;
    uploadedCount: number;
    lastRunTime: string | number; }

export function TopBar({ isProcessing, completedCount, uploadedCount, lastRunTime }: TopBarProps) {
    const progressValue = uploadedCount > 0 ? (completedCount / uploadedCount) * 100 : 0;
    
    // lastRunTime을 표시할 문자열로 변환하는 함수 
    const formatLastRunTime = (time: string | number) => {
        if (time === 'N/A' || time === 0) {
            return 'Never run';
        }
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
    
    const lastRunDisplay = formatLastRunTime(lastRunTime);

    return (
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
                    <span className="text-muted-foreground">Last run: {lastRunDisplay}</span>
                </div>
            </div>
        </div>
    )
}
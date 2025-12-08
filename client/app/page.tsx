"use client"

import { useState, Dispatch, SetStateAction } from "react"
// 필요한 컴포넌트 Import
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { Navigation } from "@/components/navigation"
import { ImageUpload } from "@/components/image-upload"
import { LiveCamera } from "@/components/live-camera"
import { ResultsGrid } from "@/components/results-grid"
import { SummaryAnalytics } from "@/components/summary-analytics"

// 사이드바 탭 타입 정의
type SidebarTab = "upload" | "live" | "results" | "summary";

// SidebarProps 인터페이스 정의 (타입 충돌 방지)
interface SidebarProps {
    isCollapsed: boolean; 
    setIsCollapsed: Dispatch<SetStateAction<boolean>>;
}


export default function Dashboard() {
    const [uploadResetKey, setUploadResetKey] = useState(0)
    const [activeTab, setActiveTab] = useState<SidebarTab>("upload")
    const [isProcessing, setIsProcessing] = useState(false)
    const [results, setResults] = useState<any[]>([])
    const [isCollapsed, setIsCollapsed] = useState(false)
    
    // 진행률 관리를 위한 상태
    const [processingCount, setProcessingCount] = useState<number>(0)
    const [totalFiles, setTotalFiles] = useState<number>(0)           

    const paddingClass = isCollapsed ? 'pl-16' : 'pl-64';

    // 1. 분석 시작 준비 함수
    const handleAnalysisStart = (fileCount: number) => {
        setTotalFiles(fileCount);
        setProcessingCount(0);
        setIsProcessing(true);
    };

    // 2. 분석 완료 처리 함수
    const handleResultsReady = (newResults: any[]) => {
        setResults(newResults);
        setIsProcessing(false);
        setProcessingCount(totalFiles); // 완료 카운트를 총 파일 수로 설정
        setUploadResetKey(prev => prev + 1); // 내부 상태 초기화
        setActiveTab('results'); // 결과 탭으로 자동 전환
    };
    

    return (
        // 🚨 [수정]: 최상위 div에서 테마 전환을 방해하던 bg-slate-950 하드코딩 색상을 제거했습니다.
        <div className="flex h-screen relative">
            
            {/* 1. Sidebar 연결 */}
            <Sidebar 
                isCollapsed={isCollapsed} 
                setIsCollapsed={setIsCollapsed} 
            />

            <div className={`flex-1 flex flex-col transition-all duration-300 ${paddingClass}`}>
                
                {/* 2. TopBar 연결 (진행률 표시 Props 완벽하게 전달) */}
                <TopBar 
                    isProcessing={isProcessing} 
                    completedCount={processingCount} 
                    uploadedCount={totalFiles} 
                />
                
                <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
                
                {/* 🚨 [수정]: CSS 변수로 대체 */}
                <main className="flex-1 overflow-auto bg-background p-6">
                    
                    {/* 1. ImageUpload 탭 */}
                    <div
                        style={{ display: activeTab === "upload" ? "block" : "none" }}
                    >
                        <ImageUpload
                            key={uploadResetKey}
                            setResults={handleResultsReady}
                            onAnalysisStart={handleAnalysisStart}
                            setProcessingCount={setProcessingCount}
                            uploadedCount={totalFiles}
                            isProcessing={isProcessing}
                        />
                    </div>

                    {/* 2. LiveCamera 탭 */}
                    <div
                        style={{ display: activeTab === "live" ? "block" : "none" }}
                    >
                        <LiveCamera
                            setIsProcessing={setIsProcessing}
                            setResults={setResults}
                        />
                    </div>

                    {/* 3. ResultsGrid 탭 */}
                    <div
                        style={{ display: activeTab === "results" ? "block" : "none" }}
                    >
                        <ResultsGrid results={results} />
                    </div>

                    {/* 4. SummaryAnalytics 탭 */}
                    <div
                        style={{ display: activeTab === "summary" ? "block" : "none" }}
                    >
                        <SummaryAnalytics results={results} />
                    </div>
                </main>
            </div>
        </div>
    )
}

//TODO: 업로드 이후 분석 완료 시 업로드한 파일이 남아 있음
"use client"

import { useState, Dispatch, SetStateAction } from "react"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { Navigation } from "@/components/navigation"
import { ImageUpload } from "@/components/image-upload"
import { LiveCamera } from "@/components/live-camera"
import { ResultsGrid } from "@/components/results-grid"
import { SummaryAnalytics } from "@/components/summary-analytics"

type SidebarTab = "upload" | "live" | "results" | "summary";

interface SidebarProps {
    isCollapsed: boolean; 
    setIsCollapsed: Dispatch<SetStateAction<boolean>>;
    lastRunTime: string;
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
    const [lastRunTime, setLastRunTime] = useState<string>('N/A');
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
        setProcessingCount(totalFiles); 
        setUploadResetKey(prev => prev + 1);
        setActiveTab('results'); 
        setLastRunTime(new Date().toLocaleString());
    };
    

    return (
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
                    lastRunTime={lastRunTime} //
                />
                
                <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
                
                <main className="flex-1 overflow-auto bg-background">
                    
                    {/* 1. ImageUpload 탭 */}
                    {activeTab === "upload" && (
                        <ImageUpload
                            key={uploadResetKey}
                            setResults={handleResultsReady}
                            onAnalysisStart={handleAnalysisStart}
                            setProcessingCount={setProcessingCount}
                            uploadedCount={totalFiles}
                            isProcessing={isProcessing}
                        />
                    )}

                    {/* 2. LiveCamera 탭 (핵심: 조건부 렌더링) */}
                    {activeTab === "live" && (
                        <LiveCamera
                            setIsProcessing={setIsProcessing}
                            setResults={setResults}
                        />
                    )}

                    {/* 3. ResultsGrid 탭 */}
                    {activeTab === "results" && (
                        <ResultsGrid results={results} />
                    )}

                    {/* 4. SummaryAnalytics 탭 */}
                    {activeTab === "summary" && (
                        <SummaryAnalytics results={results} />
                    )}
                    
                </main>
            </div>
        </div>
    )
}
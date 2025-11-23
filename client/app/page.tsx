"use client"

import { useState, Dispatch, SetStateAction } from "react"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { Navigation } from "@/components/navigation"
import { ImageUpload } from "@/components/image-upload"
import { LiveCamera } from "@/components/live-camera"
import { ResultsGrid } from "@/components/results-grid"
import { SummaryAnalytics } from "@/components/summary-analytics"

// 사이드바 탭 타입 정의
type SidebarTab = "upload" | "live" | "results" | "summary";

// 🚨 [필수]: SidebarProps 인터페이스 정의 (타입 충돌 방지)
interface SidebarProps {
    activeTab: SidebarTab; 
    setActiveTab: Dispatch<SetStateAction<SidebarTab>>;
    isCollapsed: boolean; 
    setIsCollapsed: Dispatch<SetStateAction<boolean>>;
}


export default function Dashboard() {
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
        setProcessingCount(totalFiles); 
        setActiveTab('results');
    };

    return (
        <div className="flex h-screen bg-slate-950 relative">
            
            {/* 🚨 Sidebar 연결 (SidebarProps 오류 해결을 위한 전달) */}
            <Sidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                isCollapsed={isCollapsed} 
                setIsCollapsed={setIsCollapsed} 
            />

            <div className={`flex-1 flex flex-col transition-all duration-300 ${paddingClass}`}>
                
                {/* 🚨 TopBar 연결 (진행률 표시) */}
                <TopBar 
                    isProcessing={isProcessing} 
                    completedCount={processingCount} 
                    uploadedCount={totalFiles} 
                />
                
                <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
                
                <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6">
                    
                    {/* 🚨 ImageUpload 연결 (모든 props 전달) */}
                    {activeTab === "upload" && (
                        <ImageUpload 
                            setResults={handleResultsReady} 
                            onAnalysisStart={handleAnalysisStart} 
                            setProcessingCount={setProcessingCount} 
                            uploadedCount={totalFiles}
                            isProcessing={isProcessing}
                        />
                    )}
                    
                    {activeTab === "live" && <LiveCamera setIsProcessing={setIsProcessing} />}
                    {activeTab === "results" && <ResultsGrid results={results} />}
                    {activeTab === "summary" && <SummaryAnalytics results={results} />}
                </main>
            </div>
        </div>
    );
}
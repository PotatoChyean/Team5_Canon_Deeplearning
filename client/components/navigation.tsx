"use client"

import type React from "react"
import { Upload, Camera, BarChart3, TrendingUp } from "lucide-react"

export function Navigation({ activeTab, setActiveTab }: any) {
    const tabs = [
        { 
            id: "upload", 
            label: "업로드", 
            icon: <Upload className="w-5 h-5" /> 
        },
        { 
            id: "live", 
            label: "카메라", 
            icon: <Camera className="w-5 h-5" />
        },
        { 
            id: "results", 
            label: "결과", 
            icon: <BarChart3 className="w-5 h-5" />
        },
        { 
            id: "summary", // 🚨 [수정]: analytics 대신 summary 사용
            label: "분석", 
            icon: <TrendingUp className="w-5 h-5" /> 
        },
    ]

    return (
        // 🚨 [수정]: 배경과 테두리를 CSS 변수로 변경
        <div className="bg-card border-b border-border px-6 py-4 flex gap-6">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === tab.id
                        // 🚨 [수정]: 활성 탭 색상을 Primary CSS 변수로 변경
                        ? "bg-primary text-primary-foreground shadow-lg shadow-blue-500/30"
                        // 🚨 [수정]: 비활성 탭 텍스트 및 호버 색상을 CSS 변수로 변경
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    } flex items-center`}
                >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                </button>
            ))}
        </div>
    )
}
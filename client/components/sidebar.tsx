"use client"

import type React from "react"
import { Dispatch, SetStateAction } from "react" 
import { Settings, ChevronsLeft, ChevronsRight } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle";
import { Clock } from "lucide-react"

interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: Dispatch<SetStateAction<boolean>>;
}

// NavItem 컴포넌트 (isCollapsed 상태를 받아서 텍스트 숨김)
function NavItem({ icon, label, isCollapsed }: { icon: React.ReactNode; label: string; isCollapsed: boolean }) {
    return (
        <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors"
            title={isCollapsed ? label : undefined}
        >
            {icon}
            <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
                {label}
            </span>
        </button>
    )
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
    const widthClass = isCollapsed ? 'w-16' : 'w-64';

    return (
        <aside 
            className={`${widthClass} absolute left-0 top-0 bottom-0 z-10 
            bg-sidebar border-r border-sidebar-border flex flex-col p-4 transition-all duration-300 shadow-lg`}
        >
            
            {/* 2. 토글 버튼 영역 추가 */}
            <div className={`flex justify-${isCollapsed ? 'center' : 'end'} mb-4 ${!isCollapsed ? 'pr-2' : ''}`}>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 rounded-full text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-white transition-colors"
                    title={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
                >
                    {/* ChevronsRight: 접혀 있을 때 (펼치는 버튼), ChevronsLeft: 펼쳐져 있을 때 (접는 버튼) */}
                    {isCollapsed 
                        ? <ChevronsRight className="w-5 h-5" /> 
                        : <ChevronsLeft className="w-5 h-5" />} 
                </button>
            </div>

            {/* 3. 로고 영역: 접혔을 때 텍스트 숨김 */}
            <div className="mb-8 overflow-hidden">
                <div className="flex items-center gap-3 mb-2 justify-start">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
                    </div>
                    {!isCollapsed && <h1 className="text-xl font-bold text-foreground whitespace-nowrap">5조</h1>}
                </div>
                {!isCollapsed && <p className="text-sm text-muted-foreground whitespace-nowrap">실시간 오류 감지 시스템</p>}
            </div>

            {/* 4. NavItem에 isCollapsed 상태 전달 */}
            <nav className="flex-1 space-y-3">
                <NavItem icon={<Settings className="w-5 h-5" />} label="환경설정" isCollapsed={isCollapsed} />
            </nav>
            
            {/* 5. 사이드바 밑 모드 설정 */}
            <div className="mt-auto pt-4">
                <ThemeToggle isCollapsed={isCollapsed} />
            </div>
        </aside>
    )
}
// components/sidebar.tsx
"use client"

import type React from "react"
import { Dispatch, SetStateAction } from "react" 
import { Settings, ChevronsLeft, ChevronsRight } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle";
import { Clock } from "lucide-react"

// Props 인터페이스 정의 (상위 컴포넌트에서 전달받을 데이터)
interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: Dispatch<SetStateAction<boolean>>;
}

// NavItem 컴포넌트 (isCollapsed 상태를 받아서 텍스트 숨김)
function NavItem({ icon, label, isCollapsed }: { icon: React.ReactNode; label: string; isCollapsed: boolean }) {
    return (
        <button
            // 🚨 [수정]: 하드코딩된 색상 -> CSS 변수 (bg-sidebar-accent, text-sidebar-foreground)로 변경
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors"
            title={isCollapsed ? label : undefined}
        >
            {icon}
            {/* 텍스트는 isCollapsed가 true일 때 숨김 */}
            <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
                {label}
            </span>
        </button>
    )
}

// 🔥 사이드바 형태 구성 (Props를 받도록 수정)
export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
    // 🔥 isCollapsed를 Props로 받았으므로 바로 사용 가능
    const widthClass = isCollapsed ? 'w-16' : 'w-64';

    return (
        // 🚨 [수정]: 배경, 테두리 색상 -> CSS 변수 (bg-sidebar, border-sidebar-border)로 변경
        <aside 
            className={`${widthClass} absolute left-0 top-0 bottom-0 z-10 
            bg-sidebar border-r border-sidebar-border flex flex-col p-4 transition-all duration-300 shadow-lg`}
        >
            
            {/* 🔥 2. 토글 버튼 영역 추가 */}
            <div className={`flex justify-${isCollapsed ? 'center' : 'end'} mb-4 ${!isCollapsed ? 'pr-2' : ''}`}>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    // 🚨 [수정]: 하드코딩된 색상 -> CSS 변수 (text-sidebar-foreground)로 변경
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
                        {/* 아이콘이 원래 있었다면 여기에 배치 */}
                    </div>
                    {/* isCollapsed가 false일 때만 텍스트를 보여줍니다. */}
                    {!isCollapsed && <h1 className="text-xl font-bold text-white whitespace-nowrap">5조</h1>}
                </div>
                {!isCollapsed && <p className="text-sm text-slate-400 whitespace-nowrap">실시간 오류 감지 시스템</p>}
            </div>

            {/* 4. NavItem에 isCollapsed 상태 전달 */}
            <nav className="flex-1 space-y-3">
                <NavItem icon={<Settings className="w-5 h-5" />} label="환경설정" isCollapsed={isCollapsed} />
                {/* 다른 NavItem들도 여기에 추가 */}
            </nav>

            {/* 5. 하단 Status 영역: isCollapsed가 false일 때만 보여줍니다. */}
            {!isCollapsed && (
                <div className="pt-4 border-t border-sidebar-border">
                    <p className="text-xs text-slate-500 mb-4">Status</p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                             <span className="text-sm text-sidebar-foreground">System Ready</span>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 6. 사이드바 밑 모드 설정 */}
            <div className="mt-auto p-4 border-t border-sidebar-border">
                <ThemeToggle />
            </div>
        </aside>
    )
}
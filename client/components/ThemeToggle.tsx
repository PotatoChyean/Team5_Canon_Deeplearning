import React from 'react';
import { useTheme } from '../hooks/use-theme'; 
import { Sun, Moon } from 'lucide-react'; 
interface ThemeToggleProps {
    isCollapsed: boolean; 
}

export function ThemeToggle({ isCollapsed }: ThemeToggleProps) {
    const { theme, toggleTheme, isMounted } = useTheme();
    
    // 테마 이름 기반으로 라벨 설정 (버튼이 어떤 역할을 하는지 설명)
    const label = theme === 'light' ? '다크 모드' : '라이트 모드';
    
    // 1. Hydration 오류 방지
    if (!isMounted) {
        const size = isCollapsed ? 'w-8 h-8' : 'w-full h-10';
        return <div className={`flex items-center justify-center ${size}`} aria-hidden="true" />; 
    }

    // 2. 정상 렌더링
    return (
        <button 
            onClick={toggleTheme} 
            title={label} 
            className="w-full flex items-center gap-3 px-1 py-1 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
            {/* 2-1. 아이콘 영역: 크기는 동일하게 유지 */}
            <span className={`p-2 rounded-full flex-shrink-0 ${isCollapsed ? 'mx-auto' : ''}`}>
                {theme === 'light' ? (
                    <Moon className="w-5 h-5" /> 
                ) : (
                    <Sun className="w-5 h-5" /> 
                )}
            </span>
            
            {/* 2-2. 텍스트 라벨 영역: isCollapsed 상태에 따라 숨김/표시 */}
            <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
                {label}
            </span>
        </button>
    );
}
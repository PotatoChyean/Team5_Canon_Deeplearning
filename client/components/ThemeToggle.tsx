import React from 'react';
import { useTheme } from '../hooks/use-theme'; 
import { Sun, Moon } from 'lucide-react'; 

// 🔥 isCollapsed Prop을 받도록 인터페이스와 함수 시그니처 수정
interface ThemeToggleProps {
    isCollapsed: boolean; 
}

export function ThemeToggle({ isCollapsed }: ThemeToggleProps) {
    const { theme, toggleTheme, isMounted } = useTheme();
    
    // 테마 이름 기반으로 라벨 설정 (버튼이 어떤 역할을 하는지 설명)
    const label = theme === 'light' ? '다크 모드' : '라이트 모드';
    
    // 1. Hydration 오류 방지
    if (!isMounted) {
        // isCollapsed 상태에 관계없이 일정한 크기 유지
        const size = isCollapsed ? 'w-8 h-8' : 'w-full h-10';
        return <div className={`flex items-center justify-center ${size}`} aria-hidden="true" />; 
    }

    // 2. 정상 렌더링
    return (
        // 🚨 [수정]: 버튼 전체를 감싸서 사이드바 항목과 동일한 스타일을 적용
        <button 
            onClick={toggleTheme} 
            title={label} // 접혔을 때 툴팁으로 사용
            className="w-full flex items-center gap-3 px-1 py-1 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
            {/* 2-1. 아이콘 영역: 크기는 동일하게 유지 */}
            {/* 버튼 전체가 클릭 가능하므로, 아이콘 자체는 작게 표시 */}
            <span className={`p-2 rounded-full flex-shrink-0 ${isCollapsed ? 'mx-auto' : ''}`}>
                {theme === 'light' ? (
                    <Moon className="w-5 h-5" /> // Light Mode일 때 (Dark로 전환)
                ) : (
                    <Sun className="w-5 h-5" /> // Dark Mode일 때 (Light로 전환)
                )}
            </span>
            
            {/* 2-2. 텍스트 라벨 영역: isCollapsed 상태에 따라 숨김/표시 */}
            <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
                {label}
            </span>
        </button>
    );
}
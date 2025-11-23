import React from 'react';
import { useTheme } from '../hooks/use-theme'; 
import { Sun, Moon } from 'lucide-react'; 

export function ThemeToggle() {
  const { theme, toggleTheme, isMounted } = useTheme();

  // 1. Hydration 오류 방지: 클라이언트에서 JS가 로드될 때까지 렌더링을 지연합니다.
  if (!isMounted) {
    // 🚨 렌더링이 지연되는 동안 레이아웃이 깨지지 않도록 placeholder를 반환합니다.
    return <div style={{ width: 32, height: 32 }} aria-hidden="true" />; 
  }

  // 2. 정상 렌더링: isMounted가 true일 때 버튼을 표시합니다.
  return (
    <button 
      onClick={toggleTheme} 
      className="p-2 rounded-full bg-secondary hover:bg-secondary-foreground/10 transition-colors"
      aria-label="Toggle theme"
    >
      {/* 현재 테마에 따라 아이콘을 표시합니다. */}
      {theme === 'light' ? (
        // Light Mode (기본)일 때: 달 아이콘 (다크 모드로 전환 버튼)
        <span>🌙</span> 
      ) : (
        // Dark Mode일 때: 해 아이콘 (라이트 모드로 전환 버튼)
        <span>☀️</span> 
      )}
    </button>
  );
}
// src/hooks/use-theme.ts

import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

export const useTheme = () => {
  // 1. 초기 상태 설정: 로컬 저장소에서 저장된 테마를 가져오거나 'light'를 기본값으로 사용
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return (savedTheme === 'dark' ? 'dark' : 'light') as Theme;
    }
    return 'light'; // 서버 측 렌더링(SSR) 시 기본값
  });

  const [isMounted, setIsMounted] = useState(false);

  // 2. 테마가 변경될 때마다 HTML 클래스 및 로컬 저장소 업데이트
  useEffect(() => {
    setIsMounted(true);

    const root = window.document.documentElement; // <html> 태그
    
    // 이전에 적용된 'light' 또는 'dark' 클래스를 제거합니다.
    root.classList.remove('light', 'dark'); 
    
    // 현재 테마 클래스를 적용합니다.
    root.classList.add(theme); 
    
    // 로컬 저장소에 현재 테마를 저장하여 사용자가 다음에 접속할 때 유지되도록 합니다.
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 3. 테마 토글 함수
  const toggleTheme = () => {
    setThemeState(currentTheme => (currentTheme === 'light' ? 'dark' : 'light'));
  };

  return { theme, toggleTheme, isMounted };
};
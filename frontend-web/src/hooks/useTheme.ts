/**
 * Hook para dark mode com persistência e detecção de preferência do sistema.
 *
 * - Salva preferência em localStorage
 * - Detecta preferência do SO (prefers-color-scheme)
 * - Aplica classe 'dark' no <html> (Tailwind darkMode: "class")
 * - Transição suave com CSS transition
 */
import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'renoveja-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme): number {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  const root = document.documentElement;

  // Add smooth transition for theme change
  root.style.setProperty('transition', 'background-color 0.3s ease, color 0.2s ease');

  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Update meta theme-color for browser chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#0f172a' : '#00a0dc');
  }

  // Clean transition after animation — return timer id for cleanup
  return window.setTimeout(() => {
    root.style.removeProperty('transition');
  }, 300);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored || 'light';
  });

  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark');

  // Apply on mount and change
  useEffect(() => {
    const timerId = applyTheme(theme);
    return () => clearTimeout(timerId);
  }, [theme]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    let timerId: number;
    const handler = () => { timerId = applyTheme('system'); };
    mq.addEventListener('change', handler);
    return () => {
      clearTimeout(timerId);
      mq.removeEventListener('change', handler);
    };
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  return { theme, setTheme, isDark, toggleDarkMode };
}

'use client';
import { useThemeStore } from '@/store/theme';
import { useEffect } from 'react';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg', theme.bg);
    root.style.setProperty('--card', theme.card);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--border', theme.border);
    root.style.setProperty('--input', theme.input);
    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.text;
  }, [theme]);

  return <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text }}>{children}</div>;
}

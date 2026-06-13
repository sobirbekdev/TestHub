import { create } from 'zustand';

export type ThemeId = 'dark-indigo' | 'light-indigo' | 'dark-teal' | 'light-teal';

interface ThemeConfig {
  id: ThemeId;
  label: string;
  icon: string;
  bg: string;
  card: string;
  accent: string;
  text: string;
  border: string;
  input: string;
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'dark-indigo', label: 'Tungi Indigo', icon: '🌙',
    bg: '#0d0e1a', card: '#13142a', accent: '#7c6af5',
    text: '#e8e8ff', border: '#2a2b4a', input: '#1a1b35',
  },
  {
    id: 'light-indigo', label: 'Kunduzgi Indigo', icon: '☀️',
    bg: '#f5f6ff', card: '#ffffff', accent: '#6b5cf0',
    text: '#1a1a2e', border: '#e0e0ff', input: '#f0f0ff',
  },
  {
    id: 'dark-teal', label: 'Tungi Teal', icon: '🌊',
    bg: '#03151c', card: '#061e27', accent: '#00c9a7',
    text: '#e0f7f4', border: '#0d3040', input: '#071e28',
  },
  {
    id: 'light-teal', label: 'Kunduzgi Teal', icon: '🌿',
    bg: '#f0fdfb', card: '#ffffff', accent: '#0d9488',
    text: '#0a2e2a', border: '#ccf0ea', input: '#e8faf7',
  },
];

interface ThemeStore {
  themeId: ThemeId;
  theme: ThemeConfig;
  setTheme: (id: ThemeId) => void;
}

export const useThemeStore = create<ThemeStore>((set) => {
  const saved = (typeof window !== 'undefined' ? localStorage.getItem('theme') : null) as ThemeId | null;
  const initial = THEMES.find((t) => t.id === saved) || THEMES[0];
  return {
    themeId: initial.id,
    theme: initial,
    setTheme: (id) => {
      const t = THEMES.find((t) => t.id === id) || THEMES[0];
      localStorage.setItem('theme', id);
      set({ themeId: id, theme: t });
    },
  };
});

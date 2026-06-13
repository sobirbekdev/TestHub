import { create } from 'zustand';
import { User } from '@/types';
import api from '@/lib/api';

interface AuthStore {
  user: User | null;
  token: string | null;
  loading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  loading: false,

  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  fetchMe: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    set({ loading: true });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, loading: false });
    } catch {
      set({ user: null, token: null, loading: false });
      localStorage.removeItem('token');
    }
  },
}));

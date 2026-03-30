// @ts-nocheck
import { create } from 'zustand';
import api from '../lib/api';

const isElectron = !!(window as any).electronAPI;

interface User {
  id: string;
  email: string;
  name: string;
  plan: string;
  avatar: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string, persist?: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,

  setAuth: async (user, accessToken, refreshToken, persist = true) => {
    if (persist) {
      if (isElectron) {
        await (window as any).electronAPI.setToken(accessToken, refreshToken);
      } else {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
      }
    }
    set({ user, accessToken, refreshToken });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      await get().setAuth(data.user, data.accessToken, data.refreshToken);
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/register', { name, email, password });
      await get().setAuth(data.user, data.accessToken, data.refreshToken);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    const { refreshToken } = get();
    if (refreshToken) {
      try {
        await api.post('/api/auth/logout', { refreshToken });
      } catch (e) {
        console.error('Logout API failed:', e);
      }
    }
    
    if (isElectron) {
      await (window as any).electronAPI.deleteToken();
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    
    set({ user: null, accessToken: null, refreshToken: null });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      let token, refresh;
      if (isElectron) {
        const result = await (window as any).electronAPI.getToken();
        token = result?.token;
        refresh = result?.refresh;
      } else {
        token = localStorage.getItem('access_token');
        refresh = localStorage.getItem('refresh_token');
      }

      if (token && refresh) {
        set({ accessToken: token, refreshToken: refresh });
        try {
           const { data } = await api.get('/api/auth/me');
           set({ user: data });
        } catch (e) {
           // If /me fails, we might still have tokens
        }
      }
    } finally {
      set({ isLoading: false });
    }
  }
}));

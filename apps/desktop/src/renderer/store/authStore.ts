// @ts-nocheck
import { create } from 'zustand';
import api from '../lib/api';

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
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
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

  setAuth: async (user, accessToken, refreshToken) => {
    await window.electronAPI.setToken(accessToken, refreshToken);
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
    await window.electronAPI.deleteToken();
    set({ user: null, accessToken: null, refreshToken: null });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const { token, refresh } = await window.electronAPI.getToken();
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

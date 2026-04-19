// @ts-nocheck
import { create } from 'zustand';
import api from '../lib/api';

const isElectron = !!(window as any).electronAPI;

interface User {
  id: string;
  email: string;
  name: string;
  plan: string;
  role: 'SUPER_ADMIN' | 'SUB_ADMIN' | 'OPERATOR' | 'VIEWER' | 'USER';
  organizationId: string | null;
  avatar: string | null;
  is_2fa_enabled?: boolean;
  notify_session_alert?: boolean;
  notify_disconnect_alert?: boolean;
  notify_sound_effects?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  temp2faToken: string | null;
  isLoading: boolean;
  setTemp2faToken: (token: string | null) => void;
  setAuth: (user: User, accessToken: string, refreshToken: string, persist?: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<{ twoFactorRequired?: boolean }>;
  verify2fa: (code: string) => Promise<void>;
  requestVerification: (email: string) => Promise<void>;
  register: (name: string, email: string, password: string, verificationCode: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  temp2faToken: null,
  isLoading: false,

  setTemp2faToken: (token) => set({ temp2faToken: token }),

  setAuth: async (user, accessToken, refreshToken, persist = true) => {
    if (persist) {
      if (isElectron) {
        await (window as any).electronAPI.setToken(accessToken, refreshToken);
      } else {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
      }
    }
    set({ user, accessToken, refreshToken, temp2faToken: null });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      if (data.twoFactorRequired) {
        set({ temp2faToken: data.tempToken });
        return { twoFactorRequired: true };
      }
      await get().setAuth(data.user, data.accessToken, data.refreshToken);
      return { twoFactorRequired: false };
    } finally {
      set({ isLoading: false });
    }
  },

  verify2fa: async (code) => {
    set({ isLoading: true });
    try {
      const { temp2faToken } = get();
      const { data } = await api.post('/api/auth/verify-2fa', { 
        code, 
        tempToken: temp2faToken 
      });
      await get().setAuth(data.user, data.accessToken, data.refreshToken);
      set({ temp2faToken: null });
    } finally {
      set({ isLoading: false });
    }
  },

  requestVerification: async (email) => {
    set({ isLoading: true });
    try {
      await api.post('/api/auth/request-verification', { email });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name, email, password, verificationCode) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/register', { name, email, password, verificationCode });
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
        try {
           // Set tokens first so the request interceptor can attach them
           set({ accessToken: token, refreshToken: refresh });
           const { data } = await api.get('/api/auth/me');
           set({ user: data });
        } catch (e: any) {
           // Token expired and refresh also failed — clear everything so the
           // app shows the login screen instead of triggering "Session Expired"
           if (e.response?.status === 401 || e.response?.status === 403) {
             if (isElectron) {
               try { await (window as any).electronAPI.deleteToken(); } catch {}
             } else {
               localStorage.removeItem('access_token');
               localStorage.removeItem('refresh_token');
             }
             set({ user: null, accessToken: null, refreshToken: null });
           }
           // Network errors: keep state so the user doesn't get logged out offline
        }
      }
    } finally {
      set({ isLoading: false });
    }
  }
}));

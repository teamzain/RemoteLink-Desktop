import { create } from 'zustand';
import api from '../lib/api';

const TOKEN_KEY = 'remotelink_access_token';
const REFRESH_KEY = 'remotelink_refresh_token';

interface User {
  id: string;
  email: string;
  name: string;
  plan: string;
  avatar: string | null;
  is_2fa_enabled?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  temp2faToken: string | null;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateUser: (user: User) => void;
  setTemp2faToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<{ twoFactorRequired?: boolean }>;
  register: (name: string, email: string, password: string) => Promise<void>;
  verify2fa: (code: string, tempToken: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem(TOKEN_KEY),
  refreshToken: localStorage.getItem(REFRESH_KEY),
  temp2faToken: null,
  isLoading: false,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    set({ user, accessToken, refreshToken, temp2faToken: null });
  },

  updateUser: (user) => set({ user }),

  setTemp2faToken: (token) => set({ temp2faToken: token }),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      
      if (data.twoFactorRequired) {
        set({ temp2faToken: data.tempToken });
        return { twoFactorRequired: true };
      }

      get().setAuth(data.user, data.accessToken, data.refreshToken);
      return { twoFactorRequired: false };
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/register', { name, email, password });
      get().setAuth(data.user, data.accessToken, data.refreshToken);
    } finally {
      set({ isLoading: false });
    }
  },

  verify2fa: async (code, tempToken) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/verify-2fa', { code, tempToken });
      get().setAuth(data.user, data.accessToken, data.refreshToken);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    const refreshToken = get().refreshToken;
    if (refreshToken) {
      try {
        await api.post('/api/auth/logout', { refreshToken });
      } catch (e) {
        console.error('Logout API failed:', e);
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    set({ user: null, accessToken: null, refreshToken: null });
  },

  initialize: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    set({ isLoading: true });
    try {
      const { data } = await api.get('/api/auth/me');
      set({ user: data, accessToken: token, refreshToken: localStorage.getItem(REFRESH_KEY) });
    } catch (e) {
      // Interceptor handles refresh, if /me still fails after refresh, it will redirect to login
      console.error('Initialization /me failed:', e);
    } finally {
      set({ isLoading: false });
    }
  }
}));

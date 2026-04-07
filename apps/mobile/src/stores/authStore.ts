import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithToken: (token: string, refreshToken?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (name: string, email: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isLoading: false,
  isAuthenticated: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      const userJson = await SecureStore.getItemAsync('user');
      
      if (accessToken && userJson) {
        set({
          accessToken,
          refreshToken,
          user: JSON.parse(userJson),
          isAuthenticated: true,
        });
      }
    } catch (error) {
      console.error('Initialize error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/api/auth/login', { email, password });
      
      if (response.status === 200) {
        const { accessToken, refreshToken, user } = response.data;
        
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', refreshToken);
        await SecureStore.setItemAsync('user', JSON.stringify(user));
        
        set({
          accessToken,
          refreshToken,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      set({ isLoading: false });
      return false;
    }
  },

  loginWithToken: async (token, refreshToken) => {
    set({ isLoading: true });
    try {
      const response = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.status === 200) {
        const user = response.data;
        
        await SecureStore.setItemAsync('accessToken', token);
        if (refreshToken) {
          await SecureStore.setItemAsync('refreshToken', refreshToken);
        }
        await SecureStore.setItemAsync('user', JSON.stringify(user));
        
        set({
          accessToken: token,
          refreshToken: refreshToken || null,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('LoginWithTokens error:', error);
      set({ isLoading: false });
      return false;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
    
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
  
  updateUser: async (name: string, email: string) => {
    const { user } = get();
    if (!user) return false;
    
    const newUser = { ...user, name, email };
    try {
      await SecureStore.setItemAsync('user', JSON.stringify(newUser));
      set({ user: newUser });
      return true;
    } catch (e) {
      console.error('Update user error:', e);
      return false;
    }
  },
}));

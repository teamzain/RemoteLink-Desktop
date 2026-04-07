import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'http://159.65.84.190'; // Use the same IP as the Flutter app

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            })
            .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) {
            isRefreshing = false;
            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('refreshToken');
            return Promise.reject(error);
        }

        try {
            const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
                refreshToken,
            });
            const { accessToken, refreshToken: newRefreshToken } = data;
            
            await SecureStore.setItemAsync('accessToken', accessToken);
            await SecureStore.setItemAsync('refreshToken', newRefreshToken);
            
            processQueue(null, accessToken);
            isRefreshing = false;
            
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return api(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError, null);
            isRefreshing = false;
            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('refreshToken');
            return Promise.reject(refreshError);
        }
    }
    return Promise.reject(error);
  }
);

export default api;

// @ts-nocheck
import axios from 'axios';

const getBaseURL = () => {
  const serverIP = localStorage.getItem('remote_link_server_ip') || '127.0.0.1';
  return `http://${serverIP}:3001`;
};

const api = axios.create({
  baseURL: getBaseURL(),
});

// Update baseURL on each request in case it changed in localStorage
api.interceptors.request.use(async (config) => {
  config.baseURL = getBaseURL();
  const { token } = await window.electronAPI.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (value: string | null) => void; reject: (reason: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/api/devices/verify-access')) {
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

      const { refresh: refreshToken } = await window.electronAPI.getToken();
      if (!refreshToken) {
        isRefreshing = false;
        await window.electronAPI.deleteToken();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${getBaseURL()}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = data;

        await window.electronAPI.setToken(accessToken, newRefreshToken);

        processQueue(null, accessToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        await window.electronAPI.deleteToken();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

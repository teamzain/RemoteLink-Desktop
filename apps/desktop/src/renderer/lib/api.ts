// @ts-nocheck
import axios from 'axios';

const isElectron = !!(window as any).electronAPI;

const getBaseURL = async () => {
  const serverIP = '159.65.84.190';
  
  // Connect to production server at 159.65.84.190 for end-to-end testing
  return `http://${serverIP}`;
};

const api = axios.create();

// Update baseURL on each request in case it changed in localStorage
api.interceptors.request.use(async (config) => {
  config.baseURL = await getBaseURL();
  
  let token;
  if (isElectron) {
    const result = await (window as any).electronAPI.getToken();
    token = result?.token;
  } else {
    token = localStorage.getItem('access_token');
  }

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

    const isViewer = window.location.search.includes('viewer=true');

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/api/devices/verify-access')) {
      if (isViewer) {
        // Viewer windows use temporary tokens. Do NOT refresh or delete the main token.
        return Promise.reject(error);
      }

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

      let refreshToken;
      if (isElectron) {
        const result = await (window as any).electronAPI.getToken();
        refreshToken = result?.refresh;
      } else {
        refreshToken = localStorage.getItem('refresh_token');
      }

      if (!refreshToken) {
        isRefreshing = false;
        if (isElectron) {
           await (window as any).electronAPI.deleteToken();
        } else {
           localStorage.removeItem('access_token');
           localStorage.removeItem('refresh_token');
        }
        return Promise.reject(error);
      }

      try {
        const baseURL = await getBaseURL();
        const { data } = await axios.post(`${baseURL}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = data;

        if (isElectron) {
            await (window as any).electronAPI.setToken(accessToken, newRefreshToken);
        } else {
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', newRefreshToken);
        }

        processQueue(null, accessToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        if (isElectron) {
            await (window as any).electronAPI.deleteToken();
        } else {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

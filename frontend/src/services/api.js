import axios from 'axios';
import { API_CONFIG, STORAGE_KEYS } from '@/constants';

/**
 * Global Axios Instance for DDPL Procurement Portal
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || API_CONFIG.DEFAULT_BASE_URL,
  timeout: API_CONFIG.DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Request Interceptor:
 * Automatically appends Authorization header if JWT token exists in localStorage
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u.role === 'admin') {
          const activeRole = localStorage.getItem(STORAGE_KEYS.ACTIVE_ROLE);
          if (activeRole) {
            config.headers['x-active-role'] = activeRole;
            if (activeRole === 'director_2') {
              config.headers['x-active-user-id'] = '6';
              config.headers['x-active-user-name'] = 'Director 2';
            } else if (activeRole === 'director_3') {
              config.headers['x-active-user-id'] = '7';
              config.headers['x-active-user-name'] = 'Director 3';
            } else if (activeRole === 'director_1' || activeRole === 'director') {
              config.headers['x-active-user-id'] = '5';
              config.headers['x-active-user-name'] = 'Director 1';
            }
          }
        }
      } catch (e) {}
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor:
 * Handles 401 Unauthorized globally by clearing expired sessions
 */
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // A failed login (wrong password) is NOT a session expiry, and a 401 for a request sent with an
      // OLD token (e.g. another tab has since logged in as someone else) must not destroy the
      // current shared session. Only clear when the rejected token is the session still in storage.
      const isLoginAttempt = String(error.config?.url || '').includes('/auth/login');
      const currentToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
      const sentAuth = error.config?.headers?.Authorization;
      const isCurrentSession = Boolean(currentToken) && sentAuth === `Bearer ${currentToken}`;
      if (!isLoginAttempt && isCurrentSession) {
        // Session genuinely expired/invalid: clear ALL auth data (not just the token)
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
      }

      // If not already on login or public vendor registration, quote, or delivery schedule page, redirect
      const isPublicRoute =
        window.location.pathname === '/login' ||
        window.location.pathname.startsWith('/vendor-registration') ||
        window.location.pathname.startsWith('/quote') ||
        window.location.pathname.startsWith('/rfq-quote') ||
        window.location.pathname.startsWith('/delivery-schedule');

      if (!isLoginAttempt && (isCurrentSession || !currentToken) && !isPublicRoute) {
        window.location.href = '/login';
      }
    }
    let message = error.response?.data?.message || error.message || 'Network error occurred';
    if (error.code === 'ECONNABORTED' || message.includes('timeout')) {
      message = 'Server is waking up (Render free tier spin-up takes ~50s). Please wait a few seconds and try again.';
    } else if (message === 'Network Error') {
      message = 'Unable to connect to backend server. Please verify Render backend status or try again.';
    }
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    wrapped.errors = error.response?.data?.errors || [];
    return Promise.reject(wrapped);
  }
);

export default api;

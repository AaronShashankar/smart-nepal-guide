import axios from 'axios';

import i18n from './i18n';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
export const TOKEN_KEY = 'snguide.admin.token';

export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Accept-Language'] = i18n.language;
  return config;
});

export function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
    if (!error.response) return `Cannot reach the server (${API_URL})`;
  }
  return fallback;
}

export interface Me {
  id: string;
  email: string;
  full_name: string | null;
  role: 'traveller' | 'admin';
}
export class NotAdminError extends Error {}

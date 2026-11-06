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
    // FastAPI validation errors: [{loc: ['body', 'en', 'name'], msg: '...'}, ...]
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((d: { loc?: unknown[]; msg?: string }) => {
          const field = (d.loc ?? []).filter((x) => x !== 'body').join('.');
          return field ? `${field}: ${d.msg}` : d.msg;
        })
        .join('; ');
    }
    if (!error.response) return `Cannot reach the server (${API_URL})`;
  }
  return fallback;
}

/** Uploaded photos are stored relative to the API (/uploads/...); seeded ones are absolute. */
export function photoUrl(url: string): string {
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}

export interface Me {
  id: string;
  email: string;
  full_name: string | null;
  role: 'traveller' | 'admin';
}
export class NotAdminError extends Error {}

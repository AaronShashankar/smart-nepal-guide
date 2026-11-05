import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { useAuth } from '@/store/auth';
import { currentLang } from '@/store/settings';

import type { Tokens } from './types';

/**
 * Backend URL. On a real phone use your computer's LAN IP, e.g. http://192.168.1.10:8000
 * (set EXPO_PUBLIC_API_URL in mobile/.env).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000';

export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

// Every request carries the token and the chosen language.
api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Accept-Language'] = currentLang();
  return config;
});

// On 401, try the refresh token once, then retry the original request.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, logout } = useAuth.getState();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post<Tokens>(`${API_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    await setTokens(data);
    return data.access_token;
  } catch {
    await logout();
    return null;
  }
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as
    (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const isAuthCall = original?.url?.startsWith('/auth/');
  if (error.response?.status !== 401 || !original || original._retried || isAuthCall) {
    throw error;
  }
  original._retried = true;
  refreshing ??= refreshAccessToken().finally(() => {
    refreshing = null;
  });
  const token = await refreshing;
  if (!token) throw error;
  original.headers.Authorization = `Bearer ${token}`;
  return api(original);
});

/** A readable message from an API error (FastAPI puts it in `detail`). */
export function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
    if (!error.response) return `Cannot reach the server (${API_URL})`;
  }
  return fallback;
}

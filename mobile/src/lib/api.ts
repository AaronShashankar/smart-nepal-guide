import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import i18n from '@/i18n';
import { useAuth } from '@/store/auth';
import { currentLang } from '@/store/settings';

import type { Tokens } from './types';

/**
 * Backend URL.
 * 1. EXPO_PUBLIC_API_URL in mobile/.env, if set (e.g. a deployed server).
 *    In development a local-network IP there (192.168.x.x, 10.x.x.x, 172.16-31.x.x) is ignored:
 *    the laptop's Wi-Fi IP changes between networks, and a stale one broke every request (BUG-05).
 * 2. In development: the same computer that serves the Metro bundle, on port 8000.
 *    The phone or emulator already reaches that host, so the API IP never goes stale.
 * 3. Fallback: 10.0.2.2, the host computer as seen from the Android emulator.
 */
function devHostApiUrl(): string | null {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (!host) return null;
  // "localhost" inside the Android emulator is the emulator itself.
  if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
    return 'http://10.0.2.2:8000';
  }
  return `http://${host}:8000`;
}

const LAN_URL = /^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const devHost = __DEV__ ? devHostApiUrl() : null;
  if (fromEnv && devHost && LAN_URL.test(fromEnv) && fromEnv !== devHost) {
    console.warn(
      `Ignoring EXPO_PUBLIC_API_URL=${fromEnv} in development; using ${devHost}. ` +
        'Remove it from mobile/.env (see BUG-05).',
    );
    return devHost;
  }
  return fromEnv || devHost || 'http://10.0.2.2:8000';
}

export const API_URL = resolveApiUrl();

/** Photos uploaded in the admin panel are stored as "/uploads/..." on our API server. */
export const photoUrl = (url: string) => (url.startsWith('/') ? `${API_URL}${url}` : url);

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
  // 403 outside /auth means an admin blocked this account (the app never calls /admin):
  // log out, so the login screen shows the "blocked" message on the next try.
  if (error.response?.status === 403 && !isAuthCall) {
    await useAuth.getState().logout();
    throw error;
  }
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

/** Server messages a traveller can see, so they are shown in the app's language (BUG-07). */
const SERVER_MESSAGES: Record<string, string> = {
  'Email is already registered': 'errors.emailTaken',
  'Incorrect email or password': 'errors.wrongLogin',
  'This account has been blocked. Contact the Bato team.': 'errors.blocked',
  'This place is already in the trip': 'errors.alreadyInTrip',
  'Place not found': 'errors.notFound',
  'Trek not found': 'errors.notFound',
  'Trip not found': 'errors.notFound',
  'Review not found': 'errors.notFound',
  'Contact not found': 'errors.notFound',
  'You can save at most 5 emergency contacts': 'errors.tooManyContacts',
  'Invalid phone number': 'errors.badPhone',
};

/** A readable message from an API error (FastAPI puts it in `detail`). */
export function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') {
      const key = SERVER_MESSAGES[detail];
      return key ? i18n.t(key) : detail;
    }
    // A 422 list from FastAPI holds raw English validation text; show our own words (BUG-07).
    if (Array.isArray(detail)) return i18n.t('common.invalidInput');
    if (!error.response) {
      const offline = i18n.t('common.offline');
      // The server address helps when setting up a phone, but users don't need it (BUG-13).
      return __DEV__ ? `${offline} (${API_URL})` : offline;
    }
  }
  return fallback;
}

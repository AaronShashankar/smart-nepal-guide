import { create } from 'zustand';

import { KEYS, storage } from '@/lib/storage';
import type { Tokens } from '@/lib/types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTokens: (tokens: Pick<Tokens, 'access_token' | 'refresh_token'>) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  hydrate: async () => {
    const [accessToken, refreshToken] = await Promise.all([
      storage.get(KEYS.accessToken),
      storage.get(KEYS.refreshToken),
    ]);
    set({ accessToken, refreshToken, hydrated: true });
  },
  setTokens: async ({ access_token, refresh_token }) => {
    await Promise.all([
      storage.set(KEYS.accessToken, access_token),
      storage.set(KEYS.refreshToken, refresh_token),
    ]);
    set({ accessToken: access_token, refreshToken: refresh_token });
  },
  logout: async () => {
    await Promise.all([storage.remove(KEYS.accessToken), storage.remove(KEYS.refreshToken)]);
    set({ accessToken: null, refreshToken: null });
  },
}));

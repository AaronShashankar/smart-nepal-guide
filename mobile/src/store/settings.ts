import { create } from 'zustand';

import i18n from '@/i18n';
import { KEYS, storage } from '@/lib/storage';
import type { Lang } from '@/lib/types';

interface SettingsState {
  /** null until the user has picked a language on first launch */
  language: Lang | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (lang: Lang) => Promise<void>;
}

export const useSettings = create<SettingsState>((set) => ({
  language: null,
  hydrated: false,
  hydrate: async () => {
    const saved = await storage.get(KEYS.language);
    const language = saved === 'en' || saved === 'ne' ? saved : null;
    if (language) await i18n.changeLanguage(language);
    set({ language, hydrated: true });
  },
  setLanguage: async (lang) => {
    await storage.set(KEYS.language, lang);
    await i18n.changeLanguage(lang);
    set({ language: lang });
  },
}));

/** Language for API calls: the chosen one, or English before a choice is made. */
export const currentLang = (): Lang => useSettings.getState().language ?? 'en';

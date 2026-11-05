import * as SecureStore from 'expo-secure-store';

// expo-secure-store keeps values in the Android Keystore / iOS Keychain.
export const storage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};

export const KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  language: 'settings.language',
} as const;

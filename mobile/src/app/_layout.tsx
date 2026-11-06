import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
  useFonts,
} from '@expo-google-fonts/noto-sans-devanagari';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import '@/i18n';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { colors, fonts } from '@/theme';

SplashScreen.preventAutoHideAsync();

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5 * 60 * 1000 } },
});

export default function RootLayout() {
  const { t } = useTranslation();
  const [fontsLoaded] = useFonts({
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
  });
  const token = useAuth((s) => s.accessToken);
  const authReady = useAuth((s) => s.hydrated);
  const language = useSettings((s) => s.language);
  const settingsReady = useSettings((s) => s.hydrated);
  const ready = fontsLoaded && authReady && settingsReady;

  useEffect(() => {
    useAuth.getState().hydrate();
    useSettings.getState().hydrate();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Forget cached user data when the user logs out.
  useEffect(() => {
    if (!token) queryClient.removeQueries({ queryKey: ['me'] });
  }, [token]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        {/* 1. First launch: choose a language */}
        <Stack.Protected guard={!language}>
          <Stack.Screen name="language" options={{ headerShown: false }} />
        </Stack.Protected>
        {/* 2. Not logged in */}
        <Stack.Protected guard={!!language && !token}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ title: t('auth.register') }} />
        </Stack.Protected>
        {/* 3. Logged in */}
        <Stack.Protected guard={!!language && !!token}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="place/[id]" options={{ title: '' }} />
          <Stack.Screen name="trek/[id]/index" options={{ title: '' }} />
          <Stack.Screen name="trek/[id]/itinerary" options={{ title: t('itinerary.title') }} />
          <Stack.Screen name="trek/[id]/risk" options={{ title: t('risk.title') }} />
          <Stack.Screen name="profile" options={{ title: t('profile.title') }} />
          <Stack.Screen name="predictions" options={{ title: t('risk.history') }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}

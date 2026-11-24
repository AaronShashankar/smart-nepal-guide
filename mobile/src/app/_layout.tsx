import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
  NotoSansDevanagari_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/noto-sans-devanagari';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import '@/i18n';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { fontFor } from '@/components/AppText';
import { colors } from '@/theme';

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
    NotoSansDevanagari_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
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
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fontFor('extrabold'), color: colors.text, fontSize: 18 },
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
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
          <Stack.Screen name="register" options={{ headerShown: false }} />
        </Stack.Protected>
        {/* 3. Logged in */}
        <Stack.Protected guard={!!language && !!token}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* These draw their own photo hero or page header (design: "Bato App Redesign") */}
          <Stack.Screen name="place/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="trek/[id]/index" options={{ headerShown: false }} />
          <Stack.Screen name="trek/[id]/itinerary" options={{ headerShown: false }} />
          <Stack.Screen name="trek/[id]/risk" options={{ headerShown: false }} />
          <Stack.Screen name="trek/[id]/packing" options={{ title: t('packing.title') }} />
          <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ title: t('profile.title') }} />
          <Stack.Screen name="predictions" options={{ title: t('risk.history') }} />
          <Stack.Screen name="teahouses/[placeId]" options={{ title: '' }} />
          {/* V2 Phase 3 safety: these draw their own page header */}
          <Stack.Screen name="safety" options={{ headerShown: false }} />
          <Stack.Screen name="emergency-contacts" options={{ headerShown: false }} />
          <Stack.Screen name="symptoms/index" options={{ headerShown: false }} />
          <Stack.Screen name="symptoms/history" options={{ headerShown: false }} />
        </Stack.Protected>
        {/* A shared trip link works logged in or not (only the language must be chosen) */}
        <Stack.Protected guard={!!language}>
          <Stack.Screen name="shared/[token]" options={{ title: '' }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}

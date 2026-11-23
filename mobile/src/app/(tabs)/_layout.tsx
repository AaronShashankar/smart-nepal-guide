import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { FloatingTabBar } from '@/components/Layout';
import { markProfilePromptShown, profilePromptShown } from '@/lib/profilePrompt';
import { useMe } from '@/lib/queries';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const me = useMe();

  // New users (e.g. first Google sign-in) are asked to fill in their profile once.
  useEffect(() => {
    if (me.data && !me.data.has_profile && !profilePromptShown(me.data.id)) {
      markProfilePromptShown(me.data.id);
      router.push('/profile');
    }
  }, [me.data]);

  return (
    <Tabs
      // Floating dark bar over the content; tab screens leave TAB_BAR_SPACE at the bottom.
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.explore') }} />
      <Tabs.Screen name="map" options={{ title: t('tabs.map') }} />
      <Tabs.Screen name="search" options={{ title: t('tabs.search') }} />
      <Tabs.Screen name="trips" options={{ title: t('tabs.trips') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}

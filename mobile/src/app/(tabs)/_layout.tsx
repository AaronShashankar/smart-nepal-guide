import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useMe } from '@/lib/queries';
import { colors, fonts } from '@/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <MaterialCommunityIcons name={name} color={color as string} size={size} />;
}

const icon = (name: IconName) =>
  function Icon(props: { color: ColorValue; size: number }) {
    return <TabIcon name={name} {...props} />;
  };

export default function TabsLayout() {
  const { t } = useTranslation();
  const me = useMe();
  const prompted = useRef(false);

  // New users (e.g. first Google sign-in) are asked to fill in their profile once.
  useEffect(() => {
    if (me.data && !me.data.has_profile && !prompted.current) {
      prompted.current = true;
      router.push('/profile');
    }
  }, [me.data]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.explore'), tabBarIcon: icon('compass-outline') }}
      />
      <Tabs.Screen name="map" options={{ title: t('tabs.map'), tabBarIcon: icon('map-outline') }} />
      <Tabs.Screen
        name="search"
        options={{ title: t('tabs.search'), tabBarIcon: icon('magnify') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('tabs.settings'), tabBarIcon: icon('cog-outline') }}
      />
    </Tabs>
  );
}

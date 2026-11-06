import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Section } from '@/components/Cards';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { API_URL } from '@/lib/api';
import { googleSignOut } from '@/lib/google';
import { useMe, useUpdateMe } from '@/lib/queries';
import type { Lang } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { colors, spacing } from '@/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const me = useMe();
  const updateMe = useUpdateMe();
  const language = useSettings((s) => s.language);
  const setLanguage = useSettings((s) => s.setLanguage);
  const logout = useAuth((s) => s.logout);

  async function changeLanguage(lang: Lang) {
    await setLanguage(lang); // UI text switches immediately; content queries refetch
    updateMe.mutate({ preferred_lang: lang }); // remember it on the account too
  }

  return (
    <Screen>
      <AppText variant="title">{t('settings.title')}</AppText>

      <Section title={t('settings.account')}>
        <View style={styles.card}>
          <AppText variant="subheading">{me.data?.full_name ?? me.data?.email ?? '…'}</AppText>
          {me.data?.full_name && <AppText muted>{me.data.email}</AppText>}
        </View>
        <Link href="/profile" asChild>
          <Pressable
            style={StyleSheet.flatten([styles.card, styles.row])}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="account-edit-outline" size={22} color={colors.accent} />
            <AppText style={{ flex: 1 }}>{t('settings.profile')}</AppText>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>
        </Link>
        <Link href="/predictions" asChild>
          <Pressable
            style={StyleSheet.flatten([styles.card, styles.row])}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.accent} />
            <AppText style={{ flex: 1 }}>{t('settings.predictions')}</AppText>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>
        </Link>
      </Section>

      <Section title={t('settings.language')}>
        <View style={styles.row}>
          <Chip label="English" selected={language === 'en'} onPress={() => changeLanguage('en')} />
          <Chip label="नेपाली" selected={language === 'ne'} onPress={() => changeLanguage('ne')} />
        </View>
      </Section>

      <Button
        title={t('settings.logout')}
        variant="secondary"
        onPress={async () => {
          await googleSignOut();
          await logout();
        }}
      />
      <AppText variant="caption" muted>
        {t('settings.apiServer')}: {API_URL}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing(4), backgroundColor: colors.surface, borderRadius: 14, gap: spacing(1) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
});

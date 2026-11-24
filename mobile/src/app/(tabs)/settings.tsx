import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Section } from '@/components/Cards';
import { Segmented } from '@/components/Chip';
import { ListCard, PageHeader } from '@/components/Layout';
import { Screen } from '@/components/Screen';
import { API_URL } from '@/lib/api';
import { googleSignOut } from '@/lib/google';
import { clearSafetyData } from '@/lib/safety';
import { useMe, useUpdateMe } from '@/lib/queries';
import type { Lang } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { colors, radii, spacing } from '@/theme';
import { PressableLink } from '@/components/PressableLink';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function LinkRow({
  href,
  icon,
  label,
  last,
}: {
  href:
    | '/profile'
    | '/predictions'
    | '/safety'
    | '/emergency-contacts'
    | '/symptoms'
    | '/symptoms/history';
  icon: IconName;
  label: string;
  last?: boolean;
}) {
  return (
    <PressableLink
      href={href}
      style={[styles.row, !last && styles.divider]}
      accessibilityRole="button"
    >
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      </View>
      <AppText variant="label" weight="semibold" style={{ flex: 1, fontSize: 15 }}>
        {label}
      </AppText>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
    </PressableLink>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const me = useMe();
  const updateMe = useUpdateMe();
  const language = useSettings((s) => s.language) ?? 'en';
  const setLanguage = useSettings((s) => s.setLanguage);
  const logout = useAuth((s) => s.logout);

  async function changeLanguage(lang: Lang) {
    await setLanguage(lang); // UI text switches immediately; content queries refetch
    updateMe.mutate({ preferred_lang: lang }); // remember it on the account too
  }

  const name = me.data?.full_name ?? me.data?.email ?? '…';
  const initial = (me.data?.full_name ?? me.data?.email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <Screen tab>
      <PageHeader back={false} title={t('settings.title')} />

      <View style={styles.account}>
        <View style={styles.avatar}>
          <AppText variant="title" style={{ color: '#FFFFFF' }}>
            {initial}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="subheading" numberOfLines={1} style={{ color: '#FFFFFF' }}>
            {name}
          </AppText>
          {me.data?.full_name && (
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              {me.data.email}
            </AppText>
          )}
        </View>
      </View>

      <Section title={t('settings.account')}>
        <ListCard>
          <LinkRow href="/profile" icon="account-edit-outline" label={t('settings.profile')} />
          <LinkRow
            href="/predictions"
            icon="shield-check-outline"
            label={t('settings.predictions')}
            last
          />
        </ListCard>
      </Section>

      <Section title={t('settings.safety')}>
        <ListCard>
          <LinkRow href="/safety" icon="alarm-light-outline" label={t('safety.openSafety')} />
          <LinkRow
            href="/emergency-contacts"
            icon="account-heart-outline"
            label={t('settings.contacts')}
          />
          <LinkRow href="/symptoms" icon="heart-pulse" label={t('settings.symptoms')} />
          <LinkRow
            href="/symptoms/history"
            icon="history"
            label={t('settings.symptomHistory')}
            last
          />
        </ListCard>
      </Section>

      <Section title={t('settings.language')}>
        <Segmented<Lang>
          value={language}
          onChange={changeLanguage}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ne', label: 'नेपाली' },
          ]}
        />
      </Section>

      <Button
        title={t('settings.logout')}
        variant="secondary"
        icon="logout"
        onPress={async () => {
          await googleSignOut();
          await clearSafetyData(); // the next person on this phone must not get these contacts
          await logout();
        }}
      />
      <AppText variant="small" weight="regular" muted>
        {t('settings.apiServer')}: {API_URL}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(4),
    backgroundColor: colors.navy,
    borderRadius: radii.panel,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    minHeight: 56,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

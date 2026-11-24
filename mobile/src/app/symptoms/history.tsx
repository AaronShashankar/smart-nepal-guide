'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Pill } from '@/components/Chip';
import { PageHeader } from '@/components/Layout';
import { RESULT_ICON, RESULT_TINT, SafetyDisclaimer } from '@/components/Safety';
import { Screen } from '@/components/Screen';
import { Empty, QueryState } from '@/components/StateViews';
import { formatNumber, meters } from '@/lib/format';
import { useSymptomHistory } from '@/lib/queries';
import { flushOutbox, outboxSize } from '@/lib/safety';
import type { SymptomCheckOut } from '@/lib/types';
import { colors, radii, spacing } from '@/theme';

function CheckCard({ check }: { check: SymptomCheckOut }) {
  const { t, i18n } = useTranslation();
  const tint = RESULT_TINT[check.result];
  const when = new Date(check.checked_at).toLocaleString(
    i18n.language === 'ne' ? 'ne-NP' : 'en-GB',
    { dateStyle: 'medium', timeStyle: 'short' },
  );
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <MaterialCommunityIcons name={RESULT_ICON[check.result]} size={24} color={tint.fg} />
        <AppText variant="subheading" style={{ flex: 1, color: tint.fg }}>
          {t(`safety.result_${check.result}`)}
        </AppText>
        <Pill label={t('safety.score', { total: formatNumber(check.total) })} tint={tint} />
      </View>
      <AppText variant="caption" muted>
        {[
          when,
          check.trek_name,
          check.altitude_m != null && t('safety.at', { altitude: meters(check.altitude_m) }),
        ]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
      {check.reasons.map((code) => (
        <AppText key={code} variant="caption" style={{ color: colors.textBody }}>
          • {t(`safety.reason_${code}`)}
        </AppText>
      ))}
    </View>
  );
}

/** Settings → My symptom checks: saved Lake Louise checks, newest first. */
export default function SymptomHistoryScreen() {
  const { t } = useTranslation();
  const history = useSymptomHistory();
  const [waiting, setWaiting] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await flushOutbox().catch(() => 0);
    setWaiting(await outboxSize('symptom'));
    await history.refetch();
    setRefreshing(false);
  }, [history]);

  useFocusEffect(
    useCallback(() => {
      outboxSize('symptom').then(setWaiting);
    }, []),
  );

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <PageHeader title={t('safety.history')} subtitle={t('safety.title')} />
      <SafetyDisclaimer />
      {waiting > 0 && (
        <AppText variant="caption" style={{ color: colors.warning }}>
          {t('safety.waiting', { count: waiting })}
        </AppText>
      )}
      <QueryState query={history}>
        {(items) =>
          items.length === 0 ? (
            <Empty message={t('safety.historyEmpty')} />
          ) : (
            items.map((c) => <CheckCard key={c.id} check={c} />)
          )
        }
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing(4), backgroundColor: colors.surface, borderRadius: radii.card, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
});

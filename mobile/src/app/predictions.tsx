import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { DifficultyBadge } from '@/components/Cards';
import { ReasonList } from '@/components/Risk';
import { Screen } from '@/components/Screen';
import { Empty, QueryState } from '@/components/StateViews';
import { formatNumber, monthName } from '@/lib/format';
import { usePredictions } from '@/lib/queries';
import { colors, spacing } from '@/theme';

/** Risk history: every "Check my risk" result, newest first. */
export default function PredictionsScreen() {
  const { t, i18n } = useTranslation();
  const predictions = usePredictions();

  return (
    <Screen edges={[]}>
      <QueryState query={predictions}>
        {(items) =>
          items.length === 0 ? (
            <Empty message={t('risk.historyEmpty')} />
          ) : (
            items.map((p) => (
              <Link
                key={p.id}
                href={{ pathname: '/trek/[id]/risk', params: { id: p.trek_id } }}
                asChild
              >
                <Pressable style={styles.card} accessibilityRole="button">
                  <View style={styles.header}>
                    <AppText variant="subheading" style={{ flex: 1 }}>
                      {t('risk.inMonth', { trek: p.trek_name, month: monthName(p.month) })}
                    </AppText>
                    <DifficultyBadge level={p.level} />
                  </View>
                  <AppText variant="caption" muted>
                    {new Date(p.created_at).toLocaleDateString(
                      i18n.language === 'ne' ? 'ne-NP' : 'en-GB',
                    )}{' '}
                    ·{' '}
                    {t('risk.confidence', { value: formatNumber(Math.round(p.confidence * 100)) })}
                  </AppText>
                  {p.reasons.length > 0 && <ReasonList reasons={p.reasons} />}
                </Pressable>
              </Link>
            ))
          )
        }
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing(4), backgroundColor: colors.surface, borderRadius: 14, gap: spacing(2) },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
});

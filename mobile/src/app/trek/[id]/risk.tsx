import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Section } from '@/components/Cards';
import { Chip } from '@/components/Chip';
import { AcclimatisationBox, ReasonList } from '@/components/Risk';
import { Screen } from '@/components/Screen';
import { Loading } from '@/components/StateViews';
import { errorMessage } from '@/lib/api';
import { formatNumber, monthName } from '@/lib/format';
import { usePredictRisk, useProfile, useTrek } from '@/lib/queries';
import type { Profile, RiskResult } from '@/lib/types';
import { colors, difficultyColors, spacing } from '@/theme';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const isComplete = (p: Profile) =>
  p.date_of_birth != null && p.fitness_level != null && p.trek_experience != null;

function Result({ result }: { result: RiskResult }) {
  const { t } = useTranslation();
  const color = difficultyColors[result.level];
  return (
    <View style={{ gap: spacing(4) }}>
      <View style={[styles.level, { backgroundColor: `${color}14`, borderColor: color }]}>
        <AppText variant="caption" muted>
          {t('risk.result')} · {monthName(result.month)}
        </AppText>
        <AppText variant="title" style={{ color }}>
          {t(`difficulty.${result.level}`)}
        </AppText>
        <AppText variant="caption" muted>
          {t('risk.confidence', { value: formatNumber(Math.round(result.confidence * 100)) })}
        </AppText>
      </View>

      <Section title={t('risk.why')}>
        {result.reasons.length > 0 ? (
          <ReasonList reasons={result.reasons} />
        ) : (
          <AppText muted>
            {result.level === 'easy' ? t('risk.easyNote') : t('risk.noReasons')}
          </AppText>
        )}
      </Section>

      <Section title={t('risk.warnings')}>
        {result.acclimatisation.status === 'ok' ? (
          <AppText muted>{t('risk.noWarnings')}</AppText>
        ) : (
          <AcclimatisationBox report={result.acclimatisation} />
        )}
      </Section>

      <View style={styles.disclaimer}>
        <MaterialCommunityIcons name="information-outline" size={18} color={colors.textMuted} />
        <AppText variant="caption" muted style={{ flex: 1 }}>
          {t('risk.disclaimer')}
        </AppText>
      </View>
    </View>
  );
}

export default function RiskScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trek = useTrek(id);
  const profile = useProfile();
  const predict = usePredictRisk();
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const check = () => predict.mutate({ trek_id: id, month });

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('risk.title') }} />
      {profile.isPending || trek.isPending ? (
        <Loading />
      ) : profile.data && !isComplete(profile.data) ? (
        <View style={styles.card}>
          <AppText>{t('risk.profileIncomplete')}</AppText>
          <Button title={t('risk.completeProfile')} onPress={() => router.push('/profile')} />
        </View>
      ) : (
        <>
          <AppText muted>{t('risk.intro', { trek: trek.data?.name ?? '' })}</AppText>
          <Section title={t('risk.month')}>
            <View style={styles.months}>
              {MONTHS.map((m) => (
                <Chip
                  key={m}
                  label={monthName(m)}
                  selected={m === month}
                  onPress={() => {
                    setMonth(m);
                    predict.reset();
                  }}
                />
              ))}
            </View>
          </Section>
          <Button title={t('risk.check')} onPress={check} loading={predict.isPending} />
          {predict.isError && (
            <AppText style={{ color: colors.danger }}>
              {errorMessage(predict.error, t('risk.failed'))}
            </AppText>
          )}
          {predict.data && <Result result={predict.data} />}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  level: { borderWidth: 1.5, borderRadius: 16, padding: spacing(4), alignItems: 'center' },
  card: { padding: spacing(4), backgroundColor: colors.surface, borderRadius: 14, gap: spacing(3) },
  disclaimer: { flexDirection: 'row', gap: spacing(2), alignItems: 'flex-start' },
});

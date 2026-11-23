'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Section } from '@/components/Cards';
import { Chip, Pill } from '@/components/Chip';
import { PageHeader } from '@/components/Layout';
import { AcclimatisationBox, ReasonList, RiskGauge, SaferAlternatives } from '@/components/Risk';
import { Screen } from '@/components/Screen';
import { Loading } from '@/components/StateViews';
import { errorMessage } from '@/lib/api';
import { formatNumber, monthName } from '@/lib/format';
import { usePredictRisk, useProfile, useTrek } from '@/lib/queries';
import type { Profile, RiskResult } from '@/lib/types';
import { colors, difficultyTints, GUTTER, radii, shadows, spacing } from '@/theme';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const isComplete = (p: Profile) =>
  p.date_of_birth != null && p.fitness_level != null && p.trek_experience != null;

function Result({ result }: { result: RiskResult }) {
  const { t } = useTranslation();
  const level = t(`difficulty.${result.level}`);
  return (
    <View style={{ gap: 18 }}>
      <View style={styles.gaugeCard} accessibilityLiveRegion="polite">
        <RiskGauge level={result.level} label={t('risk.gaugeLabel', { level })} />
        <AppText variant="small" weight="bold" muted style={styles.upper}>
          {t('risk.forYou')}
        </AppText>
        <AppText
          variant="display"
          style={{ fontSize: 38, lineHeight: 44, color: difficultyTints[result.level].fg }}
        >
          {level}
        </AppText>
        <AppText variant="label" weight="semibold" style={{ color: colors.textSecondary }}>
          {t('risk.confidence', { value: formatNumber(Math.round(result.confidence * 100)) })}
        </AppText>
        <View style={styles.inputs}>
          <Pill label={monthName(result.month)} />
          <Pill
            label={t('risk.fitness', { level: t(`profile.fitness_${result.input.fitness_level}`) })}
          />
          <Pill label={t(`risk.experience_${result.input.trek_experience}`)} />
        </View>
        <Button
          title={t('risk.changeDetails')}
          variant="ghost"
          compact
          onPress={() => router.push('/profile')}
        />
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

      {(result.level === 'hard' || result.level === 'risky') && (
        <SaferAlternatives result={result} />
      )}

      <Section title={t('risk.warnings')}>
        {result.acclimatisation.status === 'ok' ? (
          <AppText muted>{t('risk.noWarnings')}</AppText>
        ) : (
          <AcclimatisationBox report={result.acclimatisation} />
        )}
      </Section>

      <View style={styles.disclaimer}>
        <MaterialCommunityIcons name="information-outline" size={18} color={colors.textMuted} />
        <AppText variant="small" weight="regular" muted style={{ flex: 1, lineHeight: 18 }}>
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
    <Screen>
      <PageHeader title={t('risk.screenTitle')} subtitle={trek.data?.name} />
      {profile.isPending || trek.isPending ? (
        <Loading />
      ) : profile.data && !isComplete(profile.data) ? (
        <View style={styles.card}>
          <AppText>{t('risk.profileIncomplete')}</AppText>
          <Button title={t('risk.completeProfile')} onPress={() => router.push('/profile')} />
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <AppText style={{ color: colors.textBody }}>
              {t('risk.intro', { trek: trek.data?.name ?? '' })}
            </AppText>
            <AppText variant="caption" weight="bold" muted>
              {t('risk.month')}
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.monthScroll}
              contentContainerStyle={styles.months}
            >
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
            </ScrollView>
            <Button
              title={predict.data ? t('risk.checkAgain') : t('risk.check')}
              icon="shield-check-outline"
              onPress={check}
              loading={predict.isPending}
            />
          </View>
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
  card: {
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    gap: spacing(3),
  },
  monthScroll: { marginHorizontal: -spacing(4) },
  months: { gap: spacing(2), paddingHorizontal: spacing(4) },
  gaugeCard: {
    paddingTop: 22,
    paddingHorizontal: GUTTER,
    paddingBottom: spacing(3),
    borderRadius: radii.sheet,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 6,
    ...shadows.card,
  },
  upper: { textTransform: 'uppercase', letterSpacing: 0.7 },
  inputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing(2),
  },
  disclaimer: {
    flexDirection: 'row',
    gap: spacing(2),
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
});

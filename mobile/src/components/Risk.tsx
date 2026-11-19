'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { days, formatNumber, km, meters, monthName } from '@/lib/format';
import { useSaferAlternatives } from '@/lib/queries';
import type {
  Acclimatisation,
  AcclimatisationStatus,
  AlternativeReason,
  Reason,
  RiskResult,
} from '@/lib/types';
import { colors, spacing, statusColors } from '@/theme';

import { AppText } from './AppText';
import { DifficultyBadge, Section } from './Cards';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const STATUS_ICON: Record<AcclimatisationStatus, IconName> = {
  ok: 'check-circle-outline',
  caution: 'alert-outline',
  danger: 'alert-octagon-outline',
};

export const signedMeters = (m: number) => (m > 0 ? `+${meters(m)}` : meters(m));

export function StatusBadge({ status }: { status: AcclimatisationStatus }) {
  const { t } = useTranslation();
  const color = statusColors[status];
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A`, borderColor: color }]}>
      <MaterialCommunityIcons name={STATUS_ICON[status]} size={14} color={color} />
      <AppText variant="caption" style={{ color }}>
        {t(`itinerary.status_${status}`)}
      </AppText>
    </View>
  );
}

/** The summary box at the top of the itinerary (and in the risk result). */
export function AcclimatisationBox({ report }: { report: Acclimatisation }) {
  const { t } = useTranslation();
  const color = statusColors[report.status];
  return (
    <View style={[styles.box, { borderColor: color, backgroundColor: `${color}12` }]}>
      <View style={styles.row}>
        <MaterialCommunityIcons name={STATUS_ICON[report.status]} size={22} color={color} />
        <AppText variant="label" style={{ flex: 1, color }}>
          {t(`itinerary.summary_${report.status}`)}
        </AppText>
      </View>
      {report.suggested_rest_days.map((r) => (
        <View key={r.before_day} style={styles.row}>
          <MaterialCommunityIcons name="bed-outline" size={18} color={colors.text} />
          <AppText style={{ flex: 1 }}>
            {t('itinerary.restAt', {
              place: r.place,
              altitude: meters(r.altitude_m),
              day: formatNumber(r.before_day),
            })}
          </AppText>
        </View>
      ))}
      <AppText variant="caption" muted>
        {t('itinerary.rules')}
      </AppText>
    </View>
  );
}

/** One "Why this rating?" sentence per reason code, with numbers in the user's language. */
export function reasonText(t: TFunction, r: Reason): string {
  const p = r.params;
  return t(`reasons.${r.code}`, {
    altitude: p.altitude != null ? meters(p.altitude) : '',
    gain: p.gain != null ? meters(p.gain) : '',
    day: p.day != null ? formatNumber(p.day) : '?',
    age: p.age != null ? formatNumber(p.age) : '',
    km: p.km != null ? km(p.km) : '',
  });
}

export function ReasonList({ reasons }: { reasons: Reason[] }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing(2) }}>
      {reasons.map((r) => (
        <View key={r.code} style={styles.row}>
          <MaterialCommunityIcons name="chevron-right-circle" size={18} color={colors.accent} />
          <AppText style={{ flex: 1 }}>{reasonText(t, r)}</AppText>
        </View>
      ))}
    </View>
  );
}

function alternativeReason(
  t: TFunction,
  why: AlternativeReason,
  from: number | null,
  to: number | null,
): string {
  if (why === 'LOWER_RISK' || from == null || to == null) return t('alternatives.why_LOWER_RISK');
  const unit = { LOWER_ALTITUDE: meters, SMALLER_GAIN: meters, FEWER_DAYS: days, SHORTER_DAYS: km }[
    why
  ];
  return t(`alternatives.why_${why}`, { from: unit(from), to: unit(to) });
}

/**
 * V2 Phase 1: similar treks (KNN) that the risk model rates lower for this traveller and month.
 * Shown only for a hard or risky result, and only when there is at least one; never a trek that
 * is just as risky. While loading or on an error nothing is shown.
 */
export function SaferAlternatives({ result }: { result: RiskResult }) {
  const { t } = useTranslation();
  const query = useSaferAlternatives(result.trek_id, result.month, result.id);
  const items = query.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <Section title={t('alternatives.title')}>
      <AppText variant="caption" muted>
        {t('alternatives.hint', { month: monthName(result.month) })}
      </AppText>
      {items.map((alt) => (
        <Pressable
          key={alt.trek.id}
          style={styles.alternative}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/trek/[id]', params: { id: alt.trek.id } })}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="subheading">{alt.trek.name}</AppText>
            <AppText variant="caption" muted>
              {alternativeReason(t, alt.why, alt.why_from, alt.why_to)}
            </AppText>
          </View>
          <DifficultyBadge level={alt.level} />
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
        </Pressable>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  alternative: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    padding: spacing(3.5),
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing(2),
    paddingVertical: 1,
  },
  box: { borderWidth: 1, borderRadius: 14, padding: spacing(4), gap: spacing(2.5) },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
});

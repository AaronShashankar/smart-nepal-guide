'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { days, formatNumber, km, meters, monthName } from '@/lib/format';
import { useSaferAlternatives } from '@/lib/queries';
import type {
  Acclimatisation,
  AcclimatisationStatus,
  AlternativeReason,
  Reason,
  RiskLevel,
  RiskResult,
} from '@/lib/types';
import { colors, difficultyColors, difficultyTints, radii, spacing, statusTints } from '@/theme';

import { AppText } from './AppText';
import { DifficultyBadge } from './Cards';
import { Pill } from './Chip';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const STATUS_ICON: Record<AcclimatisationStatus, IconName> = {
  ok: 'check-circle-outline',
  caution: 'alert-outline',
  danger: 'alert-octagon-outline',
};

export const signedMeters = (m: number) => (m > 0 ? `+${meters(m)}` : meters(m));

export function StatusBadge({
  status,
  rest,
}: {
  status: AcclimatisationStatus;
  /** a planned rest day: blue "Rest day" pill instead of the status */
  rest?: boolean;
}) {
  const { t } = useTranslation();
  if (rest) return <Pill label={t('itinerary.rest')} tint={statusTints.rest} icon="bed-outline" />;
  return (
    <Pill
      label={t(`itinerary.status_${status}`)}
      tint={statusTints[status]}
      icon={STATUS_ICON[status]}
    />
  );
}

/** The summary box at the top of the itinerary (and in the risk result). */
export function AcclimatisationBox({ report }: { report: Acclimatisation }) {
  const { t } = useTranslation();
  const tint = statusTints[report.status];
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: tint.bg }]}>
          <MaterialCommunityIcons name={STATUS_ICON[report.status]} size={20} color={tint.fg} />
        </View>
        <AppText variant="label" style={[styles.iconText, { color: tint.fg }]}>
          {t(`itinerary.summary_${report.status}`)}
        </AppText>
      </View>
      {report.suggested_rest_days.map((r) => (
        <View key={r.before_day} style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: statusTints.rest.bg }]}>
            <MaterialCommunityIcons name="bed-outline" size={20} color={statusTints.rest.fg} />
          </View>
          <AppText
            variant="caption"
            weight="regular"
            style={[styles.iconText, { color: colors.textBody }]}
          >
            {t('itinerary.restAt', {
              place: r.place,
              altitude: meters(r.altitude_m),
              day: formatNumber(r.before_day),
            })}
          </AppText>
        </View>
      ))}
      <AppText variant="small" weight="regular" muted>
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

/** "Why?" cards: a red warning icon and the sentence for each reason. */
export function ReasonList({ reasons }: { reasons: Reason[] }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 10 }}>
      {reasons.map((r) => (
        <View key={r.code} style={styles.reason}>
          <View style={[styles.iconBox, { backgroundColor: difficultyTints.risky.bg }]}>
            <MaterialCommunityIcons
              name="alert-outline"
              size={20}
              color={difficultyTints.risky.fg}
            />
          </View>
          <AppText variant="label" weight="semibold" style={styles.iconText}>
            {reasonText(t, r)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const LEVELS: RiskLevel[] = ['easy', 'moderate', 'hard', 'risky'];

/**
 * Half-circle meter with four coloured bands (easy → risky) and the needle in the middle of the
 * result's band. The level is always written under it too, so colour is never the only signal.
 */
export function RiskGauge({ level, label }: { level: RiskLevel; label: string }) {
  const cx = 150;
  const cy = 130;
  const r = 110;
  const point = (share: number, radius = r) => {
    const a = Math.PI * (1 - share); // share 0 = left end, 1 = right end
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)];
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const [nx, ny] = point((LEVELS.indexOf(level) + 0.5) / LEVELS.length, 82);
  return (
    <Svg
      width={300}
      height={150}
      viewBox="0 0 300 150"
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {LEVELS.map((l, i) => (
        <Path
          key={l}
          d={arc(i / LEVELS.length, (i + 1) / LEVELS.length)}
          fill="none"
          stroke={difficultyColors[l]}
          strokeWidth={18}
        />
      ))}
      <Line
        x1={cx}
        y1={cy}
        x2={nx}
        y2={ny}
        stroke={colors.ink}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <Circle cx={cx} cy={cy} r={11} fill={colors.ink} />
      <Circle cx={cx} cy={cy} r={4} fill="#FFFFFF" />
    </Svg>
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
    <View style={styles.altPanel}>
      <View style={{ gap: 4 }}>
        <AppText variant="heading" style={{ color: '#FFFFFF' }} accessibilityRole="header">
          {t('alternatives.title')}
        </AppText>
        <AppText variant="caption" weight="regular" style={{ color: 'rgba(255,255,255,0.78)' }}>
          {t('alternatives.hint', { month: monthName(result.month) })}
        </AppText>
      </View>
      {items.map((alt) => (
        <Pressable
          key={alt.trek.id}
          style={({ pressed }) => [styles.alternative, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/trek/[id]', params: { id: alt.trek.id } })}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="label" style={{ fontSize: 15 }}>
              {alt.trek.name}
            </AppText>
            <View style={styles.altWhy}>
              <MaterialCommunityIcons name="arrow-down" size={14} color={colors.success} />
              <AppText
                variant="caption"
                weight="semibold"
                style={{ color: colors.success, flex: 1 }}
              >
                {alternativeReason(t, alt.why, alt.why_from, alt.why_to)}
              </AppText>
            </View>
            <DifficultyBadge level={alt.level} prefix={t('risk.forYou')} />
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  altPanel: { gap: 10, padding: 18, borderRadius: 26, backgroundColor: colors.navy },
  alternative: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: 18,
  },
  altWhy: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  box: {
    borderRadius: radii.card,
    padding: spacing(4),
    gap: spacing(3),
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(3) },
  reason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(3),
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { flex: 1, paddingTop: 7 },
});

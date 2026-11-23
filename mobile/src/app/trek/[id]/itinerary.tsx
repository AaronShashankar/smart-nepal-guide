'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AltitudeChart } from '@/components/AltitudeChart';
import { AppText } from '@/components/AppText';
import { PageHeader, StatTiles } from '@/components/Layout';
import { AcclimatisationBox, signedMeters, StatusBadge } from '@/components/Risk';
import { QueryState } from '@/components/StateViews';
import { formatNumber, km, meters } from '@/lib/format';
import { useAcclimatisation, useAltitudeProfile, useItinerary, useTrek } from '@/lib/queries';
import type { Acclimatisation, Itinerary, Stage } from '@/lib/types';
import { colors, GUTTER, spacing, statusTints } from '@/theme';

type DayCheck = Acclimatisation['days'][number];

/** One day in the timeline: number badge on a line, then where you sleep and what the day is. */
function DayRow({
  stage,
  check,
  highest,
  last,
}: {
  stage: Stage;
  check?: DayCheck;
  highest: boolean;
  last: boolean;
}) {
  const { t } = useTranslation();
  const status = check?.status ?? 'ok';
  const warnings = (check?.codes ?? []).filter((c) => c !== 'REST_DAY');
  const facts = stage.is_rest_day
    ? [t('itinerary.rest')]
    : [
        `${stage.from_place.name} → ${stage.to_place.name}`,
        signedMeters(stage.gain_m),
        km(stage.distance_km),
        t('itinerary.hours', { value: formatNumber(stage.walk_hours, 1) }),
      ];
  return (
    <View style={styles.dayRow}>
      <View style={styles.rail}>
        <View style={[styles.badge, highest && styles.badgeOn]}>
          <AppText
            variant="label"
            weight="extrabold"
            style={{ color: highest ? '#FFFFFF' : colors.text }}
          >
            {formatNumber(stage.day)}
          </AppText>
        </View>
        {!last && <View style={styles.railLine} />}
      </View>
      <View style={styles.dayBody}>
        <View style={styles.between}>
          <AppText variant="label" style={{ flex: 1, fontSize: 15 }}>
            {stage.to_place.name}
          </AppText>
          <AppText variant="label">{meters(stage.sleep_altitude_m)}</AppText>
        </View>
        <View style={[styles.between, { alignItems: 'flex-start' }]}>
          <AppText variant="caption" weight="regular" muted style={{ flex: 1 }}>
            {facts.join(' · ')}
          </AppText>
          <StatusBadge status={status} rest={stage.is_rest_day && status === 'ok'} />
        </View>
        {stage.highest_point_m != null && (
          <AppText variant="small" weight="regular" muted>
            {t('itinerary.highest', { altitude: meters(stage.highest_point_m) })}
          </AppText>
        )}
        {warnings.map((code) => (
          <AppText
            key={code}
            variant="caption"
            weight="semibold"
            style={{ color: statusTints[status].fg }}
          >
            {t(`itinerary.code_${code}`, { gain: signedMeters(check?.gain_m ?? 0) })}
          </AppText>
        ))}
        {stage.notes && (
          <AppText variant="small" weight="regular" muted>
            {stage.notes}
          </AppText>
        )}
        {stage.teahouse_count > 0 && (
          <Pressable
            style={styles.teahouses}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/teahouses/[placeId]',
                params: { placeId: stage.to_place.id, name: stage.to_place.name },
              })
            }
          >
            <MaterialCommunityIcons name="home-city-outline" size={18} color={colors.primary} />
            <AppText variant="caption" weight="bold" style={{ color: colors.primary, flex: 1 }}>
              {t('teahouses.link', {
                count: stage.teahouse_count,
                value: formatNumber(stage.teahouse_count),
              })}
            </AppText>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Summary({ itinerary }: { itinerary: Itinerary }) {
  const { t } = useTranslation();
  const s = itinerary.summary;
  const highestNight = itinerary.stages.find(
    (st) => st.sleep_altitude_m === s.max_sleep_altitude_m,
  );
  return (
    <StatTiles
      compact
      tiles={[
        {
          label: t('itinerary.maxGain'),
          value: s.max_daily_gain_day ? signedMeters(s.max_daily_gain_m) : '—',
          sub: s.max_daily_gain_day
            ? t('itinerary.day', { day: formatNumber(s.max_daily_gain_day) })
            : undefined,
          color: colors.warning,
        },
        {
          label: t('itinerary.sleepMax'),
          value: meters(s.max_sleep_altitude_m),
          sub: highestNight?.to_place.name,
        },
        {
          label: t('itinerary.restDays'),
          value: formatNumber(s.rest_days),
          color: colors.success,
        },
      ]}
    />
  );
}

export default function ItineraryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trek = useTrek(id);
  const itinerary = useItinerary(id);
  const report = useAcclimatisation(id);
  const profile = useAltitudeProfile(id);

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <QueryState query={itinerary}>
        {(it) => {
          const checks = new Map(report.data?.days.map((d) => [d.day, d]));
          const top = Math.max(...it.stages.map((st) => st.sleep_altitude_m));
          const topDay = it.stages.find((st) => st.sleep_altitude_m === top)?.day;
          return (
            <FlatList
              style={styles.fill}
              contentContainerStyle={styles.list}
              data={it.stages}
              keyExtractor={(s) => String(s.day)}
              ListHeaderComponent={
                <View style={{ gap: 18, marginBottom: spacing(5) }}>
                  <PageHeader title={t('itinerary.title')} subtitle={trek.data?.name} />
                  {profile.data && <AltitudeChart profile={profile.data} />}
                  <Summary itinerary={it} />
                  {report.data && <AcclimatisationBox report={report.data} />}
                  <AppText variant="heading" accessibilityRole="header" style={{ marginTop: 6 }}>
                    {t('itinerary.dayByDay')}
                  </AppText>
                </View>
              }
              renderItem={({ item, index }) => (
                <DayRow
                  stage={item}
                  check={checks.get(item.day)}
                  highest={item.day === topDay}
                  last={index === it.stages.length - 1}
                />
              )}
            />
          );
        }}
      </QueryState>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: GUTTER, paddingTop: spacing(2), paddingBottom: spacing(10) },
  dayRow: { flexDirection: 'row', gap: 14 },
  rail: { width: 36, alignItems: 'center' },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOn: { backgroundColor: colors.primary },
  railLine: { flex: 1, width: 2, minHeight: 12, backgroundColor: colors.border },
  dayBody: { flex: 1, minWidth: 0, paddingTop: 6, paddingBottom: spacing(4), gap: 4 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  teahouses: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: 2,
    minHeight: 44,
  },
});

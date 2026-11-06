import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { AcclimatisationBox, signedMeters, StatusBadge } from '@/components/Risk';
import { QueryState } from '@/components/StateViews';
import { formatNumber, km, meters } from '@/lib/format';
import { useAcclimatisation, useItinerary } from '@/lib/queries';
import type { Acclimatisation, Itinerary, Stage } from '@/lib/types';
import { colors, spacing, statusColors } from '@/theme';

type DayCheck = Acclimatisation['days'][number];

function DayCard({ stage, check }: { stage: Stage; check?: DayCheck }) {
  const { t } = useTranslation();
  const status = check?.status ?? 'ok';
  const warnings = (check?.codes ?? []).filter((c) => c !== 'REST_DAY');
  return (
    <View style={[styles.card, { borderLeftColor: statusColors[status] }]}>
      <View style={styles.header}>
        <AppText variant="label" style={{ color: colors.primary }}>
          {t('itinerary.day', { day: formatNumber(stage.day) })}
        </AppText>
        <StatusBadge status={status} />
      </View>

      {stage.is_rest_day ? (
        <>
          <AppText variant="subheading">{stage.to_place.name}</AppText>
          <AppText muted>
            {t('itinerary.rest')} · {meters(stage.sleep_altitude_m)}
          </AppText>
        </>
      ) : (
        <>
          <AppText variant="subheading">
            {stage.from_place.name} → {stage.to_place.name}
          </AppText>
          <AppText>
            {meters(stage.from_place.altitude_m)} → {meters(stage.sleep_altitude_m)} (
            {signedMeters(stage.gain_m)})
          </AppText>
        </>
      )}

      <View style={styles.facts}>
        <Fact icon="map-marker-distance" text={km(stage.distance_km)} />
        <Fact
          icon="clock-outline"
          text={t('itinerary.hours', { value: formatNumber(stage.walk_hours, 1) })}
        />
        {stage.highest_point_m != null && (
          <Fact
            icon="flag-triangle"
            text={t('itinerary.highest', { altitude: meters(stage.highest_point_m) })}
          />
        )}
      </View>

      {warnings.map((code) => (
        <AppText key={code} variant="caption" style={{ color: statusColors[status] }}>
          {t(`itinerary.code_${code}`, { gain: signedMeters(check?.gain_m ?? 0) })}
        </AppText>
      ))}
      {stage.notes && (
        <AppText variant="caption" muted>
          {stage.notes}
        </AppText>
      )}
    </View>
  );
}

function Fact({
  icon,
  text,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.fact}>
      <MaterialCommunityIcons name={icon} size={15} color={colors.textMuted} />
      <AppText variant="caption" muted>
        {text}
      </AppText>
    </View>
  );
}

function Summary({ itinerary }: { itinerary: Itinerary }) {
  const { t } = useTranslation();
  const s = itinerary.summary;
  const items = [
    {
      label: t('itinerary.maxGain'),
      value: s.max_daily_gain_day
        ? `${signedMeters(s.max_daily_gain_m)} · ${t('itinerary.day', { day: formatNumber(s.max_daily_gain_day) })}`
        : '—',
    },
    { label: t('itinerary.sleepMax'), value: meters(s.max_sleep_altitude_m) },
    { label: t('itinerary.restDays'), value: formatNumber(s.rest_days) },
  ];
  return (
    <View style={styles.summary}>
      {items.map((i) => (
        <View key={i.label} style={styles.summaryItem}>
          <AppText variant="caption" muted>
            {i.label}
          </AppText>
          <AppText variant="label">{i.value}</AppText>
        </View>
      ))}
    </View>
  );
}

export default function ItineraryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const itinerary = useItinerary(id);
  const report = useAcclimatisation(id);

  return (
    <>
      <Stack.Screen options={{ title: t('itinerary.title') }} />
      <QueryState query={itinerary}>
        {(it) => {
          const checks = new Map(report.data?.days.map((d) => [d.day, d]));
          return (
            <FlatList
              style={{ backgroundColor: colors.background }}
              contentContainerStyle={styles.list}
              data={it.stages}
              keyExtractor={(s) => String(s.day)}
              ListHeaderComponent={
                <View style={{ gap: spacing(3) }}>
                  <Summary itinerary={it} />
                  {report.data && <AcclimatisationBox report={report.data} />}
                </View>
              }
              renderItem={({ item }) => <DayCard stage={item} check={checks.get(item.day)} />}
            />
          );
        }}
      </QueryState>
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing(4), gap: spacing(3), paddingBottom: spacing(10) },
  card: {
    padding: spacing(3.5),
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderLeftWidth: 4,
    gap: spacing(1),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing(4), rowGap: spacing(1) },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summary: { flexDirection: 'row', gap: spacing(2) },
  summaryItem: {
    flex: 1,
    padding: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: 2,
  },
});

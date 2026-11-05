import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { DifficultyBadge, Section } from '@/components/Cards';
import { QueryState } from '@/components/StateViews';
import { days, km, meters, npr } from '@/lib/format';
import { useTrek } from '@/lib/queries';
import type { PlaceRef } from '@/lib/types';
import { colors, spacing } from '@/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function Stat({ icon, label, value }: { icon: IconName; label: string; value: React.ReactNode }) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.accent} />
      <AppText variant="caption" muted>
        {label}
      </AppText>
      {typeof value === 'string' ? <AppText variant="subheading">{value}</AppText> : value}
    </View>
  );
}

function PlaceStop({ label, place }: { label: string; place: PlaceRef }) {
  return (
    <Link href={{ pathname: '/place/[id]', params: { id: place.id } }} asChild>
      <Pressable style={styles.stop} accessibilityRole="button">
        <AppText variant="caption" muted>
          {label}
        </AppText>
        <AppText variant="subheading">{place.name}</AppText>
        <AppText variant="caption" muted>
          {meters(place.altitude_m)}
        </AppText>
      </Pressable>
    </Link>
  );
}

export default function TrekDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trek = useTrek(id);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body}>
      <Stack.Screen options={{ title: trek.data?.name ?? '' }} />
      <QueryState query={trek}>
        {(tr) => (
          <>
            <View style={{ gap: spacing(1) }}>
              <AppText variant="title">{tr.name}</AppText>
              <AppText muted>{tr.region}</AppText>
            </View>

            <View style={styles.stats}>
              <Stat icon="calendar-range" label={t('trek.days')} value={days(tr.total_days)} />
              <Stat
                icon="map-marker-distance"
                label={t('trek.distance')}
                value={km(tr.total_distance_km)}
              />
              <Stat
                icon="image-filter-hdr"
                label={t('trek.maxAltitude')}
                value={meters(tr.max_altitude_m)}
              />
              <Stat
                icon="speedometer"
                label={t('trek.difficulty')}
                value={<DifficultyBadge level={tr.base_difficulty} />}
              />
            </View>

            {tr.overview && (
              <Section title={t('trek.overview')}>
                <AppText>{tr.overview}</AppText>
              </Section>
            )}

            {tr.start_place && tr.end_place && (
              <Section title={t('trek.route')}>
                <View style={styles.route}>
                  <PlaceStop label={t('trek.start')} place={tr.start_place} />
                  <MaterialCommunityIcons name="arrow-right" size={22} color={colors.textMuted} />
                  <PlaceStop label={t('trek.end')} place={tr.end_place} />
                </View>
              </Section>
            )}

            {tr.permits.length > 0 && (
              <Section title={t('trek.permits')}>
                {tr.permits.map((p) => (
                  <View key={p.code} style={styles.card}>
                    <AppText variant="subheading">
                      {p.name} ({p.code})
                    </AppText>
                    {p.description && (
                      <AppText muted variant="caption">
                        {p.description}
                      </AppText>
                    )}
                    <View style={styles.fees}>
                      <AppText variant="caption">
                        {t('trek.feeForeign')}: {npr(p.fee_foreign_npr)}
                      </AppText>
                      {p.fee_saarc_npr != null && (
                        <AppText variant="caption">
                          {t('trek.feeSaarc')}: {npr(p.fee_saarc_npr)}
                        </AppText>
                      )}
                      {p.fee_nepali_npr != null && (
                        <AppText variant="caption">
                          {t('trek.feeNepali')}: {npr(p.fee_nepali_npr)}
                        </AppText>
                      )}
                    </View>
                  </View>
                ))}
              </Section>
            )}

            <View style={[styles.card, styles.note]}>
              <MaterialCommunityIcons name="information-outline" size={20} color={colors.accent} />
              <AppText variant="caption" style={{ flex: 1 }}>
                {t('trek.itinerarySoon')}
              </AppText>
            </View>
          </>
        )}
      </QueryState>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing(4), gap: spacing(5), paddingBottom: spacing(10) },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2.5) },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: 14,
    gap: 2,
    alignItems: 'flex-start',
  },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  stop: { flex: 1, padding: spacing(3), backgroundColor: colors.surface, borderRadius: 14 },
  card: {
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: 14,
    gap: spacing(1.5),
  },
  fees: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing(4) },
  note: { flexDirection: 'row', gap: spacing(2), alignItems: 'flex-start' },
});

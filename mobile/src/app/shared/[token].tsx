import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { CategoryIcon, Section } from '@/components/Cards';
import { Screen } from '@/components/Screen';
import { Empty, QueryState } from '@/components/StateViews';
import { TripMap } from '@/components/TripMap';
import { formatNumber, km } from '@/lib/format';
import { useSharedTrip } from '@/lib/queries';
import { colors, spacing } from '@/theme';

/** Read-only trip opened from a share link (smartnepalguide://shared/{token}). */
export default function SharedTripScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const trip = useSharedTrip(token);

  if (trip.isError) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: t('share.sharedTitle') }} />
        <Empty message={t('share.gone')} />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: trip.data?.title ?? t('share.sharedTitle') }} />
      <QueryState query={trip}>
        {(tr) => {
          const byId = new Map(tr.stops.map((s) => [s.id, s]));
          return (
            <>
              <View style={styles.banner}>
                <MaterialCommunityIcons name="eye-outline" size={20} color={colors.accent} />
                <AppText variant="caption" style={{ flex: 1 }}>
                  {t('share.readOnly')}
                </AppText>
              </View>
              <AppText variant="title">{tr.title}</AppText>
              {tr.stops.length > 0 && <TripMap stops={tr.stops} />}
              {tr.days.length > 0 ? (
                <Section title={t('trips.plan')} right={<AppText muted>{km(tr.total_km)}</AppText>}>
                  {tr.days.map((d) => (
                    <View key={d.day_no} style={styles.card}>
                      <AppText variant="label" style={{ color: colors.primary }}>
                        {t('itinerary.day', { day: formatNumber(d.day_no) })}
                      </AppText>
                      <AppText>
                        {d.stop_ids.map((id) => byId.get(id)?.place.name).join(' → ')}
                      </AppText>
                    </View>
                  ))}
                </Section>
              ) : (
                <Section title={t('trips.stopsTitle')}>
                  {tr.stops.map((s) => (
                    <View key={s.id} style={[styles.card, styles.row]}>
                      <CategoryIcon category={s.place.category} />
                      <AppText>{s.place.name}</AppText>
                    </View>
                  ))}
                </Section>
              )}
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing(2),
    padding: spacing(3),
    borderRadius: 12,
    backgroundColor: '#E8EEF8',
  },
  card: { padding: spacing(3.5), backgroundColor: colors.surface, borderRadius: 14, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
});

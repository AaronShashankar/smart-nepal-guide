import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Empty, QueryState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/api';
import { days, formatNumber, km } from '@/lib/format';
import { useCreateTrip, useTrips } from '@/lib/queries';
import type { TripSummary } from '@/lib/types';
import { colors, spacing } from '@/theme';

function TripRow({ trip }: { trip: TripSummary }) {
  const { t } = useTranslation();
  const facts = [
    t('trips.stops', { count: trip.stop_count, value: formatNumber(trip.stop_count) }),
  ];
  if (trip.total_days) facts.push(days(trip.total_days));
  if (trip.total_km != null) facts.push(km(trip.total_km));
  return (
    <Link href={{ pathname: '/trip/[id]', params: { id: trip.id } }} asChild>
      <Pressable style={styles.row} accessibilityRole="button">
        <MaterialCommunityIcons name="map-marker-path" size={26} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <AppText variant="subheading">{trip.title}</AppText>
          <AppText variant="caption" muted>
            {facts.join(' · ')}
            {trip.start_date ? ` · ${trip.start_date}` : ''}
          </AppText>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
      </Pressable>
    </Link>
  );
}

export default function TripsScreen() {
  const { t } = useTranslation();
  const trips = useTrips();
  const create = useCreateTrip();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) return;
    setError(null);
    try {
      const trip = await create.mutateAsync({ title: title.trim() });
      setTitle('');
      router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
    } catch (e) {
      setError(errorMessage(e, t('common.error')));
    }
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={trips.isRefetching}
          onRefresh={() => {
            trips.refetch();
          }}
        />
      }
    >
      <AppText variant="title">{t('trips.title')}</AppText>
      <AppText muted>{t('trips.intro')}</AppText>

      <View style={styles.card}>
        <TextField
          label={t('trips.newTrip')}
          placeholder={t('trips.titlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Button
          title={t('trips.create')}
          onPress={submit}
          loading={create.isPending}
          disabled={!title.trim()}
        />
        {error && <AppText style={{ color: colors.danger }}>{error}</AppText>}
      </View>

      <QueryState query={trips}>
        {(items) =>
          items.length === 0 ? (
            <Empty message={t('trips.empty')} />
          ) : (
            <View style={{ gap: spacing(2.5) }}>
              {items.map((trip) => (
                <TripRow key={trip.id} trip={trip} />
              ))}
            </View>
          )
        }
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing(4), backgroundColor: colors.surface, borderRadius: 14, gap: spacing(3) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3.5),
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
});

'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/Layout';
import { Screen } from '@/components/Screen';
import { Empty, QueryState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/api';
import { days, formatNumber, km } from '@/lib/format';
import { useCreateTrip, useTrips } from '@/lib/queries';
import type { TripSummary } from '@/lib/types';
import { colors, radii, shadows, spacing } from '@/theme';

function TripRow({ trip }: { trip: TripSummary }) {
  const { t } = useTranslation();
  const facts = [
    t('trips.stops', { count: trip.stop_count, value: formatNumber(trip.stop_count) }),
  ];
  if (trip.total_days) facts.push(days(trip.total_days));
  if (trip.total_km != null) facts.push(km(trip.total_km));
  return (
    <Link href={{ pathname: '/trip/[id]', params: { id: trip.id } }} asChild>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <View style={styles.rowIcon}>
          <MaterialCommunityIcons name="map-marker-path" size={24} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
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
      tab
      refreshControl={
        <RefreshControl
          refreshing={trips.isRefetching}
          onRefresh={() => {
            trips.refetch();
          }}
        />
      }
    >
      <PageHeader back={false} title={t('trips.title')} />
      <AppText style={{ color: colors.textBody, marginTop: -spacing(2) }}>
        {t('trips.intro')}
      </AppText>

      <QueryState query={trips}>
        {(items) =>
          items.length === 0 ? (
            <Empty message={t('trips.empty')} />
          ) : (
            <View style={{ gap: spacing(3) }}>
              {items.map((trip) => (
                <TripRow key={trip.id} trip={trip} />
              ))}
            </View>
          )
        }
      </QueryState>

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
          icon="plus"
          onPress={submit}
          loading={create.isPending}
          disabled={!title.trim()}
        />
        {error && <AppText style={{ color: colors.danger }}>{error}</AppText>}
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    ...shadows.card,
  },
  rowIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

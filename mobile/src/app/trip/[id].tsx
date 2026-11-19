'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { BudgetTable } from '@/components/BudgetTable';
import { Button } from '@/components/Button';
import { CategoryIcon, Section } from '@/components/Cards';
import { Screen } from '@/components/Screen';
import { QueryState } from '@/components/StateViews';
import { TripMap } from '@/components/TripMap';
import { errorMessage } from '@/lib/api';
import { formatNumber, km, npr } from '@/lib/format';
import {
  useDeleteTrip,
  useOptimiseTrip,
  useRemoveStop,
  useShareTrip,
  useStopSharing,
  useTrip,
  useTripBudget,
} from '@/lib/queries';
import type { TripDetail, TripStop } from '@/lib/types';
import { colors, spacing } from '@/theme';

const hours = (h: number) => formatNumber(Math.round(h * 10) / 10, 1);

function StopRow({ stop, onRemove }: { stop: TripStop; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.stop}>
      <View style={styles.number}>
        <AppText variant="label" style={{ color: '#fff' }}>
          {stop.visit_order != null ? formatNumber(stop.visit_order) : '•'}
        </AppText>
      </View>
      <Pressable
        style={{ flex: 1 }}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/place/[id]', params: { id: stop.place.id } })}
      >
        <AppText variant="subheading" numberOfLines={1}>
          {stop.place.name}
        </AppText>
        <View style={styles.inline}>
          <CategoryIcon category={stop.place.category} size={14} />
          <AppText variant="caption" muted>
            {t('trips.visitHours', { value: hours(stop.visit_hours) })}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={t('trips.remove')}
        hitSlop={10}
      >
        <MaterialCommunityIcons name="close-circle-outline" size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

function DayPlan({ trip }: { trip: TripDetail }) {
  const { t } = useTranslation();
  const byId = new Map(trip.stops.map((s) => [s.id, s]));
  return (
    <Section
      title={t('trips.plan')}
      right={
        <AppText variant="caption" muted>
          {km(trip.total_km)}
        </AppText>
      }
    >
      {trip.days.map((d) => (
        <View key={d.day_no} style={styles.day}>
          <AppText variant="label" style={{ color: colors.primary }}>
            {t('itinerary.day', { day: formatNumber(d.day_no) })}
          </AppText>
          <AppText>{d.stop_ids.map((id) => byId.get(id)?.place.name).join(' → ')}</AppText>
          <AppText variant="caption" muted>
            {t('trips.dayFacts', {
              km: km(d.km),
              travel: hours(d.travel_hours),
              visit: hours(d.visit_hours),
            })}
          </AppText>
        </View>
      ))}
      {trip.nearest_neighbour_km != null && trip.total_km != null && (
        <AppText variant="caption" muted>
          {t('trips.improvement', {
            before: km(trip.nearest_neighbour_km),
            after: km(trip.total_km),
          })}
        </AppText>
      )}
    </Section>
  );
}

function TripBudget({ trip }: { trip: TripDetail }) {
  const { t } = useTranslation();
  const budget = useTripBudget();
  // A new estimate is only valid for the current plan: forget it when the plan changes.
  const current = budget.data && trip.estimated_budget_npr === budget.data.total_npr;
  return (
    <Section title={t('budget.title')}>
      {current ? (
        <BudgetTable budget={budget.data!} />
      ) : (
        trip.estimated_budget_npr != null && (
          <AppText muted>{t('budget.last', { total: npr(trip.estimated_budget_npr) })}</AppText>
        )
      )}
      <Button
        title={current ? t('budget.again') : t('budget.estimate')}
        variant="secondary"
        icon={
          <MaterialCommunityIcons
            name="calculator-variant-outline"
            size={20}
            color={colors.primary}
          />
        }
        loading={budget.isPending}
        onPress={() => budget.mutate(trip.id)}
      />
      {budget.isError && (
        <AppText style={{ color: colors.danger }}>
          {errorMessage(budget.error, t('common.error'))}
        </AppText>
      )}
    </Section>
  );
}

function ShareButtons({ trip }: { trip: TripDetail }) {
  const { t } = useTranslation();
  const share = useShareTrip();
  const stop = useStopSharing();

  async function onShare() {
    try {
      const links = await share.mutateAsync(trip.id);
      await Share.share({ message: t('share.message', { title: trip.title, url: links.url }) });
    } catch (e) {
      Alert.alert(t('share.failed'), errorMessage(e, t('common.error')));
    }
  }

  function onStop() {
    Alert.alert(t('share.stopTitle'), t('share.stopBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('share.stop'), style: 'destructive', onPress: () => stop.mutate(trip.id) },
    ]);
  }

  return (
    <View style={{ gap: spacing(2) }}>
      <Button
        title={t('share.button')}
        variant="secondary"
        icon={
          <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.primary} />
        }
        loading={share.isPending}
        onPress={onShare}
      />
      {trip.is_shared && (
        <>
          <AppText variant="caption" muted>
            {t('share.isShared')}
          </AppText>
          <Button
            title={t('share.stop')}
            variant="ghost"
            loading={stop.isPending}
            onPress={onStop}
          />
        </>
      )}
    </View>
  );
}

export default function TripScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const optimise = useOptimiseTrip();
  const removeStop = useRemoveStop();
  const deleteTrip = useDeleteTrip();

  function confirmDelete() {
    Alert.alert(t('trips.deleteTitle'), t('trips.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('trips.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTrip.mutateAsync(id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: trip.data?.title ?? '' }} />
      <QueryState query={trip}>
        {(tr) => (
          <>
            {tr.stops.length === 0 ? (
              <View style={styles.hint}>
                <MaterialCommunityIcons name="map-marker-plus" size={22} color={colors.accent} />
                <AppText style={{ flex: 1 }}>{t('trips.noStops')}</AppText>
              </View>
            ) : (
              <>
                <TripMap stops={tr.stops} />
                <AppText variant="caption" muted>
                  {t('map.attribution')} · {t('trips.straightLines')}
                </AppText>
              </>
            )}

            {tr.stops.length > 0 && (
              <Section title={t('trips.stopsTitle')}>
                {tr.stops.map((s) => (
                  <StopRow
                    key={s.id}
                    stop={s}
                    onRemove={() => removeStop.mutate({ tripId: tr.id, stopId: s.id })}
                  />
                ))}
              </Section>
            )}

            {tr.stops.length >= 2 && (
              <Button
                title={tr.is_optimised ? t('trips.reoptimise') : t('trips.optimise')}
                icon={<MaterialCommunityIcons name="routes" size={20} color="#fff" />}
                loading={optimise.isPending}
                onPress={() => optimise.mutate({ tripId: tr.id })}
              />
            )}
            {optimise.isError && (
              <AppText style={{ color: colors.danger }}>
                {errorMessage(optimise.error, t('common.error'))}
              </AppText>
            )}
            {tr.is_optimised && <DayPlan trip={tr} />}
            {tr.is_optimised && <TripBudget trip={tr} />}
            {tr.stops.length > 0 && <ShareButtons trip={tr} />}

            <Button
              title={t('trips.addPlaces')}
              variant="secondary"
              onPress={() => router.push('/')}
            />
            <Button title={t('trips.delete')} variant="ghost" onPress={confirmDelete} />
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  day: { padding: spacing(3.5), backgroundColor: colors.surface, borderRadius: 14, gap: 2 },
  hint: {
    flexDirection: 'row',
    gap: spacing(2),
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
});

'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button, IconButton } from '@/components/Button';
import { CategoryIcon, Section } from '@/components/Cards';
import { ListCard, ListRow, PageHeader, StatTiles } from '@/components/Layout';
import { SafetyCard } from '@/components/Safety';
import { Screen } from '@/components/Screen';
import { QueryState } from '@/components/StateViews';
import { dayColor, TripMap } from '@/components/TripMap';
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
import { colors, radii, spacing } from '@/theme';

const hours = (h: number) => formatNumber(Math.round(h * 10) / 10, 1);

/** One stop: number in the day's colour, name, then the leg or visit time, and remove. */
function StopRow({
  stop,
  color,
  sub,
  onRemove,
  last,
}: {
  stop: TripStop;
  color: string;
  sub: string;
  onRemove: () => void;
  last: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.stop, !last && styles.divider]}>
      <View style={[styles.number, { backgroundColor: color }]}>
        <AppText variant="caption" weight="extrabold" style={{ color: '#fff' }}>
          {stop.visit_order != null ? formatNumber(stop.visit_order) : '•'}
        </AppText>
      </View>
      <Pressable
        style={{ flex: 1, minWidth: 0 }}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/place/[id]', params: { id: stop.place.id } })}
      >
        <AppText variant="label" style={{ fontSize: 15 }} numberOfLines={1}>
          {stop.place.name}
        </AppText>
        <View style={styles.inline}>
          <CategoryIcon category={stop.place.category} size={13} />
          <AppText variant="small" weight="regular" muted numberOfLines={1} style={{ flex: 1 }}>
            {sub}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={t('trips.remove')}
        style={styles.remove}
      >
        <MaterialCommunityIcons name="close" size={20} color={colors.iconMuted} />
      </Pressable>
    </View>
  );
}

/** After optimising: one section per day, stops numbered in visiting order. */
function DayPlan({ trip, onRemove }: { trip: TripDetail; onRemove: (stopId: string) => void }) {
  const { t } = useTranslation();
  const byId = new Map(trip.stops.map((s) => [s.id, s]));
  return (
    <>
      {trip.days.map((d) => {
        const stops = d.stop_ids.map((id) => byId.get(id)).filter((s): s is TripStop => !!s);
        const color = dayColor(d.day_no);
        return (
          <View key={d.day_no} style={{ gap: 10 }}>
            <View style={styles.between}>
              <View style={styles.inline}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <AppText variant="heading" accessibilityRole="header">
                  {t('itinerary.day', { day: formatNumber(d.day_no) })}
                </AppText>
              </View>
              <AppText variant="caption" weight="bold" muted>
                {km(d.km)}
              </AppText>
            </View>
            <View style={styles.dayCard}>
              {stops.map((s, i) => (
                <StopRow
                  key={s.id}
                  stop={s}
                  color={color}
                  last={i === stops.length - 1}
                  sub={t('trips.visitHours', { value: hours(s.visit_hours) })}
                  onRemove={() => onRemove(s.id)}
                />
              ))}
            </View>
            <AppText variant="small" weight="regular" muted>
              {t('trips.dayFacts', {
                km: km(d.km),
                travel: hours(d.travel_hours),
                visit: hours(d.visit_hours),
              })}
            </AppText>
          </View>
        );
      })}
      {trip.nearest_neighbour_km != null && trip.total_km != null && (
        <AppText variant="small" weight="regular" muted>
          {t('trips.improvement', {
            before: km(trip.nearest_neighbour_km),
            after: km(trip.total_km),
          })}
        </AppText>
      )}
    </>
  );
}

/** Navy panel with the estimated total; the lines open under it after an estimate. */
function TripBudget({ trip }: { trip: TripDetail }) {
  const { t } = useTranslation();
  const budget = useTripBudget();
  // A new estimate is only valid for the current plan: forget it when the plan changes.
  const current = budget.data && trip.estimated_budget_npr === budget.data.total_npr;
  const total = current ? budget.data!.total_npr : trip.estimated_budget_npr;
  return (
    <View style={{ gap: spacing(3) }}>
      <View style={styles.budget}>
        <AppText variant="subheading" weight="extrabold" style={{ color: '#FFFFFF' }}>
          {t('budget.title')}
        </AppText>
        {total != null ? (
          <AppText variant="display" style={{ color: '#FFFFFF', fontSize: 32, lineHeight: 38 }}>
            {npr(total)}
          </AppText>
        ) : (
          <AppText variant="caption" weight="regular" style={{ color: 'rgba(255,255,255,0.78)' }}>
            {t('budget.none')}
          </AppText>
        )}
        {current && (
          <AppText variant="caption" weight="regular" style={{ color: 'rgba(255,255,255,0.78)' }}>
            {t('budget.basis', {
              level: t(`profile.budget_${budget.data!.budget_level}`),
              nationality: t(`profile.nationality_${budget.data!.nationality}`),
            })}
          </AppText>
        )}
        <Button
          title={current ? t('budget.again') : t('budget.estimate')}
          variant="light"
          compact
          icon="calculator-variant-outline"
          loading={budget.isPending}
          onPress={() => budget.mutate(trip.id)}
        />
      </View>
      {current && (
        <ListCard>
          {budget.data!.lines.map((line, i) => (
            <ListRow
              key={`${line.code}-${i}`}
              last={i === budget.data!.lines.length - 1}
              label={line.label ?? t(`budget.code_${line.code}`)}
              sub={line.label ? t(`budget.code_${line.code}`) : undefined}
              value={npr(line.amount)}
            />
          ))}
        </ListCard>
      )}
      {budget.isError && (
        <AppText style={{ color: colors.danger }}>
          {errorMessage(budget.error, t('common.error'))}
        </AppText>
      )}
    </View>
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
        icon="share-variant-outline"
        loading={share.isPending}
        onPress={onShare}
      />
      {trip.is_shared && (
        <>
          <AppText variant="caption" muted style={{ textAlign: 'center' }}>
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

  function more() {
    Alert.alert(trip.data?.title ?? '', undefined, [
      { text: t('trips.addPlaces'), onPress: () => router.navigate('/') },
      { text: t('trips.delete'), style: 'destructive', onPress: confirmDelete },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  return (
    <Screen>
      <PageHeader
        title={trip.data?.title ?? ''}
        subtitle={t('trips.title')}
        right={<IconButton icon="dots-horizontal" label={t('trips.more')} onPress={more} />}
      />
      <QueryState query={trip}>
        {(tr) => {
          const saved =
            tr.is_optimised && tr.nearest_neighbour_km != null && tr.total_km != null
              ? tr.nearest_neighbour_km - tr.total_km
              : 0;
          const remove = (stopId: string) => removeStop.mutate({ tripId: tr.id, stopId });
          return (
            <>
              {tr.stops.length > 0 && (
                <StatTiles
                  compact
                  tiles={[
                    { label: t('trips.placesL'), value: formatNumber(tr.stops.length) },
                    {
                      label: t('trips.daysL'),
                      value: tr.is_optimised ? formatNumber(tr.days.length) : '—',
                    },
                    {
                      label: t('trips.distanceL'),
                      value: km(tr.total_km),
                      sub: saved >= 0.1 ? t('trips.shorter', { km: km(saved) }) : undefined,
                      subColor: colors.success,
                    },
                  ]}
                />
              )}

              {tr.stops.length === 0 ? (
                <View style={styles.hint}>
                  <MaterialCommunityIcons
                    name="map-marker-plus-outline"
                    size={22}
                    color={colors.primary}
                  />
                  <AppText style={{ flex: 1, color: colors.textBody }}>
                    {t('trips.noStops')}
                  </AppText>
                </View>
              ) : (
                <View style={{ gap: spacing(2) }}>
                  <TripMap stops={tr.stops} />
                  <AppText variant="small" weight="regular" muted>
                    {t('map.attribution')} · {t('trips.straightLines')}
                  </AppText>
                </View>
              )}

              {tr.is_optimised ? (
                <DayPlan trip={tr} onRemove={remove} />
              ) : (
                tr.stops.length > 0 && (
                  <Section title={t('trips.stopsTitle')}>
                    <View style={styles.dayCard}>
                      {tr.stops.map((s, i) => (
                        <StopRow
                          key={s.id}
                          stop={s}
                          color={colors.ink}
                          last={i === tr.stops.length - 1}
                          sub={t('trips.visitHours', { value: hours(s.visit_hours) })}
                          onRemove={() => remove(s.id)}
                        />
                      ))}
                    </View>
                  </Section>
                )
              )}

              {tr.stops.length >= 2 && (
                <Button
                  title={tr.is_optimised ? t('trips.reoptimise') : t('trips.optimise')}
                  icon="routes"
                  variant={tr.is_optimised ? 'secondary' : 'primary'}
                  loading={optimise.isPending}
                  onPress={() => optimise.mutate({ tripId: tr.id })}
                />
              )}
              {optimise.isError && (
                <AppText style={{ color: colors.danger }}>
                  {errorMessage(optimise.error, t('common.error'))}
                </AppText>
              )}
              {tr.is_optimised && <TripBudget trip={tr} />}
              {tr.stops.length > 0 && <ShareButtons trip={tr} />}
              {tr.stops.length > 0 && <SafetyCard />}
              {tr.stops.length === 0 && (
                <Button
                  title={t('trips.addPlaces')}
                  variant="secondary"
                  onPress={() => router.navigate('/')}
                />
              )}
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dayCard: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2),
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  number: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  budget: {
    padding: 18,
    borderRadius: radii.panel,
    backgroundColor: colors.navy,
    gap: spacing(3),
    alignItems: 'flex-start',
  },
  hint: {
    flexDirection: 'row',
    gap: spacing(3),
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: radii.card,
  },
});

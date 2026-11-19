'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PlaceCard, RecommendationCard, Section, TrekCard } from '@/components/Cards';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Empty, Loading, QueryState } from '@/components/StateViews';
import { formatNumber } from '@/lib/format';
import {
  useCategories,
  useNearPlaces,
  usePlaces,
  useRecommendations,
  useTreks,
} from '@/lib/queries';
import { useLocation } from '@/lib/useLocation';
import { colors, spacing } from '@/theme';

const NEAR = '__near__';

function Recommended() {
  const { t } = useTranslation();
  const recs = useRecommendations();
  // Keep showing loaded suggestions when a refresh fails (offline); hide only when there are none.
  if (!recs.data?.items.length) return null;
  return (
    <Section
      title={recs.data.mode === 'personal' ? t('explore.recommended') : t('explore.popular')}
    >
      {recs.data.mode === 'popular' && (
        <AppText variant="caption" muted>
          {t('explore.popularHint')}
        </AppText>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recRow}
      >
        {recs.data.items.map((rec) => (
          <RecommendationCard key={`${rec.type}-${rec.item.id}`} rec={rec} />
        ))}
      </ScrollView>
    </Section>
  );
}

function NearMe() {
  const { t } = useTranslation();
  const { state, request } = useLocation();
  const near = useNearPlaces(state.status === 'ready' ? state.coords : null);

  if (state.status === 'idle') {
    return (
      <View style={styles.notice}>
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.accent} />
        <AppText style={{ flex: 1 }}>{t('near.why')}</AppText>
        <Button title={t('near.allow')} onPress={request} />
      </View>
    );
  }
  if (state.status === 'asking') return <Loading label={t('near.finding')} />;
  if (state.status === 'denied' || state.status === 'error') {
    return (
      <View style={styles.notice}>
        <MaterialCommunityIcons name="map-marker-off-outline" size={22} color={colors.warning} />
        <AppText style={{ flex: 1 }}>
          {state.status === 'denied' ? t('near.denied') : t('near.error')}
        </AppText>
        {state.status === 'denied' && !state.canAskAgain ? (
          <Button
            title={t('near.openSettings')}
            variant="secondary"
            onPress={() => Linking.openSettings()}
          />
        ) : (
          <Button title={t('common.retry')} variant="secondary" onPress={request} />
        )}
      </View>
    );
  }
  return (
    <Section title={t('near.title')}>
      <QueryState query={near}>
        {(places) =>
          places.length === 0 ? (
            <Empty message={t('near.empty')} />
          ) : (
            <View style={styles.list}>
              {places.map((p) => (
                <PlaceCard key={p.id} place={p} distanceKm={p.distance_km} />
              ))}
            </View>
          )
        }
      </QueryState>
    </Section>
  );
}

export default function ExploreScreen() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const categories = useCategories();
  const nearMode = category === NEAR;
  const places = usePlaces({ category: nearMode ? undefined : category, page_size: 100 });
  const treks = useTreks();
  const recs = useRecommendations();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await Promise.allSettled([recs.refetch(), places.refetch(), treks.refetch()]);
    setRefreshing(false);
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <AppText variant="title">{t('explore.title')}</AppText>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={t('explore.all')}
          selected={!category}
          onPress={() => setCategory(undefined)}
        />
        <Chip label={t('near.chip')} selected={nearMode} onPress={() => setCategory(NEAR)} />
        {categories.data?.map((c) => (
          <Chip
            key={c.code}
            label={c.name}
            selected={category === c.code}
            onPress={() => setCategory(c.code)}
          />
        ))}
      </ScrollView>

      {nearMode ? (
        <NearMe />
      ) : (
        <>
          {!category && <Recommended />}

          {/* Treks are shown first when no category filter is active */}
          {!category && (
            <Section title={t('explore.treks')}>
              <QueryState query={treks} onRetry={refresh}>
                {(data) =>
                  data.items.length === 0 ? (
                    <Empty message={t('explore.emptyTreks')} />
                  ) : (
                    <View style={styles.list}>
                      {data.items.map((trek) => (
                        <TrekCard key={trek.id} trek={trek} />
                      ))}
                    </View>
                  )
                }
              </QueryState>
            </Section>
          )}

          <Section
            title={t('explore.places')}
            right={
              places.data ? (
                <AppText muted variant="caption">
                  {formatNumber(places.data.total)}
                </AppText>
              ) : null
            }
          >
            <QueryState query={places} onRetry={refresh}>
              {(data) =>
                data.items.length === 0 ? (
                  <Empty message={t('explore.emptyPlaces')} />
                ) : (
                  <View style={styles.list}>
                    {data.items.map((place) => (
                      <PlaceCard key={place.id} place={place} />
                    ))}
                  </View>
                )
              }
            </QueryState>
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing(2), paddingRight: spacing(4) },
  list: { gap: spacing(2.5) },
  recRow: { gap: spacing(3), paddingRight: spacing(4) },
  notice: {
    gap: spacing(3),
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
});

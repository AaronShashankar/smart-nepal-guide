'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
  useDismissRecommendation,
  useNearPlaces,
  usePlaces,
  useRecommendations,
  useTreks,
  useUndoDismiss,
  useUpdateMe,
} from '@/lib/queries';
import { useKnownPosition, useLocation } from '@/lib/useLocation';
import { useSettings } from '@/store/settings';
import { colors, GUTTER, radii, shadows, spacing } from '@/theme';

const NEAR = '__near__';

type Hidden = { type: 'place' | 'trek'; id: string; name: string };
const UNDO_MS = 6000;

function Recommended({ recs }: { recs: ReturnType<typeof useRecommendations> }) {
  const { t } = useTranslation();
  const dismiss = useDismissRecommendation();
  const undo = useUndoDismiss();
  const [hidden, setHidden] = useState<Hidden | null>(null);

  // The "Undo" bar goes away by itself after a few seconds
  useEffect(() => {
    if (!hidden) return;
    const timer = setTimeout(() => setHidden(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [hidden]);

  // Keep showing loaded suggestions when a refresh fails (offline); hide only when there are none.
  if (!recs.data?.items.length && !hidden) return null;
  const items = recs.data?.items ?? [];
  return (
    <Section
      big
      title={recs.data?.mode === 'popular' ? t('explore.popular') : t('explore.recommended')}
    >
      {recs.data?.mode === 'popular' && (
        <AppText variant="caption" muted>
          {t('explore.popularHint')}
        </AppText>
      )}
      {hidden && (
        <View style={styles.undoBar} accessibilityLiveRegion="polite">
          <AppText variant="label" style={{ flex: 1, color: '#FFFFFF' }} numberOfLines={2}>
            {t('explore.hidden', { name: hidden.name })}
          </AppText>
          <Button
            compact
            variant="light"
            title={t('explore.undo')}
            onPress={() => {
              undo.mutate({ type: hidden.type, id: hidden.id });
              setHidden(null);
            }}
          />
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.recRow}
      >
        {items.map((rec) => (
          <RecommendationCard
            key={`${rec.type}-${rec.item.id}`}
            rec={rec}
            onDismiss={() => {
              dismiss.mutate({ type: rec.type, id: rec.item.id });
              setHidden({ type: rec.type, id: rec.item.id, name: rec.item.name });
            }}
          />
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
        <View style={styles.noticeIcon}>
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
        </View>
        <AppText style={{ color: colors.textBody }}>{t('near.why')}</AppText>
        <Button title={t('near.allow')} onPress={request} />
      </View>
    );
  }
  if (state.status === 'asking') return <Loading label={t('near.finding')} />;
  if (state.status === 'denied' || state.status === 'error') {
    return (
      <View style={styles.notice}>
        <View style={styles.noticeIcon}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={22} color={colors.warning} />
        </View>
        <AppText style={{ color: colors.textBody }}>
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
    <Section big title={t('near.title')}>
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

/** "EN · ने" pill: switches the app language in one tap. */
function LanguageToggle() {
  const { t } = useTranslation();
  const language = useSettings((s) => s.language);
  const setLanguage = useSettings((s) => s.setLanguage);
  const updateMe = useUpdateMe();
  const next = language === 'ne' ? 'en' : 'ne';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('explore.changeLanguage')}
      onPress={async () => {
        await setLanguage(next);
        updateMe.mutate({ preferred_lang: next });
      }}
      style={({ pressed }) => [styles.langButton, pressed && { opacity: 0.8 }]}
    >
      <MaterialCommunityIcons name="web" size={18} color={colors.ink} />
      <AppText variant="caption" weight="bold">
        EN · ने
      </AppText>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const categories = useCategories();
  const nearMode = category === NEAR;
  const places = usePlaces({ category: nearMode ? undefined : category, page_size: 100 });
  const treks = useTreks();
  const recs = useRecommendations(useKnownPosition());
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await Promise.allSettled([recs.refetch(), places.refetch(), treks.refetch()]);
    setRefreshing(false);
  }

  const openSearch = () => router.navigate('/search');

  return (
    <Screen tab refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="label" weight="semibold" muted>
            {t('explore.hello')}
          </AppText>
          <AppText variant="display" accessibilityRole="header">
            {t('explore.whereNext')}
          </AppText>
        </View>
        <LanguageToggle />
      </View>

      <View style={styles.searchRow}>
        {/* Looks like a field; typing happens on the Search tab, which has the results. */}
        <Pressable
          accessibilityRole="search"
          accessibilityLabel={t('search.placeholder')}
          onPress={openSearch}
          style={styles.searchField}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <AppText variant="label" weight="medium" muted numberOfLines={1} style={{ flex: 1 }}>
            {t('explore.searchHint')}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('explore.trekFilters')}
          onPress={openSearch}
          style={styles.filterButton}
        >
          <MaterialCommunityIcons name="tune-variant" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={t('explore.all')}
          selected={!category}
          onPress={() => setCategory(undefined)}
        />
        <Chip
          label={t('near.chip')}
          icon="map-marker-outline"
          selected={nearMode}
          onPress={() => setCategory(NEAR)}
        />
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
          {!category && <Recommended recs={recs} />}

          {/* Treks are shown first when no category filter is active */}
          {!category && (
            <Section
              big
              title={t('explore.popularTreks')}
              right={
                <Pressable accessibilityRole="button" onPress={openSearch} hitSlop={10}>
                  <AppText variant="label" style={{ color: colors.primary }}>
                    {t('common.seeAll')}
                  </AppText>
                </Pressable>
              }
            >
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
            big
            title={t('explore.places')}
            right={
              places.data ? (
                <AppText muted variant="caption" weight="bold">
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
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing(3), paddingTop: spacing(2) },
  langButton: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchField: {
    flex: 1,
    height: 52,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing(4),
    ...shadows.raised,
  },
  filterButton: {
    width: 52,
    height: 52,
    borderRadius: radii.button,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sideways rows run to the screen edge, like the design.
  bleed: { marginHorizontal: -GUTTER },
  chips: { gap: spacing(2), paddingHorizontal: GUTTER },
  list: { gap: spacing(3) },
  recRow: { gap: 14, paddingHorizontal: GUTTER },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2),
    paddingLeft: spacing(4),
    paddingRight: spacing(2),
    borderRadius: radii.card,
    backgroundColor: colors.navy,
  },
  notice: {
    gap: spacing(3),
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: radii.card,
  },
  noticeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, fontFor } from '@/components/AppText';
import { TrekResultCard } from '@/components/Cards';
import { ChipGroup, Segmented } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Empty, ErrorState, Loading } from '@/components/StateViews';
import { formatNumber, regionName } from '@/lib/format';
import { useSearch, useTrekRegions, useTreks, type TrekFilters } from '@/lib/queries';
import type { RiskLevel, SearchHit } from '@/lib/types';
import { useDebounced } from '@/lib/useDebounced';
import { colors, difficultyTints, radii, shadows, spacing } from '@/theme';
import { PressableLink } from '@/components/PressableLink';

type Duration = 'short' | 'medium' | 'long';
type Tab = 'places' | 'treks';
const DURATIONS: Record<Duration, Pick<TrekFilters, 'min_days' | 'max_days'>> = {
  short: { max_days: 5 },
  medium: { min_days: 6, max_days: 9 },
  long: { min_days: 10 },
};
const LEVELS: RiskLevel[] = ['easy', 'moderate', 'hard', 'risky'];

function HitRow({ hit }: { hit: SearchHit }) {
  const href =
    hit.type === 'place'
      ? ({ pathname: '/place/[id]', params: { id: hit.id } } as const)
      : ({ pathname: '/trek/[id]', params: { id: hit.id } } as const);
  return (
    <PressableLink
      href={href}
      style={({ pressed }) => [styles.hit, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
    >
      <View style={styles.hitIcon}>
        <MaterialCommunityIcons
          name={hit.type === 'place' ? 'map-marker-outline' : 'hiking'}
          size={20}
          color={colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="subheading">{hit.name}</AppText>
        {hit.subtitle && (
          <AppText variant="caption" muted>
            {hit.subtitle}
          </AppText>
        )}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
    </PressableLink>
  );
}

function FilterLabel({ children }: { children: string }) {
  return (
    <AppText variant="caption" weight="bold" muted>
      {children}
    </AppText>
  );
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [tab, setTab] = useState<Tab>('treks');
  const query = useDebounced(text);
  const search = useSearch(query);

  const [region, setRegion] = useState<string | null>(null);
  const [duration, setDuration] = useState<Duration | null>(null);
  const [difficulty, setDifficulty] = useState<RiskLevel | null>(null);
  const filtersOn = !!(region || duration || difficulty);
  const regions = useTrekRegions();
  const treks = useTreks({
    ...(region && { region }),
    ...(duration && DURATIONS[duration]),
    ...(difficulty && { difficulty }),
  });

  const q = query.trim();
  const searching = q.length >= 2;
  const hits = search.data ? (tab === 'places' ? search.data.places : search.data.treks) : [];
  // The fuzzy search may match a different spelling ("punhill" -> "Poon Hill"): say which.
  const top = hits[0];
  const spelling = top && !top.matched.toLowerCase().includes(q.toLowerCase()) ? top.matched : null;

  return (
    <Screen tab>
      <AppText
        variant="display"
        style={{ fontSize: 28, lineHeight: 34 }}
        accessibilityRole="header"
      >
        {t('search.title')}
      </AppText>

      <View style={[styles.searchBox, focused && styles.searchFocused]}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={focused ? colors.ink : colors.textMuted}
        />
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            { fontFamily: fontFor(text ? 'semibold' : 'medium', text || undefined) },
          ]}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('search.placeholder')}
        />
        {text.length > 0 && (
          <Pressable
            onPress={() => setText('')}
            accessibilityRole="button"
            accessibilityLabel={t('search.clear')}
            style={styles.clear}
          >
            <MaterialCommunityIcons name="close" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'places', label: t('search.places') },
          { value: 'treks', label: t('search.treks') },
        ]}
      />

      {q.length === 1 && <Empty message={t('search.typeMore')} />}

      {searching && (
        <>
          {search.isPending && <Loading />}
          {search.isError && <ErrorState error={search.error} onRetry={() => search.refetch()} />}
          {search.data && (
            <View style={{ gap: 4 }}>
              <AppText variant="label" weight="semibold" style={{ color: colors.textSecondary }}>
                {t(tab === 'places' ? 'search.placesFound' : 'search.treksFound', {
                  count: hits.length,
                  value: formatNumber(hits.length),
                })}
              </AppText>
              {spelling && (
                <AppText variant="caption" weight="regular" muted>
                  {t('search.closest')}{' '}
                  <AppText variant="caption" weight="bold">
                    {spelling}
                  </AppText>
                </AppText>
              )}
            </View>
          )}
          {search.data && hits.length === 0 && <Empty message={t('search.noResults', { q })} />}
          <View style={{ gap: 10 }}>
            {hits.map((h) => (
              <HitRow key={h.id} hit={h} />
            ))}
          </View>
        </>
      )}

      {!searching && tab === 'places' && <Empty message={t('search.placesHint')} />}

      {!searching && tab === 'treks' && (
        <>
          <View style={styles.filters} accessibilityLabel={t('search.filters')}>
            <View style={styles.filterGroup}>
              <FilterLabel>{t('search.difficulty')}</FilterLabel>
              <View style={styles.wrap}>
                <ChipGroup
                  options={LEVELS.map((l) => ({ value: l, label: t(`difficulty.${l}`) }))}
                  value={difficulty}
                  onChange={setDifficulty}
                  tints={difficultyTints}
                />
              </View>
            </View>
            <View style={styles.filterGroup}>
              <FilterLabel>{t('search.duration')}</FilterLabel>
              <View style={styles.wrap}>
                <ChipGroup
                  options={(Object.keys(DURATIONS) as Duration[]).map((d) => ({
                    value: d,
                    label: t(`search.${d}`),
                  }))}
                  value={duration}
                  onChange={setDuration}
                />
              </View>
            </View>
            {(regions.data?.length ?? 0) > 0 && (
              <View style={styles.filterGroup}>
                <FilterLabel>{t('search.region')}</FilterLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.regionScroll}
                  contentContainerStyle={styles.regionRow}
                >
                  <ChipGroup
                    options={(regions.data ?? []).map((r) => ({ value: r, label: regionName(r) }))}
                    value={region}
                    onChange={setRegion}
                  />
                </ScrollView>
              </View>
            )}
          </View>

          {treks.isPending && <Loading />}
          {treks.isError && <ErrorState error={treks.error} onRetry={() => treks.refetch()} />}
          {treks.data && (
            <AppText variant="label" weight="semibold" style={{ color: colors.textSecondary }}>
              {filtersOn
                ? t('search.treksFound', {
                    count: treks.data.items.length,
                    value: formatNumber(treks.data.items.length),
                  })
                : t('search.allTreks')}
            </AppText>
          )}
          {treks.data?.items.length === 0 && <Empty message={t('explore.emptyTreks')} />}
          <View style={{ gap: spacing(4) }}>
            {treks.data?.items.map((trek) => (
              <TrekResultCard key={trek.id} trek={trek} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: spacing(2),
    height: 52,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surface,
    ...shadows.card,
  },
  searchFocused: { borderColor: colors.ink },
  input: { flex: 1, minWidth: 0, fontSize: 16, color: colors.text },
  clear: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radii.card,
  },
  hitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: {
    gap: 14,
    padding: spacing(4),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  filterGroup: { gap: spacing(2) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  regionScroll: { marginHorizontal: -spacing(4) },
  regionRow: { gap: spacing(2), paddingHorizontal: spacing(4) },
});

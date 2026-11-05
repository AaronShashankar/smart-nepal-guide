import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Section, TrekCard } from '@/components/Cards';
import { ChipGroup } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Empty, ErrorState, Loading } from '@/components/StateViews';
import { useSearch, useTrekRegions, useTreks, type TrekFilters } from '@/lib/queries';
import type { RiskLevel, SearchHit } from '@/lib/types';
import { useDebounced } from '@/lib/useDebounced';
import { colors, fonts, spacing } from '@/theme';

type Duration = 'short' | 'medium' | 'long';
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
    <Link href={href} asChild>
      <Pressable style={styles.hit} accessibilityRole="button">
        <MaterialCommunityIcons
          name={hit.type === 'place' ? 'map-marker-outline' : 'hiking'}
          size={22}
          color={colors.accent}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="subheading">{hit.name}</AppText>
          {hit.subtitle && (
            <AppText variant="caption" muted>
              {hit.subtitle}
            </AppText>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const query = useDebounced(text);
  const search = useSearch(query);

  const [region, setRegion] = useState<string | null>(null);
  const [duration, setDuration] = useState<Duration | null>(null);
  const [difficulty, setDifficulty] = useState<RiskLevel | null>(null);
  const filtersOn = !!(region || duration || difficulty);
  const regions = useTrekRegions();
  const filtered = useTreks(
    {
      ...(region && { region }),
      ...(duration && DURATIONS[duration]),
      ...(difficulty && { difficulty }),
    },
    filtersOn,
  );

  const q = query.trim();
  const results = search.data;
  const nothing = results && results.places.length === 0 && results.treks.length === 0;

  return (
    <Screen>
      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.textMuted} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('search.placeholder')}
        />
        {text.length > 0 && (
          <Pressable onPress={() => setText('')} accessibilityLabel="Clear" hitSlop={12}>
            <MaterialCommunityIcons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {q.length === 1 && <Empty message={t('search.typeMore')} />}
      {q.length >= 2 && search.isPending && <Loading />}
      {q.length >= 2 && search.isError && (
        <ErrorState error={search.error} onRetry={() => search.refetch()} />
      )}
      {q.length >= 2 && nothing && <Empty message={t('search.noResults', { q })} />}
      {q.length >= 2 && results && !nothing && (
        <>
          {results.places.length > 0 && (
            <Section title={t('search.places')}>
              {results.places.map((h) => (
                <HitRow key={h.id} hit={h} />
              ))}
            </Section>
          )}
          {results.treks.length > 0 && (
            <Section title={t('search.treks')}>
              {results.treks.map((h) => (
                <HitRow key={h.id} hit={h} />
              ))}
            </Section>
          )}
        </>
      )}

      <Section title={t('search.filters')}>
        <AppText variant="label">{t('search.region')}</AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <ChipGroup
            options={(regions.data ?? []).map((r) => ({ value: r, label: r }))}
            value={region}
            onChange={setRegion}
          />
        </ScrollView>
        <AppText variant="label">{t('search.duration')}</AppText>
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
        <AppText variant="label">{t('search.difficulty')}</AppText>
        <View style={styles.wrap}>
          <ChipGroup
            options={LEVELS.map((l) => ({ value: l, label: t(`difficulty.${l}`) }))}
            value={difficulty}
            onChange={setDifficulty}
          />
        </View>
      </Section>

      {filtersOn && (
        <Section title={t('search.filteredTreks')}>
          {filtered.isPending && <Loading />}
          {filtered.isError && (
            <ErrorState error={filtered.error} onRetry={() => filtered.refetch()} />
          )}
          {filtered.data?.items.length === 0 && <Empty message={t('explore.emptyTreks')} />}
          {filtered.data?.items.map((trek) => (
            <TrekCard key={trek.id} trek={trek} />
          ))}
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  chips: { gap: spacing(2) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
});

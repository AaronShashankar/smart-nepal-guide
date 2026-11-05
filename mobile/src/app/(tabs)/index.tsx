import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { PlaceCard, Section, TrekCard } from '@/components/Cards';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Empty, QueryState } from '@/components/StateViews';
import { formatNumber } from '@/lib/format';
import { useCategories, usePlaces, useTreks } from '@/lib/queries';
import { spacing } from '@/theme';

export default function ExploreScreen() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const categories = useCategories();
  const places = usePlaces({ category, page_size: 100 });
  const treks = useTreks();

  return (
    <Screen>
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
        {categories.data?.map((c) => (
          <Chip
            key={c.code}
            label={c.name}
            selected={category === c.code}
            onPress={() => setCategory(c.code)}
          />
        ))}
      </ScrollView>

      {/* Treks are shown first when no category filter is active */}
      {!category && (
        <Section title={t('explore.treks')}>
          <QueryState query={treks}>
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
        <QueryState query={places}>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing(2), paddingRight: spacing(4) },
  list: { gap: spacing(2.5) },
});

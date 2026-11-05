import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { CategoryIcon, InfoRow, Section } from '@/components/Cards';
import { Chip } from '@/components/Chip';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { QueryState } from '@/components/StateViews';
import { formatNumber, meters, monthName, npr } from '@/lib/format';
import { usePlace } from '@/lib/queries';
import { colors, spacing } from '@/theme';

export default function PlaceDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = usePlace(id);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: spacing(10) }}
    >
      <Stack.Screen options={{ title: place.data?.name ?? '' }} />
      <QueryState query={place}>
        {(p) => (
          <>
            <PhotoCarousel photos={p.photos} category={p.category} />
            <View style={styles.body}>
              <View style={{ gap: spacing(1) }}>
                <AppText variant="title">{p.name}</AppText>
                <View style={styles.row}>
                  <CategoryIcon category={p.category} />
                  <AppText muted>{p.category.name}</AppText>
                </View>
              </View>

              <View style={styles.card}>
                <InfoRow
                  icon="image-filter-hdr"
                  label={t('place.altitude')}
                  value={meters(p.altitude_m)}
                />
                <InfoRow
                  icon="map-marker-outline"
                  label={t('place.location')}
                  value={[p.district, p.province].filter(Boolean).join(', ') || '—'}
                />
                <InfoRow
                  icon="ticket-outline"
                  label={t('place.entryFee')}
                  value={npr(p.entry_fee_npr)}
                />
              </View>

              {p.description && (
                <Section title={t('place.about')}>
                  <AppText>{p.description}</AppText>
                </Section>
              )}

              {p.best_months.length > 0 && (
                <Section title={t('place.bestSeason')}>
                  <View style={styles.row}>
                    {p.best_months.map((m) => (
                      <Chip key={m} label={monthName(m)} selected />
                    ))}
                  </View>
                </Section>
              )}

              {p.how_to_reach && (
                <Section title={t('place.howToReach')}>
                  <AppText>{p.how_to_reach}</AppText>
                </Section>
              )}

              {p.nearby.length > 0 && (
                <Section title={t('place.nearby')}>
                  {p.nearby.map((n) => (
                    <Link
                      key={n.id}
                      href={{ pathname: '/place/[id]', params: { id: n.id } }}
                      asChild
                    >
                      <Pressable style={[styles.card, styles.row]} accessibilityRole="button">
                        <CategoryIcon category={n.category} />
                        <View style={{ flex: 1 }}>
                          <AppText variant="subheading">{n.name}</AppText>
                          <AppText variant="caption" muted>
                            {t('units.kmAway', { value: formatNumber(n.distance_km, 1) })}
                          </AppText>
                        </View>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={22}
                          color={colors.textMuted}
                        />
                      </Pressable>
                    </Link>
                  ))}
                </Section>
              )}
            </View>
          </>
        )}
      </QueryState>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing(4), gap: spacing(5) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), flexWrap: 'wrap' },
  card: { padding: spacing(4), backgroundColor: colors.surface, borderRadius: 14, gap: spacing(3) },
});

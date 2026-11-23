'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AddToTrip } from '@/components/AddToTrip';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CategoryIcon, Section } from '@/components/Cards';
import { Pill } from '@/components/Chip';
import { ForecastStrip } from '@/components/ForecastStrip';
import {
  ACTION_BAR_SPACE,
  BottomActionBar,
  ContentSheet,
  HeroHeader,
  ListCard,
  ListRow,
  PageHeader,
  StatTiles,
} from '@/components/Layout';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { ReviewsSection } from '@/components/Reviews';
import { RatingBadge } from '@/components/Stars';
import { QueryState } from '@/components/StateViews';
import { districtName, formatNumber, meters, monthRange, npr, provinceName } from '@/lib/format';
import { usePlace, useRefreshDetail } from '@/lib/queries';
import type { PlaceDetail } from '@/lib/types';
import { colors, spacing } from '@/theme';
import { PressableLink } from '@/components/PressableLink';

/** An icon for each place tag (PLACE_TAGS in backend/app/models/enums.py) */
const TAG_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  sunrise: 'weather-sunset-up',
  mountain_views: 'image-filter-hdr',
  hiking: 'hiking',
  boating: 'rowing',
  wildlife: 'paw',
  pilgrimage: 'hands-pray',
  unesco: 'bank',
  architecture: 'pillar',
  local_culture: 'account-group',
  family: 'human-male-female-child',
  high_altitude: 'summit',
  few_crowds: 'leaf',
};

const HERO = 400;

function openDirections(p: PlaceDetail) {
  const label = encodeURIComponent(p.name);
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${label}&ll=${p.latitude},${p.longitude}`
      : `geo:${p.latitude},${p.longitude}?q=${p.latitude},${p.longitude}(${label})`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`),
  );
}

export default function PlaceDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = usePlace(id);
  const refresh = useRefreshDetail('place', id);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!place.data) {
    return (
      <SafeAreaView style={styles.fill}>
        <View style={{ padding: spacing(5), gap: spacing(5) }}>
          <PageHeader title="" />
          <QueryState query={place}>{() => null}</QueryState>
        </View>
      </SafeAreaView>
    );
  }
  const p = place.data;
  const where = [p.district && districtName(p.district), p.province && provinceName(p.province)]
    .filter(Boolean)
    .join(', ');
  const fees = [
    { label: t('place.feeForeign'), value: p.entry_fee_npr },
    { label: t('place.feeSaarc'), value: p.entry_fee_saarc_npr },
    { label: t('place.feeNepali'), value: p.entry_fee_nepali_npr },
  ];

  return (
    <View style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingBottom: ACTION_BAR_SPACE + spacing(12) }}
        // The trip and review sheets are Modals inside this ScrollView: without "handled" the first
        // tap on their buttons only closes the keyboard (BUG-11).
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl {...refresh} />}
      >
        <HeroHeader
          height={HERO}
          background={<PhotoCarousel photos={p.photos} category={p.category} height={HERO} />}
        >
          <Pill label={p.category.name} onPhoto />
          <AppText variant="display" style={{ color: '#FFFFFF' }} accessibilityRole="header">
            {p.name}
          </AppText>
          <View style={styles.inline}>
            {where ? (
              <>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={16}
                  color="rgba(255,255,255,0.9)"
                />
                <AppText
                  variant="label"
                  weight="semibold"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                >
                  {where}
                </AppText>
              </>
            ) : null}
            <RatingBadge rating={p.rating} light />
          </View>
        </HeroHeader>

        <ContentSheet>
          <StatTiles
            tiles={[
              { label: t('place.altitude'), value: meters(p.altitude_m) },
              { label: t('place.bestMonths'), value: monthRange(p.best_months) },
              { label: t('place.entry'), value: npr(p.entry_fee_npr) },
            ]}
          />

          {p.tags.length > 0 && (
            <View style={styles.tags} accessibilityLabel={t('place.tagsLabel')}>
              {p.tags.map((tag) => (
                <Pill key={tag} label={t(`tags.${tag}`)} icon={TAG_ICONS[tag]} />
              ))}
            </View>
          )}

          {p.description && (
            <Section title={t('place.about')}>
              <AppText style={{ color: colors.textBody }}>{p.description}</AppText>
            </Section>
          )}

          <ForecastStrip type="place" id={p.id} />

          <Section title={t('place.entryFees')}>
            <ListCard>
              {fees.map((f, i) => (
                <ListRow
                  key={f.label}
                  last={i === fees.length - 1}
                  label={f.label}
                  value={npr(f.value || null)}
                  valueColor={f.value ? undefined : colors.success}
                />
              ))}
            </ListCard>
          </Section>

          {p.how_to_reach && (
            <Section title={t('place.howToReach')}>
              <AppText style={{ color: colors.textBody }}>{p.how_to_reach}</AppText>
            </Section>
          )}

          <ReviewsSection target={{ type: 'place', id: p.id }} />

          {p.nearby.length > 0 && (
            <Section title={t('place.nearby')}>
              <ListCard>
                {p.nearby.map((n, i) => (
                  <PressableLink
                    key={n.id}
                    href={{ pathname: '/place/[id]', params: { id: n.id } }}
                    style={[styles.nearRow, i < p.nearby.length - 1 && styles.divider]}
                    accessibilityRole="button"
                  >
                    <View style={styles.nearIcon}>
                      <CategoryIcon category={n.category} size={18} color={colors.primary} />
                    </View>
                    <AppText variant="label" weight="semibold" style={{ flex: 1, fontSize: 15 }}>
                      {n.name}
                    </AppText>
                    <AppText variant="caption" weight="bold" muted>
                      {t('units.km', { value: formatNumber(n.distance_km, 1) })}
                    </AppText>
                  </PressableLink>
                ))}
              </ListCard>
            </Section>
          )}
        </ContentSheet>
      </ScrollView>

      <BottomActionBar>
        {toast && (
          <View
            style={[styles.toast, { backgroundColor: toast.ok ? colors.ink : colors.danger }]}
            accessibilityLiveRegion="polite"
          >
            <AppText variant="caption" weight="semibold" style={{ color: '#FFFFFF' }}>
              {toast.text}
            </AppText>
          </View>
        )}
        <Button
          title={t('place.directions')}
          variant="secondary"
          icon="navigation-variant-outline"
          style={{ flex: 1 }}
          onPress={() => openDirections(p)}
        />
        <AddToTrip
          placeId={p.id}
          placeName={p.name}
          onResult={setToast}
          trigger={(open) => <Button title={t('trips.addToTrip')} icon="plus" onPress={open} />}
        />
      </BottomActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  nearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    minHeight: 48,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  nearIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: '100%',
    marginBottom: spacing(3),
    padding: spacing(3),
    borderRadius: 14,
  },
});

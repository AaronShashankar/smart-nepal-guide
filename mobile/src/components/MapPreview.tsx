'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { photoUrl } from '@/lib/api';
import { days, districtName, formatNumber, km, meters, regionName } from '@/lib/format';
import type { PlaceSummary, TrekRoute } from '@/lib/types';
import { colors, radii, shadows, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { CategoryIcon, DifficultyBadge } from './Cards';
import { MountainArt } from './Layout';
import { RatingBadge } from './Stars';

export type MapSelection =
  { kind: 'place'; place: PlaceSummary } | { kind: 'trek'; trek: TrekRoute } | null;

/**
 * The card that opens when a marker or a trek line is tapped on the map (V2-MAP-05): picture,
 * name, what it is, how far it is from you (when the location is known) and an Open button.
 */
export function MapPreview({
  selection,
  distanceKm,
  onClose,
}: {
  selection: NonNullable<MapSelection>;
  distanceKm: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const away =
    distanceKm != null ? t('units.kmAway', { value: formatNumber(distanceKm, 1) }) : null;

  let picture: React.ReactNode;
  let title: string;
  let subtitle: string;
  let meta: string | null;
  let badges: React.ReactNode;
  let open: () => void;

  if (selection.kind === 'place') {
    const p = selection.place;
    picture = p.thumbnail_url ? (
      <Image source={{ uri: photoUrl(p.thumbnail_url) }} style={styles.thumb} contentFit="cover" />
    ) : (
      <View style={[styles.thumb, styles.placeholder]}>
        <CategoryIcon category={p.category} size={28} />
      </View>
    );
    title = p.name;
    subtitle = [p.category.name, p.district && districtName(p.district)]
      .filter(Boolean)
      .join(' · ');
    meta = away ?? (p.altitude_m != null ? meters(p.altitude_m) : null);
    badges = <RatingBadge rating={p.rating} />;
    open = () => router.push({ pathname: '/place/[id]', params: { id: p.id } });
  } else {
    const tr = selection.trek;
    picture = <MountainArt style={styles.thumb} />;
    title = tr.name;
    subtitle = `${regionName(tr.region)} · ${days(tr.total_days)} · ${km(tr.total_distance_km)}`;
    meta = [meters(tr.max_altitude_m), away].filter(Boolean).join(' · ');
    badges = (
      <>
        <DifficultyBadge level={tr.base_difficulty} />
        {tr.my_risk && <DifficultyBadge level={tr.my_risk} prefix={t('map.forYou')} />}
      </>
    );
    open = () => router.push({ pathname: '/trek/[id]', params: { id: tr.id } });
  }

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {picture}
        <View style={styles.body}>
          <AppText variant="subheading" numberOfLines={2}>
            {title}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {subtitle}
          </AppText>
          {!!meta && (
            <View style={styles.meta}>
              <MaterialCommunityIcons
                name={away ? 'map-marker-outline' : 'image-filter-hdr'}
                size={16}
                color={colors.textMuted}
              />
              <AppText variant="caption" weight="bold" numberOfLines={1} style={{ flex: 1 }}>
                {meta}
              </AppText>
            </View>
          )}
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('map.close')}
          style={styles.close}
        >
          <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.bottom}>
        <View style={styles.badges}>{badges}</View>
        <Button title={t('map.open')} compact icon="arrow-right" onPress={open} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing(3),
    gap: spacing(3),
    ...shadows.floating,
  },
  top: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 16 },
  placeholder: { backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  close: { alignSelf: 'flex-start', padding: 2 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  badges: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5) },
});

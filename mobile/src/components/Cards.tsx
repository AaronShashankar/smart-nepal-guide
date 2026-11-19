'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { photoUrl } from '@/lib/api';
import { days, districtName, formatNumber, km, meters, regionName } from '@/lib/format';
import type { Category, PlaceSummary, Recommendation, RiskLevel, TrekSummary } from '@/lib/types';
import { categoryColors, colors, difficultyColors, spacing } from '@/theme';

import { AppText } from './AppText';
import { RatingBadge } from './Stars';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function CategoryIcon({
  category,
  size = 18,
}: {
  category: Pick<Category, 'code' | 'icon'>;
  size?: number;
}) {
  const name = (category.icon ?? 'map-marker') as IconName;
  return (
    <MaterialCommunityIcons
      name={name in MaterialCommunityIcons.glyphMap ? name : 'map-marker'}
      size={size}
      color={categoryColors[category.code] ?? colors.accent}
    />
  );
}

export function DifficultyBadge({ level }: { level: RiskLevel }) {
  const { t } = useTranslation();
  const color = difficultyColors[level];
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A`, borderColor: color }]}>
      <AppText variant="caption" style={{ color }}>
        {t(`difficulty.${level}`)}
      </AppText>
    </View>
  );
}

function Thumbnail({
  uri,
  category,
  wide,
}: {
  uri: string | null;
  category: Category;
  wide?: boolean;
}) {
  const style = wide ? styles.recImage : styles.thumb;
  if (uri) {
    return (
      <Image source={{ uri: photoUrl(uri) }} style={style} contentFit="cover" transition={150} />
    );
  }
  return (
    <View style={[style, styles.thumbPlaceholder]}>
      <CategoryIcon category={category} size={28} />
    </View>
  );
}

export function PlaceCard({ place, distanceKm }: { place: PlaceSummary; distanceKm?: number }) {
  const { t } = useTranslation();
  return (
    <Link href={{ pathname: '/place/[id]', params: { id: place.id } }} asChild>
      <Pressable style={styles.card} accessibilityRole="button">
        <Thumbnail uri={place.thumbnail_url} category={place.category} />
        <View style={styles.body}>
          <AppText variant="subheading" numberOfLines={1}>
            {place.name}
          </AppText>
          <View style={styles.row}>
            <CategoryIcon category={place.category} size={14} />
            <AppText variant="caption" muted numberOfLines={1}>
              {place.category.name}
              {place.district ? ` · ${districtName(place.district)}` : ''}
            </AppText>
          </View>
          <View style={styles.row}>
            {distanceKm != null && (
              <AppText variant="caption" style={{ color: colors.accent }}>
                {t('units.kmAway', { value: formatNumber(distanceKm, 1) })}
              </AppText>
            )}
            {distanceKm == null && place.altitude_m != null && (
              <AppText variant="caption" muted>
                {meters(place.altitude_m)}
              </AppText>
            )}
            <RatingBadge rating={place.rating} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export function TrekCard({ trek }: { trek: TrekSummary }) {
  return (
    <Link href={{ pathname: '/trek/[id]', params: { id: trek.id } }} asChild>
      <Pressable
        style={StyleSheet.flatten([styles.card, styles.trekCard])}
        accessibilityRole="button"
      >
        <View style={styles.body}>
          <AppText variant="subheading" numberOfLines={2}>
            {trek.name}
          </AppText>
          <AppText variant="caption" muted>
            {regionName(trek.region)} · {days(trek.total_days)} · {km(trek.total_distance_km)}
          </AppText>
          <RatingBadge rating={trek.rating} />
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={styles.row}>
              <MaterialCommunityIcons name="image-filter-hdr" size={14} color={colors.textMuted} />
              <AppText variant="caption" muted>
                {meters(trek.max_altitude_m)}
              </AppText>
            </View>
            <DifficultyBadge level={trek.base_difficulty} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

/** Small card for the sideways "Recommended for you" row, with the reason it was picked. */
export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const { t } = useTranslation();
  const href =
    rec.type === 'place'
      ? ({ pathname: '/place/[id]', params: { id: rec.item.id } } as const)
      : ({ pathname: '/trek/[id]', params: { id: rec.item.id } } as const);
  const subtitle =
    rec.type === 'place'
      ? rec.item.category.name
      : `${t('explore.trek')} · ${days(rec.item.total_days)}`;
  const reason = rec.because[0];
  return (
    <Link href={href} asChild>
      <Pressable style={styles.recCard} accessibilityRole="button">
        {rec.type === 'place' ? (
          <Thumbnail uri={rec.item.thumbnail_url} category={rec.item.category} wide />
        ) : (
          <View style={[styles.recImage, styles.thumbPlaceholder]}>
            <MaterialCommunityIcons name="hiking" size={32} color={colors.accent} />
          </View>
        )}
        <View style={{ padding: spacing(2.5), gap: 2 }}>
          <AppText variant="subheading" numberOfLines={1}>
            {rec.item.name}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {subtitle}
          </AppText>
          <RatingBadge rating={rec.item.rating} />
          {reason && (
            <AppText variant="caption" numberOfLines={2} style={{ color: colors.accent }}>
              {t(`because.${reason}`)}
            </AppText>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

export function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <AppText variant="heading">{title}</AppText>
        {right}
      </View>
      {children}
    </View>
  );
}

export function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <AppText variant="caption" muted>
          {label}
        </AppText>
        <AppText>{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing(3),
    padding: spacing(2.5),
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  trekCard: { padding: spacing(3.5) },
  thumb: { width: 76, height: 76, borderRadius: 10 },
  thumbPlaceholder: {
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  badge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing(2), paddingVertical: 1 },
  section: { gap: spacing(3) },
  recCard: {
    width: 200,
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  recImage: { width: '100%', height: 110 },
  infoRow: { flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start' },
});

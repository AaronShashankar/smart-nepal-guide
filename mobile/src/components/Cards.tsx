'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { photoUrl } from '@/lib/api';
import { days, districtName, formatNumber, km, meters, regionName } from '@/lib/format';
import type { Category, PlaceSummary, Recommendation, RiskLevel, TrekSummary } from '@/lib/types';
import { categoryColors, colors, difficultyTints, radii, shadows, spacing } from '@/theme';

import { AppText } from './AppText';
import { Pill } from './Chip';
import { MountainArt, Scrim } from './Layout';
import { RatingBadge } from './Stars';
import { PressableLink } from './PressableLink';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function CategoryIcon({
  category,
  size = 18,
  color,
}: {
  category: Pick<Category, 'code' | 'icon'>;
  size?: number;
  color?: string;
}) {
  const name = (category.icon ?? 'map-marker') as IconName;
  return (
    <MaterialCommunityIcons
      name={name in MaterialCommunityIcons.glyphMap ? name : 'map-marker'}
      size={size}
      color={color ?? categoryColors[category.code] ?? colors.accent}
    />
  );
}

/** "Easy · Moderate · Hard · Risky" pill: a word on a tint, never colour alone. */
export function DifficultyBadge({ level, prefix }: { level: RiskLevel; prefix?: string }) {
  const { t } = useTranslation();
  const label = t(`difficulty.${level}`);
  return <Pill label={prefix ? `${prefix}: ${label}` : label} tint={difficultyTints[level]} />;
}

function Thumbnail({ uri, category }: { uri: string | null; category: Category }) {
  if (uri) {
    return (
      <Image
        source={{ uri: photoUrl(uri) }}
        style={styles.thumb}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View style={[styles.thumb, styles.thumbPlaceholder]}>
      <CategoryIcon category={category} size={28} />
    </View>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.meta}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.textMuted} />
      <AppText variant="caption" weight="bold" style={{ color: colors.text }}>
        {text}
      </AppText>
    </View>
  );
}

export function PlaceCard({ place, distanceKm }: { place: PlaceSummary; distanceKm?: number }) {
  const { t } = useTranslation();
  return (
    <PressableLink
      href={{ pathname: '/place/[id]', params: { id: place.id } }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Thumbnail uri={place.thumbnail_url} category={place.category} />
      <View style={styles.body}>
        <AppText variant="subheading" numberOfLines={1}>
          {place.name}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {place.category.name}
          {place.district ? ` · ${districtName(place.district)}` : ''}
        </AppText>
        <View style={[styles.row, styles.between]}>
          {distanceKm != null ? (
            <Meta
              icon="map-marker-outline"
              text={t('units.kmAway', { value: formatNumber(distanceKm, 1) })}
            />
          ) : place.altitude_m != null ? (
            <Meta icon="image-filter-hdr" text={meters(place.altitude_m)} />
          ) : (
            <View />
          )}
          <RatingBadge rating={place.rating} />
        </View>
      </View>
    </PressableLink>
  );
}

export function TrekCard({ trek }: { trek: TrekSummary }) {
  return (
    <PressableLink
      href={{ pathname: '/trek/[id]', params: { id: trek.id } }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <MountainArt style={styles.thumb} />
      <View style={styles.body}>
        <AppText variant="subheading" numberOfLines={2}>
          {trek.name}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {regionName(trek.region)} · {days(trek.total_days)} · {km(trek.total_distance_km)}
        </AppText>
        <View style={[styles.row, styles.between]}>
          <View style={styles.row}>
            <Meta icon="image-filter-hdr" text={meters(trek.max_altitude_m)} />
            <RatingBadge rating={trek.rating} />
          </View>
          <DifficultyBadge level={trek.base_difficulty} />
        </View>
      </View>
    </PressableLink>
  );
}

/** Search result: picture on top with the difficulty pill, then name and days · km · altitude. */
export function TrekResultCard({ trek }: { trek: TrekSummary }) {
  return (
    <PressableLink
      href={{ pathname: '/trek/[id]', params: { id: trek.id } }}
      style={({ pressed }) => [styles.resultCard, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={{ height: 150 }}>
        <MountainArt style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', top: 12, left: 12 }}>
          <DifficultyBadge level={trek.base_difficulty} />
        </View>
      </View>
      <View style={{ padding: spacing(4), paddingTop: 14, gap: 10 }}>
        <AppText variant="subheading" style={{ fontSize: 17 }}>
          {trek.name}
        </AppText>
        <View style={[styles.row, { gap: spacing(4), flexWrap: 'wrap' }]}>
          <Meta icon="calendar-blank-outline" text={days(trek.total_days)} />
          <Meta icon="map-marker-distance" text={km(trek.total_distance_km)} />
          <Meta icon="image-filter-hdr" text={meters(trek.max_altitude_m)} />
          <RatingBadge rating={trek.rating} />
        </View>
      </View>
    </PressableLink>
  );
}

/** Tall photo card for the sideways "Recommended for you" row, with the reason it was picked. */
export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const { t } = useTranslation();
  const href =
    rec.type === 'place'
      ? ({ pathname: '/place/[id]', params: { id: rec.item.id } } as const)
      : ({ pathname: '/trek/[id]', params: { id: rec.item.id } } as const);
  const meta =
    rec.type === 'place'
      ? [
          rec.item.category.name,
          rec.item.district && districtName(rec.item.district),
          rec.item.altitude_m != null && meters(rec.item.altitude_m),
        ]
      : [t('explore.trek'), regionName(rec.item.region), days(rec.item.total_days)];
  const reason = rec.because[0];
  const photo =
    rec.type === 'place' && rec.item.thumbnail_url ? photoUrl(rec.item.thumbnail_url) : null;
  return (
    <PressableLink
      href={href}
      style={({ pressed }) => [styles.recCard, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <MountainArt style={StyleSheet.absoluteFill} />
      )}
      <Scrim
        id={`rec-${rec.item.id}`}
        stops={[
          [0.3, 0],
          [0.55, 0.35],
          [1, 0.88],
        ]}
      />
      <View style={styles.recText}>
        {reason && <Pill label={t(`because.${reason}`)} onPhoto />}
        <AppText variant="title" numberOfLines={2} style={{ color: '#FFFFFF' }}>
          {rec.item.name}
        </AppText>
        <AppText variant="caption" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.86)' }}>
          {meta.filter(Boolean).join(' · ')}
        </AppText>
        <RatingBadge rating={rec.item.rating} light />
      </View>
    </PressableLink>
  );
}

export function Section({
  title,
  children,
  right,
  big,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  /** 20 px heading, for the home screen sections */
  big?: boolean;
}) {
  return (
    <View style={styles.section}>
      <View style={[styles.row, styles.between]}>
        <AppText
          variant="heading"
          style={big && { fontSize: 20, lineHeight: 26 }}
          accessibilityRole="header"
        >
          {title}
        </AppText>
        {right}
      </View>
      {children}
    </View>
  );
}

export function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="small" muted>
          {label}
        </AppText>
        <AppText variant="label" weight="semibold">
          {value}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    ...shadows.card,
  },
  pressed: { opacity: 0.85 },
  thumb: { width: 80, height: 80, borderRadius: 16 },
  thumbPlaceholder: {
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  between: { justifyContent: 'space-between' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  section: { gap: spacing(3) },
  resultCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  recCard: {
    width: 270,
    height: 330,
    borderRadius: radii.panel,
    overflow: 'hidden',
    backgroundColor: colors.navy,
  },
  recText: { position: 'absolute', left: 18, right: 18, bottom: 18, gap: spacing(2) },
  infoRow: { flexDirection: 'row', gap: spacing(3), alignItems: 'center' },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { photoUrl } from '@/lib/api';
import { days, km, meters } from '@/lib/format';
import type { Category, PlaceSummary, RiskLevel, TrekSummary } from '@/lib/types';
import { categoryColors, colors, difficultyColors, spacing } from '@/theme';

import { AppText } from './AppText';

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

export function PlaceCard({ place }: { place: PlaceSummary }) {
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
              {place.district ? ` · ${place.district}` : ''}
            </AppText>
          </View>
          {place.altitude_m != null && (
            <AppText variant="caption" muted>
              {meters(place.altitude_m)}
            </AppText>
          )}
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
            {trek.region} · {days(trek.total_days)} · {km(trek.total_distance_km)}
          </AppText>
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
  infoRow: { flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start' },
});

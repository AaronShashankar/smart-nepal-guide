import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { colors, GUTTER, radii, shadows, spacing, TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './Button';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Vertical dark scrim over a photo; `stops` are [offset 0..1, opacity]. */
export function Scrim({
  stops,
  id,
  style,
}: {
  stops: [number, number][];
  id: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {stops.map(([offset, opacity]) => (
            <Stop key={offset} offset={offset} stopColor="#08101F" stopOpacity={opacity} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Navy mountain picture for things that have no photo (treks). */
export function MountainArt({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.navy, overflow: 'hidden' }, style]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 390 300"
        preserveAspectRatio="xMidYMax slice"
        style={StyleSheet.absoluteFill}
      >
        <Path
          d="M0 300 L0 190 L70 120 L120 165 L190 70 L250 140 L300 100 L390 170 L390 300 Z"
          fill="#163066"
        />
        <Path
          d="M190 70 L215 100 L200 98 L190 112 L178 96 L165 103 Z"
          fill="#E8EEF7"
          opacity={0.85}
        />
        <Path
          d="M0 300 L0 230 L90 180 L160 220 L240 170 L320 215 L390 190 L390 300 Z"
          fill="#1F3D7A"
        />
        <Path d="M0 300 L0 265 L120 235 L220 260 L320 240 L390 255 L390 300 Z" fill="#2A4B8C" />
      </Svg>
    </View>
  );
}

/**
 * Photo-led header for place and trek detail: the photo (or MountainArt) fills it, a scrim keeps
 * the white text readable, round buttons sit at the top, pills + title at the bottom. Put a
 * <ContentSheet> right after it: it overlaps the photo by 24 px with rounded corners.
 */
export function HeroHeader({
  photo,
  children,
  height = 420,
  actions,
  background,
}: {
  photo?: string | null;
  children: React.ReactNode;
  height?: number;
  actions?: React.ReactNode;
  /** Custom background in place of the photo (a carousel). */
  background?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ height }}>
      {background ??
        (photo ? (
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <MountainArt style={StyleSheet.absoluteFill} />
        ))}
      <Scrim
        id="hero"
        stops={[
          [0, 0.45],
          [0.28, 0],
          [0.5, 0],
          [1, 0.85],
        ]}
      />
      <View style={[styles.heroTop, { top: insets.top + spacing(2) }]} pointerEvents="box-none">
        <IconButton icon="chevron-left" label={t('common.back')} onPhoto onPress={goBack} />
        <View style={styles.row}>{actions}</View>
      </View>
      <View style={styles.heroBottom} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

/** The rounded sheet that slides over the bottom of a HeroHeader. */
export function ContentSheet({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.sheet, style]}>{children}</View>;
}

/** Back button + small subtitle + title (itinerary, risk check, trip). */
export function PageHeader({
  title,
  subtitle,
  right,
  back = true,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  back?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.pageHeader}>
      {back && <IconButton icon="chevron-left" label={t('common.back')} onPress={goBack} />}
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <AppText variant="caption" weight="semibold" muted numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        <AppText variant={back ? 'title' : 'display'} accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {right}
    </View>
  );
}

export interface Tile {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  subColor?: string;
}

/** Three equal white tiles: Duration / Distance / Highest. */
export function StatTiles({ tiles, compact }: { tiles: Tile[]; compact?: boolean }) {
  return (
    <View style={styles.tiles}>
      {tiles.map((tile) => (
        <View key={tile.label} style={[styles.tile, compact && styles.tileCompact]}>
          <AppText variant="small" muted numberOfLines={1}>
            {tile.label}
          </AppText>
          <AppText
            variant="title"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              { fontSize: compact ? 17 : 19, lineHeight: 24 },
              tile.color ? { color: tile.color } : null,
            ]}
          >
            {tile.value}
          </AppText>
          {tile.sub ? (
            <AppText
              variant="small"
              muted
              numberOfLines={1}
              style={{ fontSize: 11, color: tile.subColor ?? colors.textMuted }}
            >
              {tile.sub}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** Height of the bottom action bar's content, so the scroll view can leave room for it. */
export const ACTION_BAR_SPACE = 54 + spacing(3.5) + spacing(4);

/** White bar fixed to the bottom of a detail page with the one crimson action. */
export function BottomActionBar({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing(4) }]}>
      {children}
    </View>
  );
}

/** Navy panel with an icon, a title and a line of text that links somewhere (risk check). */
export function HighlightLink({
  icon,
  title,
  body,
  onPress,
}: {
  icon: IconName;
  title: string;
  body?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.highlight, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.highlightIcon}>
        <MaterialCommunityIcons name={icon} size={26} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="subheading" style={{ color: '#FFFFFF' }}>
          {title}
        </AppText>
        {body ? (
          <AppText variant="caption" weight="regular" style={{ color: 'rgba(255,255,255,0.78)' }}>
            {body}
          </AppText>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#FFFFFF" />
    </Pressable>
  );
}

/** A white card with rows split by thin lines (fees, permits, nearby). */
export function ListCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.listCard, style]}>{children}</View>;
}

export function ListRow({
  label,
  value,
  valueColor,
  last,
  highlight,
  sub,
}: {
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
  highlight?: boolean;
  sub?: string;
}) {
  return (
    <View style={[styles.listRow, !last && styles.listDivider, highlight && styles.listTotal]}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" weight={highlight ? 'bold' : 'regular'}>
          {label}
        </AppText>
        {sub ? (
          <AppText variant="small" weight="regular" muted>
            {sub}
          </AppText>
        ) : null}
      </View>
      <AppText
        variant={highlight ? 'heading' : 'label'}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </AppText>
    </View>
  );
}

const TAB_ICONS: Record<string, IconName> = {
  index: 'compass-outline',
  map: 'map-outline',
  search: 'magnify',
  trips: 'map-marker-path',
  settings: 'account-outline',
};

/** Floating dark tab bar: the current tab is a crimson pill with its name, the others icon-only. */
export function FloatingTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  return (
    <View
      style={[styles.tabBar, { bottom: insets.bottom + TAB_BAR_BOTTOM }]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;
        const icon = TAB_ICONS[route.name] ?? 'circle-outline';
        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={[styles.tab, focused && styles.tabOn]}
          >
            <MaterialCommunityIcons
              name={icon}
              size={focused ? 22 : 24}
              color={focused ? '#FFFFFF' : colors.iconMuted}
            />
            {focused && (
              <AppText variant="label" style={{ color: '#FFFFFF' }} numberOfLines={1}>
                {label}
              </AppText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing(2) },
  heroTop: {
    position: 'absolute',
    left: spacing(4),
    right: spacing(4),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroBottom: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
    bottom: 44,
    gap: spacing(2.5),
  },
  sheet: {
    marginTop: -24,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.background,
    paddingHorizontal: GUTTER,
    paddingTop: GUTTER,
    gap: 22,
  },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  tiles: { flexDirection: 'row', gap: spacing(2) },
  tile: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: spacing(3),
    borderRadius: radii.tile,
    backgroundColor: colors.surface,
    gap: 4,
  },
  tileCompact: { padding: spacing(3) },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingTop: spacing(3.5),
    paddingHorizontal: GUTTER,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: spacing(4),
    borderRadius: 22,
    backgroundColor: colors.navy,
  },
  highlightIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: { borderRadius: radii.card, backgroundColor: colors.surface, overflow: 'hidden' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: 14,
    paddingHorizontal: spacing(4),
    minHeight: 48,
  },
  listDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  listTotal: { backgroundColor: colors.surfaceAlt },
  tabBar: {
    position: 'absolute',
    left: spacing(4),
    right: spacing(4),
    height: TAB_BAR_HEIGHT,
    borderRadius: radii.panel,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    ...shadows.floating,
  },
  tab: {
    height: 48,
    minWidth: 48,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing(2),
  },
  tabOn: { backgroundColor: colors.primary, paddingHorizontal: spacing(4), flexShrink: 1 },
});

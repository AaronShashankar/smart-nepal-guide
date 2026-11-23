import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, difficultyTints, radii, spacing, type Tint } from '@/theme';

import { AppText } from './AppText';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * Filter chip: dark when on, white with a border when off. `tint` (difficulty filters) shows the
 * pill colours with a tick when on.
 */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  iconColor,
  tint,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  iconColor?: string;
  tint?: Tint;
}) {
  const tinted = tint && selected;
  const fg = tinted ? tint.fg : selected ? '#FFFFFF' : tint ? colors.textSecondary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        tint && styles.tintChip,
        selected && !tint && styles.selected,
        tinted && { backgroundColor: tint.bg, borderColor: tint.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      {tinted ? (
        <MaterialCommunityIcons name="check-bold" size={14} color={tint.fg} />
      ) : (
        icon && (
          <MaterialCommunityIcons
            name={icon}
            size={16}
            color={selected ? '#FFFFFF' : (iconColor ?? colors.primary)}
          />
        )
      )}
      <AppText variant="label" weight={selected ? 'bold' : 'semibold'} style={{ color: fg }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** A row of chips where at most one is selected (tap again to clear). */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  allowClear = true,
  tints,
}: {
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (value: T | null) => void;
  allowClear?: boolean;
  tints?: Record<string, Tint>;
}) {
  return (
    <>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={value === o.value}
          tint={tints?.[o.value]}
          onPress={() => onChange(value === o.value && allowClear ? null : o.value)}
        />
      ))}
    </>
  );
}

/** Two or three options in a grey track (Places / Treks, Low / Medium / High). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  dark,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  dark?: boolean;
}) {
  return (
    <View style={[styles.track, dark && styles.trackDark]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, dark && styles.segmentDark, on && styles.segmentOn]}
          >
            <AppText
              variant="label"
              style={{
                color: on ? colors.ink : dark ? '#FFFFFF' : colors.textSecondary,
                fontSize: dark ? 15 : 14,
              }}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small read-only pill ("Hard", "Rest day"). */
export function Pill({
  label,
  tint,
  icon,
  onPhoto,
}: {
  label: string;
  tint?: Tint;
  icon?: IconName;
  onPhoto?: boolean;
}) {
  const t = tint ?? difficultyTints.easy;
  const fg = onPhoto ? '#FFFFFF' : t.fg;
  return (
    <View
      style={[
        styles.pill,
        onPhoto ? styles.pillOnPhoto : { backgroundColor: tint ? t.bg : colors.chip },
      ]}
    >
      {icon && <MaterialCommunityIcons name={icon} size={13} color={tint ? fg : colors.text} />}
      <AppText variant="small" weight="bold" style={{ color: tint || onPhoto ? fg : colors.text }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(4),
    minHeight: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tintChip: { minHeight: 36, paddingHorizontal: spacing(3.5), borderWidth: 1.5 },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.sunken,
  },
  // On a photo (welcome screen): see-through track with a white selected segment.
  trackDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2.5),
  },
  segmentDark: { minHeight: 44, borderRadius: 13 },
  segmentOn: {
    backgroundColor: colors.surface,
    shadowColor: '#0E1726',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: spacing(2.5),
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  pillOnPhoto: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

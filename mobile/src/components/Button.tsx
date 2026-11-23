import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { AppText } from './AppText';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Variant = 'primary' | 'secondary' | 'dark' | 'ghost' | 'light';

const FG: Record<Variant, string> = {
  primary: '#FFFFFF',
  secondary: colors.ink,
  dark: '#FFFFFF',
  ghost: colors.primary,
  light: colors.ink,
};

interface Props {
  title: string;
  onPress: () => void;
  /** primary = crimson (one per screen), secondary = outlined, dark = navy, ghost = text button */
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** A ready-made icon element, or the name of a MaterialCommunityIcons icon. */
  icon?: React.ReactNode | IconName;
  compact?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  icon,
  compact,
}: Props) {
  const inactive = disabled || loading;
  const fg = FG[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        styles[variant],
        pressed && (variant === 'primary' ? styles.primaryPressed : { opacity: 0.8 }),
        inactive && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {typeof icon === 'string' ? (
            <MaterialCommunityIcons name={icon as IconName} size={20} color={fg} />
          ) : (
            icon
          )}
          <AppText variant="label" style={{ color: fg, fontSize: compact ? 14 : 15 }}>
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

/** Round 44 × 44 icon button (back, share, more). `onPhoto` = white on top of a hero photo. */
export function IconButton({
  icon,
  label,
  onPress,
  onPhoto,
  active,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  onPhoto?: boolean;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.icon,
        onPhoto ? styles.iconOnPhoto : styles.iconPlain,
        active && { backgroundColor: colors.primary },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={active ? '#FFFFFF' : colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radii.button,
    paddingHorizontal: spacing(6),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing(2),
  },
  compact: { minHeight: 44, paddingHorizontal: spacing(4) },
  primary: { backgroundColor: colors.primary },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.ink },
  dark: { backgroundColor: colors.ink },
  ghost: { backgroundColor: 'transparent', borderRadius: radii.pill },
  light: { backgroundColor: colors.surface },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOnPhoto: { backgroundColor: 'rgba(255,255,255,0.92)' },
  iconPlain: {
    backgroundColor: colors.surface,
    shadowColor: '#0E1726',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});

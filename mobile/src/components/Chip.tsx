import { Pressable, StyleSheet } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <AppText variant="label" style={{ color: selected ? '#fff' : colors.text }}>
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
}: {
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (value: T | null) => void;
  allowClear?: boolean;
}) {
  return (
    <>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={value === o.value}
          onPress={() => onChange(value === o.value && allowClear ? null : o.value)}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing(3.5),
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.chip,
  },
  selected: { backgroundColor: colors.primary },
});

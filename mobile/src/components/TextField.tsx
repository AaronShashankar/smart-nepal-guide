import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { AppText, fontFor } from './AppText';

/** Grey field at rest, white with a 2 px dark border while focused. */
export function TextField({
  label,
  hint,
  onFocus,
  onBlur,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <AppText variant="caption" weight="bold" style={{ color: colors.textMuted }}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { fontFamily: fontFor('medium') }, focused && styles.focused, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {hint && (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing(1.5) },
  input: {
    minHeight: 52,
    borderRadius: radii.button,
    paddingHorizontal: spacing(4),
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.background,
    fontSize: 15,
    color: colors.text,
  },
  focused: { backgroundColor: colors.surface, borderColor: colors.ink },
});

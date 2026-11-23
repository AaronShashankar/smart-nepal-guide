import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radii, spacing } from '@/theme';

import { AppText, fontFor } from './AppText';

/**
 * Grey field at rest, white with a 2 px dark border while focused.
 *
 * With `secureTextEntry` it is a password field: an eye button at the right shows or hides the
 * password. `ref` reaches the TextInput, so a form can move focus to the next field.
 */
export function TextField({
  label,
  hint,
  onFocus,
  onBlur,
  style,
  secureTextEntry,
  ref,
  ...props
}: TextInputProps & { label: string; hint?: string; ref?: Ref<TextInputInstance> }) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const isPassword = !!secureTextEntry;
  return (
    <View style={styles.wrap}>
      <AppText variant="caption" weight="bold" style={{ color: colors.textMuted }}>
        {label}
      </AppText>
      <View style={[styles.box, focused && styles.focused]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { fontFamily: fontFor('medium') }, style]}
          secureTextEntry={isPassword && !shown}
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
        {isPassword && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? t('auth.hidePassword') : t('auth.showPassword')}
            onPress={() => setShown((s) => !s)}
            hitSlop={8}
            style={({ pressed }) => [styles.eye, pressed && { opacity: 0.6 }]}
          >
            <MaterialCommunityIcons
              name={shown ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={colors.textMuted}
            />
          </Pressable>
        )}
      </View>
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
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.button,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.background,
  },
  focused: { backgroundColor: colors.surface, borderColor: colors.ink },
  input: {
    flex: 1,
    minHeight: 48, // + the 2 px border on each side = the old 52 px field
    paddingHorizontal: spacing(4),
    fontSize: 15,
    color: colors.text,
  },
  eye: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
});

import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import i18n from '@/i18n';
import { colors, fonts, latinFonts, type Weight } from '@/theme';

type Variant =
  'display' | 'title' | 'heading' | 'subheading' | 'body' | 'label' | 'caption' | 'small';

/** Type scale from the style sheet (size / line height / weight). */
const variants: Record<
  Variant,
  { fontSize: number; lineHeight: number; weight: Weight; letterSpacing?: number }
> = {
  display: { fontSize: 30, lineHeight: 36, weight: 'extrabold', letterSpacing: -0.6 }, // 30/36 · 800
  title: { fontSize: 22, lineHeight: 28, weight: 'extrabold', letterSpacing: -0.2 }, // 22/28 · 800
  heading: { fontSize: 18, lineHeight: 24, weight: 'extrabold' }, // section 18/24 · 800
  subheading: { fontSize: 16, lineHeight: 22, weight: 'bold' },
  body: { fontSize: 15, lineHeight: 24, weight: 'regular' }, // 15/24 · 400
  label: { fontSize: 14, lineHeight: 20, weight: 'bold' },
  caption: { fontSize: 13, lineHeight: 19, weight: 'medium' },
  small: { fontSize: 12, lineHeight: 16, weight: 'semibold' }, // caption 12/16 · 600
};

const DEVANAGARI = /[ऀ-ॿ]/;

/** True when the text (a string, or an array that holds strings) has Devanagari letters or digits. */
export function hasDevanagari(node: ReactNode): boolean {
  if (typeof node === 'string') return DEVANAGARI.test(node);
  if (Array.isArray(node)) return node.some(hasDevanagari);
  return false;
}

/** Font for text we cannot inspect (inputs, headers): Nepali font when the app is in Nepali. */
export function fontFor(weight: Weight, text?: ReactNode): string {
  const nepali = text !== undefined ? hasDevanagari(text) : i18n.language === 'ne';
  return (nepali ? fonts : latinFonts)[weight];
}

/**
 * Text in Plus Jakarta Sans for English and Noto Sans Devanagari for Nepali (Noto also has Latin
 * letters, so mixed text is fine). Devanagari lines get +4 px line height so matras are not clipped.
 *
 * Android fix (BUG-06): a label that is exactly as wide as its text ("मेरो नजिक" in a chip, a button
 * title, a badge) is drawn in a box a fraction of a pixel narrower than the measured width. Latin
 * text is laid out as a single "boring" line and never breaks, but Devanagari goes through the
 * line breaker, so its last word (or letter) moves to a second line that the one-line box hides.
 * A tiny no-break space at the end (about 2 px) gives the line breaker that missing pixel.
 */
export function AppText({
  variant = 'body',
  weight,
  muted,
  style,
  children,
  ...rest
}: TextProps & { variant?: Variant; weight?: Weight; muted?: boolean }) {
  const nepali = hasDevanagari(children);
  const v = variants[variant];
  const pad = Platform.OS === 'android' && nepali;
  return (
    <Text
      style={[
        {
          fontSize: v.fontSize,
          lineHeight: v.lineHeight + (nepali ? 4 : 0),
          fontFamily: (nepali ? fonts : latinFonts)[weight ?? v.weight],
          letterSpacing: nepali ? 0 : v.letterSpacing,
          color: muted ? colors.textMuted : colors.text,
        },
        style,
      ]}
      {...rest}
    >
      {children}
      {pad && <Text style={styles.pad}>{'\u202F'}</Text>}
    </Text>
  );
}

const styles = StyleSheet.create({
  // 5 sp narrow no-break space ≈ 2–3 px: invisible, but enough slack for the line breaker.
  pad: { fontSize: 5 },
});

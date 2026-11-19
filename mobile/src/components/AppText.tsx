import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from '@/theme';

type Variant = 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label';

const variants: Record<Variant, { fontSize: number; lineHeight: number; fontFamily: string }> = {
  title: { fontSize: 26, lineHeight: 38, fontFamily: fonts.bold },
  heading: { fontSize: 19, lineHeight: 30, fontFamily: fonts.semibold },
  subheading: { fontSize: 16, lineHeight: 25, fontFamily: fonts.semibold },
  body: { fontSize: 15, lineHeight: 24, fontFamily: fonts.regular },
  caption: { fontSize: 13, lineHeight: 20, fontFamily: fonts.regular },
  label: { fontSize: 14, lineHeight: 21, fontFamily: fonts.medium },
};

const DEVANAGARI = /[ऀ-ॿ]/;

/** True when the text (a string, or an array that holds strings) has Devanagari letters or digits. */
export function hasDevanagari(node: ReactNode): boolean {
  if (typeof node === 'string') return DEVANAGARI.test(node);
  if (Array.isArray(node)) return node.some(hasDevanagari);
  return false;
}

/**
 * Text with Noto Sans Devanagari, so Nepali and English render well on every phone.
 *
 * Android fix (BUG-06): a label that is exactly as wide as its text ("मेरो नजिक" in a chip, a button
 * title, a badge) is drawn in a box a fraction of a pixel narrower than the measured width. Latin
 * text is laid out as a single "boring" line and never breaks, but Devanagari goes through the
 * line breaker, so its last word (or letter) moves to a second line that the one-line box hides.
 * A tiny no-break space at the end (about 2 px) gives the line breaker that missing pixel.
 */
export function AppText({
  variant = 'body',
  muted,
  style,
  children,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean }) {
  const pad = Platform.OS === 'android' && hasDevanagari(children);
  return (
    <Text
      style={[variants[variant], { color: muted ? colors.textMuted : colors.text }, style]}
      {...rest}
    >
      {children}
      {pad && <Text style={styles.pad}>{' '}</Text>}
    </Text>
  );
}

const styles = StyleSheet.create({
  // 5 sp narrow no-break space ≈ 2–3 px: invisible, but enough slack for the line breaker.
  pad: { fontSize: 5 },
});

import { Text, type TextProps } from 'react-native';

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

/** Text with Noto Sans Devanagari, so Nepali and English render well on every phone. */
export function AppText({
  variant = 'body',
  muted,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean }) {
  return (
    <Text
      style={[variants[variant], { color: muted ? colors.textMuted : colors.text }, style]}
      {...rest}
    />
  );
}

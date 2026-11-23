import type { ViewStyle } from 'react-native';

/*
 * "Bato · Summit" look (design canvas "Bato App Redesign", style sheet artboard): cool light
 * ground, white cards, photo-led heroes, one crimson action colour and a dark navy for the tab bar
 * and highlight panels.
 */
export const colors = {
  primary: '#C8102E', // Nepal crimson: one primary action per screen
  primaryDark: '#9E0C24', // pressed
  primaryPressed: '#9E0C24',
  accent: '#0B1F4D', // navy: highlight panels, chart lines, links in icons
  navy: '#0B1F4D',
  ink: '#0E1726', // tab bar, dark buttons, selected chips
  background: '#F3F5F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFB', // total rows in tables
  sunken: '#E6EAEF', // segmented control track, slider track
  text: '#0E1726',
  textBody: '#2B3545', // long paragraphs
  textSecondary: '#4A5566',
  textMuted: '#5F6B7C',
  iconMuted: '#A7B1C2', // inactive tab icons, drag handles
  border: '#E3E7EC',
  divider: '#EEF1F4',
  success: '#0F6B43',
  warning: '#B45309',
  danger: '#B91C1C',
  chip: '#F3F5F7',
  sun: '#D97706',
};

/** Pill colours: text on tint passes 4.5:1. Every pill has a word, never colour alone. */
export interface Tint {
  bg: string;
  fg: string;
  border: string;
}

export const difficultyTints: Record<string, Tint> = {
  easy: { bg: '#E7F5EE', fg: '#0F6B43', border: '#0F7B4D' },
  moderate: { bg: '#FBF1DC', fg: '#8A5A00', border: '#A16207' },
  hard: { bg: '#FDECE3', fg: '#B33A0B', border: '#C2410C' },
  risky: { bg: '#FDECEC', fg: '#B91C1C', border: '#B91C1C' },
};

export const statusTints: Record<string, Tint> = {
  ok: { bg: '#E7F5EE', fg: '#0F6B43', border: '#0F7B4D' },
  caution: { bg: '#FEF3C7', fg: '#92400E', border: '#D97706' },
  danger: { bg: '#FDECEC', fg: '#B91C1C', border: '#B91C1C' },
  rest: { bg: '#E0ECFF', fg: '#1D4ED8', border: '#1D4ED8' },
};

// Strong colours for lines, gauge arcs and icons (dark enough to read on white).
export const difficultyColors: Record<string, string> = {
  easy: '#0F7B4D',
  moderate: '#A16207',
  hard: '#C2410C',
  risky: '#B91C1C',
};

export const statusColors: Record<string, string> = {
  ok: '#0B1F4D',
  caution: '#D97706',
  danger: '#B91C1C',
};

export const categoryColors: Record<string, string> = {
  temple: '#C8102E',
  heritage: '#8D5524',
  lake: '#0277BD',
  viewpoint: '#6A1B9A',
  national_park: '#0F7B4D',
  village: '#455A64',
};

/** 4-px grid: screen gutter 20 (spacing(5)), card padding 16 (spacing(4)). */
export const spacing = (n: number) => n * 4;
export const GUTTER = 20;

export const radii = {
  chip: 12,
  button: 16,
  card: 20,
  tile: 18,
  panel: 24,
  sheet: 28,
  pill: 999,
};

export const shadows: Record<'card' | 'raised' | 'floating', ViewStyle> = {
  card: {
    shadowColor: '#0E1726',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#0E1726',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  floating: {
    shadowColor: '#0E1726',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
};

/** Noto Sans Devanagari: for Nepali text (it has Latin letters too, so mixed text is fine). */
export const fonts = {
  regular: 'NotoSansDevanagari_400Regular',
  medium: 'NotoSansDevanagari_500Medium',
  semibold: 'NotoSansDevanagari_600SemiBold',
  bold: 'NotoSansDevanagari_700Bold',
  extrabold: 'NotoSansDevanagari_800ExtraBold',
};

/** Plus Jakarta Sans: for English text. */
export const latinFonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export type Weight = keyof typeof fonts;

/** Space under the content of a tab screen so the floating tab bar does not cover it. */
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_BOTTOM = 12;
export const TAB_BAR_SPACE = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 24;

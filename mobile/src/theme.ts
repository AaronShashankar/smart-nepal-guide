export const colors = {
  primary: '#C8102E', // Nepal crimson
  primaryDark: '#9E0C24',
  accent: '#003893', // Nepal blue
  background: '#F7F7F5',
  surface: '#FFFFFF',
  text: '#1B1B1F',
  textMuted: '#5F6368',
  border: '#E2E2E0',
  success: '#2E7D32',
  warning: '#B26A00',
  danger: '#B3261E',
  chip: '#EFEFEC',
};

export const difficultyColors: Record<string, string> = {
  easy: '#2E7D32',
  moderate: '#B26A00',
  hard: '#C8102E',
  risky: '#6A1B9A',
};

export const categoryColors: Record<string, string> = {
  temple: '#C8102E',
  heritage: '#8D5524',
  lake: '#0277BD',
  viewpoint: '#6A1B9A',
  national_park: '#2E7D32',
  village: '#455A64',
};

export const spacing = (n: number) => n * 4;

export const fonts = {
  regular: 'NotoSansDevanagari_400Regular',
  medium: 'NotoSansDevanagari_500Medium',
  semibold: 'NotoSansDevanagari_600SemiBold',
  bold: 'NotoSansDevanagari_700Bold',
};

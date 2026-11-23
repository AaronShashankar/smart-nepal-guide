import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors, radii, spacing } from '@/theme';

import { AppText } from './AppText';
import { Scrim } from './Layout';

// Sunrise over the Annapurna range from Poon Hill (from the design canvas).
const PHOTO = require('../../assets/images/welcome-poonhill.jpg');

/** Bato mark: crimson rounded square with the mountain and path, and the name in both scripts. */
export function BrandMark() {
  return (
    <View style={styles.brand}>
      <View style={styles.logo}>
        <MaterialCommunityIcons name="image-filter-hdr" size={24} color="#FFFFFF" />
      </View>
      <AppText variant="title" style={{ color: '#FFFFFF' }}>
        Bato{' '}
        <AppText variant="title" weight="semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
          बाटो
        </AppText>
      </AppText>
    </View>
  );
}

/** Google "G" for the sign-in button (Google's sign-in branding asks for the coloured mark). */
export function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.4-.2-2H12v3.9h6c-.1 1-.8 2.5-2.3 3.5v2.8h3.6c2.1-2 3.3-4.9 3.3-8.2z"
      />
      <Path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9C3.9 20.6 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.8 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7H2.1C1.4 8.5 1 10.2 1 12s.4 3.5 1.1 5l3.7-2.9z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.4c1.6 0 2.8.7 3.4 1.3l2.6-2.5C16.4 2.7 14.4 1.8 12 1.8 7.7 1.8 3.9 4.3 2.1 7.9l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </Svg>
  );
}

/**
 * Full-screen mountain photo with a dark fade at the bottom, the Bato mark at the top and the
 * content (title, buttons) stacked at the bottom.
 */
export function WelcomeBackdrop({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.fill}>
      <Image source={PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      <Scrim
        id="welcome"
        stops={[
          [0, 0.55],
          [0.26, 0],
          [0.42, 0.15],
          [0.68, 0.92],
          [1, 1],
        ]}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing(4), paddingBottom: insets.bottom + spacing(8) },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <BrandMark />
        <View style={styles.bottom}>{children}</View>
      </ScrollView>
    </View>
  );
}

export const welcomeStyles = StyleSheet.create({
  title: { color: '#FFFFFF', fontSize: 36, lineHeight: 44 },
  body: { color: 'rgba(255,255,255,0.82)', fontSize: 16 },
});

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.navy },
  content: { flexGrow: 1, paddingHorizontal: spacing(6), justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radii.chip,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { gap: 22, marginTop: spacing(16) },
});

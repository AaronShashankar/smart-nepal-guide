import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { WelcomeBackdrop, welcomeStyles } from '@/components/Welcome';
import type { Lang } from '@/lib/types';
import { useSettings } from '@/store/settings';
import { colors, radii, spacing } from '@/theme';

const OPTIONS: { lang: Lang; label: string; sample: string }[] = [
  { lang: 'en', label: 'English', sample: 'Explore Nepal, in your own language.' },
  { lang: 'ne', label: 'नेपाली', sample: 'नेपाल घुम्नुहोस्, आफ्नै भाषामा।' },
];

/** First launch: pick a language (shown in both, since we do not know which one yet). */
export default function LanguageScreen() {
  const setLanguage = useSettings((s) => s.setLanguage);

  return (
    <WelcomeBackdrop>
      <View style={{ gap: spacing(2) }}>
        <AppText variant="display" style={welcomeStyles.title} accessibilityRole="header">
          Choose your language
        </AppText>
        <AppText variant="title" style={{ color: 'rgba(255,255,255,0.82)' }}>
          भाषा छान्नुहोस्
        </AppText>
        <AppText style={welcomeStyles.body}>
          You can change this later · पछि परिवर्तन गर्न सकिन्छ
        </AppText>
      </View>
      <View style={{ gap: 10 }}>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.lang}
            accessibilityRole="button"
            onPress={() => setLanguage(o.lang)}
            style={({ pressed }) => [styles.option, pressed && { opacity: 0.85 }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="title">{o.label}</AppText>
              <AppText variant="caption" muted>
                {o.sample}
              </AppText>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={24} color={colors.primary} />
          </Pressable>
        ))}
      </View>
    </WelcomeBackdrop>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(5),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
});

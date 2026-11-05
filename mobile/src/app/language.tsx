import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import type { Lang } from '@/lib/types';
import { useSettings } from '@/store/settings';
import { colors, spacing } from '@/theme';

const OPTIONS: { lang: Lang; label: string; sample: string }[] = [
  { lang: 'en', label: 'English', sample: 'Explore Nepal' },
  { lang: 'ne', label: 'नेपाली', sample: 'नेपाल घुमौँ' },
];

export default function LanguageScreen() {
  const { t } = useTranslation();
  const setLanguage = useSettings((s) => s.setLanguage);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <AppText variant="title">{t('language.title')}</AppText>
        <AppText variant="title" muted>
          भाषा छान्नुहोस्
        </AppText>
        <AppText muted>{t('language.subtitle')}</AppText>
      </View>
      {OPTIONS.map((o) => (
        <Pressable
          key={o.lang}
          accessibilityRole="button"
          onPress={() => setLanguage(o.lang)}
          style={({ pressed }) => [styles.option, pressed && { borderColor: colors.primary }]}
        >
          <AppText variant="heading">{o.label}</AppText>
          <AppText muted>{o.sample}</AppText>
        </Pressable>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing(6),
    justifyContent: 'center',
    gap: spacing(4),
  },
  header: { gap: spacing(1), marginBottom: spacing(4) },
  option: {
    padding: spacing(5),
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
});

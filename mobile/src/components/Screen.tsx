import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

/** Scrollable page with safe-area padding and the app background. */
export function Screen({
  children,
  edges = ['top'],
  contentStyle,
  ...rest
}: ScrollViewProps & { edges?: Edge[]; contentStyle?: ScrollViewProps['contentContainerStyle'] }) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        {...rest}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), gap: spacing(5), paddingBottom: spacing(10) },
});

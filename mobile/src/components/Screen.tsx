import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, GUTTER, spacing, TAB_BAR_SPACE } from '@/theme';

/**
 * Scrollable page with safe-area padding, the app background and a 20 px gutter. `tab` leaves room
 * at the bottom for the floating tab bar.
 */
export function Screen({
  children,
  edges = ['top'],
  contentStyle,
  tab,
  ...rest
}: ScrollViewProps & {
  edges?: Edge[];
  contentStyle?: ScrollViewProps['contentContainerStyle'];
  tab?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          tab && { paddingBottom: TAB_BAR_SPACE },
          contentStyle,
        ]}
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
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: spacing(4),
    gap: spacing(5),
    paddingBottom: spacing(10),
  },
});

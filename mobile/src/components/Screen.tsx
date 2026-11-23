import { KeyboardAvoidingView, ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, GUTTER, spacing, TAB_BAR_SPACE } from '@/theme';

/**
 * Scrollable page with safe-area padding, the app background and a 20 px gutter. `tab` leaves room
 * at the bottom for the floating tab bar.
 *
 * `avoidKeyboard` is for forms: the page shrinks to the space above the keyboard, and Android's
 * ScrollView then scrolls the focused field into view. It is needed because Android apps are
 * edge-to-edge, so the window itself no longer shrinks for the keyboard (V2-UI-02). Only for
 * screens without a navigation header (otherwise pass the header height as an offset).
 */
export function Screen({
  children,
  edges = ['top'],
  contentStyle,
  tab,
  avoidKeyboard,
  ...rest
}: ScrollViewProps & {
  edges?: Edge[];
  contentStyle?: ScrollViewProps['contentContainerStyle'];
  tab?: boolean;
  avoidKeyboard?: boolean;
}) {
  const page = (
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
  );
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView behavior="padding" style={styles.fill}>
          {page}
        </KeyboardAvoidingView>
      ) : (
        page
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: spacing(4),
    gap: spacing(5),
    paddingBottom: spacing(10),
  },
});

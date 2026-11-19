import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/lib/api';
import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.box} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} />
      <AppText muted variant="caption">
        {label ?? t('common.loading')}
      </AppText>
    </View>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <View style={styles.box}>
      <AppText muted style={styles.center}>
        {message}
      </AppText>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.box}>
      <AppText style={styles.center}>{errorMessage(error, t('common.error'))}</AppText>
      {onRetry && <Button title={t('common.retry')} variant="secondary" onPress={onRetry} />}
    </View>
  );
}

/**
 * Renders loading / error states for a query, or the children when data is ready.
 * If a refresh fails but older data is loaded (e.g. offline), the data stays with a short note
 * above it (BUG-13). `onRetry` replaces the default "refetch this query" for Try again.
 */
export function QueryState<T>({
  query,
  children,
  onRetry,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    data: T | undefined;
    refetch: () => unknown;
  };
  children: (data: T) => React.ReactNode;
  onRetry?: () => unknown;
}) {
  const { t } = useTranslation();
  if (query.isPending) return <Loading />;
  if (query.data === undefined)
    return <ErrorState error={query.error} onRetry={onRetry ?? (() => query.refetch())} />;
  return (
    <>
      {query.isError && (
        <AppText variant="caption" muted style={styles.center} accessibilityLiveRegion="polite">
          {errorMessage(query.error, t('common.error'))}
        </AppText>
      )}
      {children(query.data)}
    </>
  );
}

const styles = StyleSheet.create({
  box: { padding: spacing(6), alignItems: 'center', justifyContent: 'center', gap: spacing(3) },
  center: { textAlign: 'center' },
});

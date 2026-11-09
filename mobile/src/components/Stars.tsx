import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatNumber } from '@/lib/format';
import type { Rating } from '@/lib/types';
import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

export const STAR_COLOR = '#E0A100';

/** Read-only stars for a 1..5 value (halves rounded to the nearest half star). */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const half = Math.round(value * 2) / 2;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialCommunityIcons
          key={n}
          size={size}
          color={STAR_COLOR}
          name={half >= n ? 'star' : half >= n - 0.5 ? 'star-half-full' : 'star-outline'}
        />
      ))}
    </View>
  );
}

/** "★ 4.5 (12)", or nothing when the item has no reviews yet. */
export function RatingBadge({ rating }: { rating?: Rating | null }) {
  const { t } = useTranslation();
  if (!rating || rating.count === 0) return null;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={t('reviews.ratingA11y', {
        score: rating.score.toFixed(1),
        count: rating.count,
      })}
    >
      <MaterialCommunityIcons name="star" size={14} color={STAR_COLOR} />
      <AppText variant="caption">
        {formatNumber(rating.score, 1)}{' '}
        <AppText variant="caption" muted>
          ({formatNumber(rating.count)})
        </AppText>
      </AppText>
    </View>
  );
}

/** Tap a star to choose 1..5. */
export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.row, { gap: spacing(2) }]} accessibilityRole="adjustable">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('reviews.stars', { count: n })}
          accessibilityState={{ selected: value === n }}
        >
          <MaterialCommunityIcons
            name={value >= n ? 'star' : 'star-outline'}
            size={36}
            color={value >= n ? STAR_COLOR : colors.textMuted}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});

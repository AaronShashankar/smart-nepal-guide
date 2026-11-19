'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { type ReviewTarget, useDeleteReview, useReviews, useSaveReview } from '@/lib/queries';
import type { Review } from '@/lib/types';
import { colors, fonts, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Section } from './Cards';
import { StarPicker, Stars } from './Stars';
import { QueryState } from './StateViews';

const MAX_COMMENT = 1000;

function shortDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ReviewRow({ review, onDelete }: { review: Review; onDelete?: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <View style={[styles.card, review.is_mine && styles.mine]}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="subheading">
            {review.is_mine ? t('reviews.yours') : (review.author_name ?? t('reviews.traveller'))}
          </AppText>
          <View style={styles.inline}>
            <Stars value={review.rating} size={14} />
            <AppText variant="caption" muted>
              {shortDate(review.updated_at, i18n.language)}
            </AppText>
          </View>
        </View>
        {onDelete && (
          <Pressable
            onPress={onDelete}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('reviews.delete')}
          >
            <MaterialCommunityIcons name="delete-outline" size={22} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {review.comment && <AppText>{review.comment}</AppText>}
      {review.is_mine && review.status === 'hidden' && (
        <AppText variant="caption" style={{ color: colors.warning }}>
          {t('reviews.hiddenNote')}
        </AppText>
      )}
    </View>
  );
}

function WriteReviewSheet({
  target,
  existing,
  onClose,
}: {
  target: ReviewTarget;
  existing: Review | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const save = useSaveReview(target);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');

  async function submit() {
    try {
      await save.mutateAsync({ rating, comment: comment.trim() || null });
      onClose();
    } catch {
      // the error is shown below the button
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(4) }]}>
        <AppText variant="heading">{existing ? t('reviews.edit') : t('reviews.write')}</AppText>
        <StarPicker value={rating} onChange={setRating} />
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder={t('reviews.placeholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('reviews.comment')}
          multiline
          maxLength={MAX_COMMENT}
          style={styles.input}
        />
        <AppText variant="caption" muted style={{ textAlign: 'right' }}>
          {formatNumber(comment.length)} / {formatNumber(MAX_COMMENT)}
        </AppText>
        <Button
          title={t('reviews.post')}
          onPress={submit}
          loading={save.isPending}
          disabled={rating === 0}
        />
        {save.isError && (
          <AppText style={{ color: colors.danger }}>
            {errorMessage(save.error, t('common.error'))}
          </AppText>
        )}
      </View>
    </Modal>
  );
}

/** Rating summary, "Write a review" and the list, with your own review pinned first. */
export function ReviewsSection({ target }: { target: ReviewTarget }) {
  const { t } = useTranslation();
  const reviews = useReviews(target);
  const remove = useDeleteReview(target);
  const [writing, setWriting] = useState(false);

  function confirmDelete(review: Review) {
    Alert.alert(t('reviews.deleteTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('reviews.delete'), style: 'destructive', onPress: () => remove.mutate(review.id) },
    ]);
  }

  return (
    <Section title={t('reviews.title')}>
      <QueryState query={reviews}>
        {(page) => {
          const others = page.items.filter((r) => r.id !== page.mine?.id);
          return (
            <>
              <View style={styles.summary}>
                {page.rating.count > 0 ? (
                  <>
                    <AppText variant="title">{formatNumber(page.rating.score, 1)}</AppText>
                    <View style={{ gap: 2 }}>
                      <Stars value={page.rating.score} />
                      <AppText variant="caption" muted>
                        {t('reviews.count', {
                          count: page.rating.count,
                          value: formatNumber(page.rating.count),
                        })}
                      </AppText>
                    </View>
                  </>
                ) : (
                  <AppText muted>{t('reviews.none')}</AppText>
                )}
              </View>
              <Button
                title={page.mine ? t('reviews.edit') : t('reviews.write')}
                variant="secondary"
                icon={
                  <MaterialCommunityIcons
                    name="star-plus-outline"
                    size={20}
                    color={colors.primary}
                  />
                }
                onPress={() => setWriting(true)}
              />
              {page.mine && (
                <ReviewRow review={page.mine} onDelete={() => confirmDelete(page.mine!)} />
              )}
              {others.map((r) => (
                <ReviewRow key={r.id} review={r} />
              ))}
              {page.rating.count > 0 && (
                <AppText variant="caption" muted>
                  {t('reviews.bayesNote')}
                </AppText>
              )}
              {writing && (
                <WriteReviewSheet
                  target={target}
                  existing={page.mine}
                  onClose={() => setWriting(false)}
                />
              )}
            </>
          );
        }}
      </QueryState>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing(3.5),
    backgroundColor: colors.surface,
    borderRadius: 14,
    gap: spacing(1.5),
  },
  mine: { borderWidth: 1, borderColor: colors.primary },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  backdrop: { flex: 1, backgroundColor: '#0006' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing(4),
    gap: spacing(3),
  },
  input: {
    minHeight: 110,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing(3),
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});

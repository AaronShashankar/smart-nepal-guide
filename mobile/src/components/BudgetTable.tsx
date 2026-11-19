'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatNumber, npr } from '@/lib/format';
import type { Budget } from '@/lib/types';
import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

/** The budget lines and the total, in NPR (रु and Devanagari digits in Nepali). */
export function BudgetTable({ budget }: { budget: Budget }) {
  const { t } = useTranslation();
  const qty = (line: Budget['lines'][number]) => {
    if (line.code === 'FOOD' || line.code === 'STAY')
      return t('budget.perDay', { days: formatNumber(line.qty), rate: npr(line.rate) });
    if (line.code === 'TRANSPORT')
      return t('budget.perKm', { km: formatNumber(line.qty, 1), rate: formatNumber(line.rate) });
    return null;
  };

  return (
    <View style={styles.card}>
      {budget.lines.map((line, i) => (
        <View key={`${line.code}-${i}`} style={styles.row}>
          <View style={{ flex: 1 }}>
            <AppText>{line.label ?? t(`budget.code_${line.code}`)}</AppText>
            <AppText variant="caption" muted>
              {line.label ? t(`budget.code_${line.code}`) : qty(line)}
            </AppText>
          </View>
          <AppText>{npr(line.amount)}</AppText>
        </View>
      ))}
      <View style={[styles.row, styles.total]}>
        <AppText variant="subheading" style={{ flex: 1 }}>
          {t('budget.total')}
        </AppText>
        <AppText variant="subheading">{npr(budget.total_npr)}</AppText>
      </View>
      <AppText variant="caption" muted>
        {t('budget.basis', {
          level: t(`profile.budget_${budget.budget_level}`),
          nationality: t(`profile.nationality_${budget.nationality}`),
        })}
      </AppText>
      <AppText variant="caption" style={{ color: colors.warning }}>
        {t('budget.estimateOnly')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: 14,
    gap: spacing(2.5),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  total: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing(2.5),
  },
});

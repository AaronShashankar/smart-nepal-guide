'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatNumber, npr } from '@/lib/format';
import type { Budget } from '@/lib/types';
import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { ListCard, ListRow } from './Layout';

/** The budget lines and the total, in NPR (रु and Devanagari digits in Nepali). */
export function BudgetTable({ budget }: { budget: Budget }) {
  const { t } = useTranslation();
  const qty = (line: Budget['lines'][number]) => {
    if (line.code === 'FOOD' || line.code === 'STAY')
      return t('budget.perDay', { days: formatNumber(line.qty), rate: npr(line.rate) });
    if (line.code === 'TRANSPORT')
      return t('budget.perKm', { km: formatNumber(line.qty, 1), rate: formatNumber(line.rate) });
    return undefined;
  };

  return (
    <View style={{ gap: spacing(2) }}>
      <ListCard>
        {budget.lines.map((line, i) => (
          <ListRow
            key={`${line.code}-${i}`}
            label={line.label ?? t(`budget.code_${line.code}`)}
            sub={line.label ? t(`budget.code_${line.code}`) : qty(line)}
            value={npr(line.amount)}
          />
        ))}
        <ListRow
          last
          highlight
          label={t('budget.total')}
          sub={t('budget.basis', {
            level: t(`profile.budget_${budget.budget_level}`),
            nationality: t(`profile.nationality_${budget.nationality}`),
          })}
          value={npr(budget.total_npr)}
        />
      </ListCard>
      <AppText variant="small" weight="regular" style={{ color: colors.warning }}>
        {t('budget.estimateOnly')}
      </AppText>
    </View>
  );
}

import { Button, Group, NumberInput, Table, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader, QueryState } from '../components/ui';
import { numOrNull, withToast } from '../lib';
import { useBudgetRates, useSaveBudgetRate } from '../queries';
import type { BudgetRate } from '../types';

const LEVELS = ['low', 'medium', 'high'] as const;

function RateRow({ rate }: { rate: BudgetRate }) {
  const { t } = useTranslation();
  const save = useSaveBudgetRate();
  const [row, setRow] = useState(rate);
  const dirty = JSON.stringify(row) !== JSON.stringify(rate);
  const set = (patch: Partial<BudgetRate>) => setRow((r) => ({ ...r, ...patch }));
  const isCity = rate.region === 'city';

  return (
    <Table.Tr>
      <Table.Td>{rate.region}</Table.Td>
      <Table.Td>{t(`budget.${rate.budget_level}`)}</Table.Td>
      <Table.Td>
        <NumberInput
          size="xs"
          min={0}
          allowDecimal={false}
          thousandSeparator=","
          value={row.food_per_day_npr}
          onChange={(v) => set({ food_per_day_npr: numOrNull(v) ?? 0 })}
        />
      </Table.Td>
      <Table.Td>
        <NumberInput
          size="xs"
          min={0}
          allowDecimal={false}
          thousandSeparator=","
          value={row.stay_per_day_npr}
          onChange={(v) => set({ stay_per_day_npr: numOrNull(v) ?? 0 })}
        />
      </Table.Td>
      <Table.Td>
        {isCity ? (
          <NumberInput
            size="xs"
            min={0}
            decimalScale={1}
            value={row.transport_per_km_npr ?? ''}
            onChange={(v) => set({ transport_per_km_npr: numOrNull(v) })}
          />
        ) : (
          <Text c="dimmed">—</Text>
        )}
      </Table.Td>
      <Table.Td>
        {isCity ? (
          <Text c="dimmed">—</Text>
        ) : (
          <NumberInput
            size="xs"
            min={0}
            allowDecimal={false}
            thousandSeparator=","
            value={row.trailhead_transport_npr ?? ''}
            onChange={(v) => set({ trailhead_transport_npr: numOrNull(v) })}
          />
        )}
      </Table.Td>
      <Table.Td>
        <Button
          size="xs"
          disabled={!dirty}
          loading={save.isPending}
          onClick={() => withToast(save.mutateAsync(row))}
        >
          {t('common.save')}
        </Button>
      </Table.Td>
    </Table.Tr>
  );
}

export default function BudgetRates() {
  const { t } = useTranslation();
  const rates = useBudgetRates();
  const save = useSaveBudgetRate();
  const [region, setRegion] = useState('');

  /** A new trek region starts as a copy of the "other" rows; then edit the numbers. */
  async function addRegion(items: BudgetRate[]) {
    const name = region.trim();
    if (!name || items.some((r) => r.region === name)) return;
    const base = items.filter((r) => r.region === 'other');
    const ok = await withToast(
      Promise.all(
        LEVELS.map((level) => {
          const from = base.find((r) => r.budget_level === level);
          return save.mutateAsync({
            budget_level: level,
            region: name,
            food_per_day_npr: from?.food_per_day_npr ?? 0,
            stay_per_day_npr: from?.stay_per_day_npr ?? 0,
            transport_per_km_npr: null,
            trailhead_transport_npr: from?.trailhead_transport_npr ?? null,
          });
        }),
      ),
    );
    if (ok) setRegion('');
  }

  return (
    <>
      <PageHeader title={t('nav.budgetRates')} />
      <Text c="dimmed" mb="md">
        {t('budget.intro')}
      </Text>
      <QueryState query={rates}>
        {(items) => (
          <>
            <Table.ScrollContainer minWidth={860}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('budget.region')}</Table.Th>
                    <Table.Th>{t('budget.level')}</Table.Th>
                    <Table.Th>{t('budget.food')}</Table.Th>
                    <Table.Th>{t('budget.stay')}</Table.Th>
                    <Table.Th>{t('budget.perKm')}</Table.Th>
                    <Table.Th>{t('budget.trailhead')}</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((r) => (
                    <RateRow
                      key={`${r.region}-${r.budget_level}-${JSON.stringify(r)}`}
                      rate={r}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Group mt="md" align="end">
              <TextInput
                label={t('budget.newRegion')}
                placeholder="Dolpo"
                value={region}
                onChange={(e) => setRegion(e.currentTarget.value)}
              />
              <Button variant="light" onClick={() => addRegion(items)} loading={save.isPending}>
                {t('budget.newRegion')}
              </Button>
            </Group>
          </>
        )}
      </QueryState>
    </>
  );
}

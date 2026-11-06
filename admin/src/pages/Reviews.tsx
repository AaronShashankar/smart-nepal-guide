import { Badge, Button, SegmentedControl, Table, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader, QueryState } from '../components/ui';
import { formatDate, withToast } from '../lib';
import { useReviews, useSetReviewStatus } from '../queries';
import type { ReviewStatus } from '../types';

export default function Reviews() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | ReviewStatus>('all');
  const reviews = useReviews(filter === 'all' ? undefined : filter);
  const setStatus = useSetReviewStatus();

  return (
    <>
      <PageHeader
        title={t('nav.reviews')}
        right={
          <SegmentedControl
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            data={[
              { value: 'all', label: t('common.all') },
              { value: 'visible', label: t('reviews.visible') },
              { value: 'hidden', label: t('reviews.hidden') },
            ]}
          />
        }
      />
      <QueryState query={reviews}>
        {(items) =>
          items.length === 0 ? (
            <Text c="dimmed">{t('reviews.empty')}</Text>
          ) : (
            <Table.ScrollContainer minWidth={820}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('reviews.date')}</Table.Th>
                    <Table.Th>{t('reviews.user')}</Table.Th>
                    <Table.Th>{t('reviews.target')}</Table.Th>
                    <Table.Th>{t('reviews.rating')}</Table.Th>
                    <Table.Th>{t('reviews.comment')}</Table.Th>
                    <Table.Th>{t('reviews.status')}</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((r) => {
                    const next: ReviewStatus = r.status === 'visible' ? 'hidden' : 'visible';
                    return (
                      <Table.Tr key={r.id}>
                        <Table.Td>{formatDate(r.created_at)}</Table.Td>
                        <Table.Td>{r.user_email}</Table.Td>
                        <Table.Td>
                          {r.target_name}{' '}
                          <Text span size="xs" c="dimmed">
                            ({t(`reviews.${r.target_type}`)})
                          </Text>
                        </Table.Td>
                        <Table.Td aria-label={`${r.rating}/5`}>
                          {'★'.repeat(r.rating)}
                          <Text span c="gray.4">
                            {'★'.repeat(5 - r.rating)}
                          </Text>
                        </Table.Td>
                        <Table.Td maw={360}>{r.comment ?? '—'}</Table.Td>
                        <Table.Td>
                          <Badge color={r.status === 'visible' ? 'green' : 'gray'} variant="light">
                            {t(`reviews.${r.status}`)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            size="xs"
                            variant="light"
                            color={next === 'hidden' ? 'red' : 'green'}
                            loading={setStatus.isPending && setStatus.variables?.id === r.id}
                            onClick={() =>
                              withToast(setStatus.mutateAsync({ id: r.id, status: next }))
                            }
                          >
                            {next === 'hidden' ? t('reviews.hide') : t('reviews.show')}
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )
        }
      </QueryState>
    </>
  );
}

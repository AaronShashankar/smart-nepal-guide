import { Badge, Button, Table, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { PageHeader, QueryState } from '../components/ui';
import { formatDate } from '../lib';
import { useTreks } from '../queries';
import { LEVEL_COLORS } from '../types';

export default function Treks() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const treks = useTreks();

  return (
    <>
      <PageHeader
        title={t('nav.treks')}
        right={
          <Button component={Link} to="/treks/new">
            {t('treks.new')}
          </Button>
        }
      />
      <QueryState query={treks}>
        {(items) =>
          items.length === 0 ? (
            <Text c="dimmed">{t('common.none')}</Text>
          ) : (
            <Table.ScrollContainer minWidth={700}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('treks.name')}</Table.Th>
                    <Table.Th>{t('treks.region')}</Table.Th>
                    <Table.Th>{t('treks.days')}</Table.Th>
                    <Table.Th>{t('treks.maxAltitude')}</Table.Th>
                    <Table.Th>{t('treks.difficulty')}</Table.Th>
                    <Table.Th>{t('places.updated')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((tr) => (
                    <Table.Tr
                      key={tr.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/treks/${tr.id}`)}
                    >
                      <Table.Td>
                        <Text fw={500}>{tr.name_en}</Text>
                        {tr.name_ne && (
                          <Text size="xs" c="dimmed">
                            {tr.name_ne}
                          </Text>
                        )}
                        {!tr.is_published && <Badge color="gray">{t('common.draft')}</Badge>}
                      </Table.Td>
                      <Table.Td>{tr.region}</Table.Td>
                      <Table.Td>{tr.total_days}</Table.Td>
                      <Table.Td>{tr.max_altitude_m != null ? `${tr.max_altitude_m} m` : '—'}</Table.Td>
                      <Table.Td>
                        <Badge color={LEVEL_COLORS[tr.base_difficulty]}>
                          {t(`levels.${tr.base_difficulty}`)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{formatDate(tr.updated_at)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )
        }
      </QueryState>
    </>
  );
}

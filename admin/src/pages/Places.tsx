import { Badge, Button, Group, Pagination, Select, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { PageHeader, QueryState } from '../components/ui';
import { formatDate } from '../lib';
import { useCategories, usePlaces } from '../queries';

const PAGE_SIZE = 25;

export default function Places() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search, 300);
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const categories = useCategories();
  const places = usePlaces({ q: q || undefined, category: category ?? undefined, page });
  const ne = i18n.language.startsWith('ne');

  return (
    <>
      <PageHeader
        title={t('nav.places')}
        right={
          <Button component={Link} to="/places/new">
            {t('places.new')}
          </Button>
        }
      />
      <Group mb="md">
        <TextInput
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          w={280}
        />
        <Select
          placeholder={t('places.category')}
          clearable
          value={category}
          onChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
          data={(categories.data ?? []).map((c) => ({
            value: c.code,
            label: (ne && c.name_ne) || c.name_en,
          }))}
          w={220}
        />
      </Group>
      <QueryState query={places}>
        {(data) => (
          <>
            <Table.ScrollContainer minWidth={760}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('places.name')}</Table.Th>
                    <Table.Th>{t('places.category')}</Table.Th>
                    <Table.Th>{t('places.district')}</Table.Th>
                    <Table.Th>{t('places.altitude')}</Table.Th>
                    <Table.Th>{t('places.photoCount')}</Table.Th>
                    <Table.Th />
                    <Table.Th>{t('places.updated')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.items.map((p) => (
                    <Table.Tr
                      key={p.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/places/${p.id}`)}
                    >
                      <Table.Td>
                        <Text fw={500}>{p.name_en}</Text>
                        {p.name_ne && (
                          <Text size="xs" c="dimmed">
                            {p.name_ne}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{p.category_code}</Table.Td>
                      <Table.Td>{p.district ?? '—'}</Table.Td>
                      <Table.Td>{p.altitude_m ?? '—'}</Table.Td>
                      <Table.Td>{p.photo_count}</Table.Td>
                      <Table.Td>
                        {!p.is_published && <Badge color="gray">{t('common.draft')}</Badge>}
                      </Table.Td>
                      <Table.Td>{formatDate(p.updated_at)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {data.items.length === 0 && <Text c="dimmed">{t('common.none')}</Text>}
            <Group justify="space-between" mt="md">
              <Text size="sm" c="dimmed">
                {t('common.total', { count: data.total })}
              </Text>
              <Pagination
                total={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
                value={page}
                onChange={setPage}
              />
            </Group>
          </>
        )}
      </QueryState>
    </>
  );
}

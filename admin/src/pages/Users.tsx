import { Badge, Button, Group, Pagination, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth';
import { PageHeader, QueryState } from '../components/ui';
import { formatDate, withToast } from '../lib';
import { useSetBlocked, useUsers } from '../queries';
import type { UserRow } from '../types';

const PAGE_SIZE = 25;

export default function Users() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const users = useUsers({ q: q || undefined, page });
  const setBlocked = useSetBlocked();

  function toggle(u: UserRow) {
    if (!u.is_blocked && !window.confirm(t('users.confirmBlock', { email: u.email }))) return;
    withToast(setBlocked.mutateAsync({ id: u.id, blocked: !u.is_blocked }));
  }

  return (
    <>
      <PageHeader title={t('nav.users')} />
      <TextInput
        mb="md"
        w={320}
        placeholder={t('common.search')}
        value={search}
        onChange={(e) => {
          setSearch(e.currentTarget.value);
          setPage(1);
        }}
      />
      <QueryState query={users}>
        {(data) => (
          <>
            <Table.ScrollContainer minWidth={860}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('email')}</Table.Th>
                    <Table.Th>{t('users.name')}</Table.Th>
                    <Table.Th>{t('users.role')}</Table.Th>
                    <Table.Th>{t('users.provider')}</Table.Th>
                    <Table.Th>{t('users.joined')}</Table.Th>
                    <Table.Th>{t('users.predictions')}</Table.Th>
                    <Table.Th>{t('users.trips')}</Table.Th>
                    <Table.Th>{t('users.status')}</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.items.map((u) => (
                    <Table.Tr key={u.id}>
                      <Table.Td>{u.email}</Table.Td>
                      <Table.Td>{u.full_name ?? '—'}</Table.Td>
                      <Table.Td>
                        {u.role === 'admin' ? <Badge variant="light">admin</Badge> : u.role}
                      </Table.Td>
                      <Table.Td>{u.auth_provider}</Table.Td>
                      <Table.Td>{formatDate(u.created_at)}</Table.Td>
                      <Table.Td>{u.prediction_count}</Table.Td>
                      <Table.Td>{u.trip_count}</Table.Td>
                      <Table.Td>
                        <Badge color={u.is_blocked ? 'red' : 'green'} variant="light">
                          {u.is_blocked ? t('users.blocked') : t('users.active')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {u.id !== me?.id && (
                          <Button
                            size="xs"
                            variant="light"
                            color={u.is_blocked ? 'green' : 'red'}
                            loading={setBlocked.isPending && setBlocked.variables?.id === u.id}
                            onClick={() => toggle(u)}
                          >
                            {u.is_blocked ? t('users.unblock') : t('users.block')}
                          </Button>
                        )}
                      </Table.Td>
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

import { Alert, Center, Group, Loader, Title } from '@mantine/core';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { errorMessage } from '../api';
import i18n from '../i18n';

export function PageHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <Group justify="space-between" mb="md" wrap="wrap">
      <Title order={2}>{title}</Title>
      {right}
    </Group>
  );
}

/** Loading spinner / error box / content. */
export function QueryState<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }
  if (query.isError) {
    return (
      <Alert color="red" title={i18n.t('common.error')}>
        {errorMessage(query.error, i18n.t('common.error'))}
      </Alert>
    );
  }
  return <>{children(query.data)}</>;
}

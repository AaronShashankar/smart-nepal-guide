import { Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth';
import { PageHeader, QueryState } from '../components/ui';
import { useStats } from '../queries';
import { LEVEL_COLORS, RISK_LEVELS } from '../types';

function StatCard({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <Paper withBorder p="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fz={28} fw={600}>
        {value.toLocaleString()}
      </Text>
      {note && (
        <Text size="xs" c="dimmed">
          {note}
        </Text>
      )}
    </Paper>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const stats = useStats();

  return (
    <>
      <PageHeader title={t('welcome', { name: me?.full_name ?? me?.email })} />
      <QueryState query={stats}>
        {(s) => {
          const max = Math.max(1, ...RISK_LEVELS.map((l) => s.predictions_by_level[l] ?? 0));
          return (
            <Stack>
              <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
                <StatCard
                  label={t('dashboard.users')}
                  value={s.users}
                  note={s.blocked_users ? t('dashboard.blocked', { count: s.blocked_users }) : undefined}
                />
                <StatCard label={t('dashboard.places')} value={s.places} />
                <StatCard label={t('dashboard.treks')} value={s.treks} />
                <StatCard label={t('dashboard.trips')} value={s.trips} />
                <StatCard label={t('dashboard.reviews')} value={s.reviews} />
                <StatCard label={t('dashboard.predictions')} value={s.risk_predictions} />
              </SimpleGrid>

              <Paper withBorder p="md" maw={640}>
                <Title order={4} mb="sm">
                  {t('dashboard.byLevel')}
                </Title>
                {s.risk_predictions === 0 ? (
                  <Text c="dimmed">{t('dashboard.noPredictions')}</Text>
                ) : (
                  <Stack gap="xs">
                    {RISK_LEVELS.map((level) => {
                      const n = s.predictions_by_level[level] ?? 0;
                      return (
                        <Group key={level} wrap="nowrap" gap="sm">
                          <Text w={100} size="sm">
                            {t(`levels.${level}`)}
                          </Text>
                          <div
                            className="bar"
                            style={{
                              width: `${(n / max) * 100}%`,
                              maxWidth: 'calc(100% - 160px)',
                              background: LEVEL_COLORS[level],
                            }}
                          />
                          <Text size="sm" fw={600}>
                            {n}
                          </Text>
                        </Group>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            </Stack>
          );
        }}
      </QueryState>
    </>
  );
}

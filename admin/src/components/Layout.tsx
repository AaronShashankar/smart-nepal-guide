import { AppShell, Burger, Button, Group, NavLink, SegmentedControl, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { NavLink as RouterLink, Outlet } from 'react-router';

import { useAuth } from '../auth';

const LINKS = [
  { to: '/', key: 'dashboard', end: true },
  { to: '/places', key: 'places' },
  { to: '/treks', key: 'treks' },
  { to: '/categories', key: 'categories' },
  { to: '/permits', key: 'permits' },
  { to: '/users', key: 'users' },
  { to: '/reviews', key: 'reviews' },
] as const;

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { me, logout } = useAuth();
  const [opened, { toggle, close }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4} c="crimson.7">
              {t('title')}
            </Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Text size="sm" c="dimmed" visibleFrom="md">
              {me?.full_name ?? me?.email}
            </Text>
            <SegmentedControl
              size="xs"
              aria-label={t('language')}
              value={i18n.language.startsWith('ne') ? 'ne' : 'en'}
              onChange={(v) => i18n.changeLanguage(v)}
              data={[
                { value: 'en', label: 'EN' },
                { value: 'ne', label: 'ने' },
              ]}
            />
            <Button size="xs" variant="light" onClick={logout}>
              {t('logout')}
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            component={RouterLink}
            to={l.to}
            end={'end' in l ? l.end : undefined}
            label={t(`nav.${l.key}`)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

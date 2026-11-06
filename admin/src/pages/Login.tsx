import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';

import { errorMessage, NotAdminError } from '../api';
import { useAuth } from '../auth';

export default function Login() {
  const { t } = useTranslation();
  const { me, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (me) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof NotAdminError ? t('notAdmin') : errorMessage(err, t('loginFailed')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder p="xl" w={380} maw="100%" component="form" onSubmit={submit}>
        <Stack>
          <Title order={3} c="crimson.7">
            {t('title')}
          </Title>
          <TextInput
            label={t('email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
            autoComplete="email"
          />
          <PasswordInput
            label={t('password')}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            autoComplete="current-password"
          />
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          <Button type="submit" loading={busy}>
            {t('login')}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}

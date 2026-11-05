import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { api, errorMessage } from '@/lib/api';
import type { Tokens } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { currentLang } from '@/store/settings';
import { colors } from '@/theme';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const setTokens = useAuth((s) => s.setTokens);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register() {
    if (!email || !password) return setError(t('auth.fillAll'));
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<Tokens>('/auth/register', {
        email: email.trim(),
        password,
        full_name: fullName.trim() || null,
        preferred_lang: currentLang(),
      });
      await setTokens(data);
      router.replace('/profile'); // demo step 2: fill in the profile
    } catch (e) {
      setError(errorMessage(e, t('auth.registerFailed')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={[]}>
      <TextField
        label={t('auth.fullName')}
        value={fullName}
        onChangeText={setFullName}
        autoComplete="name"
      />
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextField
        label={t('auth.password')}
        hint={t('auth.passwordHint')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {error && <AppText style={{ color: colors.danger }}>{error}</AppText>}
      <Button title={t('auth.register')} onPress={register} loading={busy} />
      <Button title={t('auth.haveAccount')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

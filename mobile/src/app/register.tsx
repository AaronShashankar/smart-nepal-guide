import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/Layout';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { api, errorMessage } from '@/lib/api';
import type { Tokens } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { currentLang } from '@/store/settings';
import { colors, radii, spacing } from '@/theme';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const setTokens = useAuth((s) => s.setTokens);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  async function register() {
    if (!email || !password) return setError(t('auth.fillAll'));
    if (password.length < 8) return setError(t('auth.passwordTooShort')); // same rule as the API
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
    <Screen avoidKeyboard>
      <PageHeader title={t('auth.register')} subtitle="Bato · बाटो" />
      <View style={styles.card}>
        <TextField
          label={t('auth.fullName')}
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          placeholder={t('auth.fullNamePlaceholder')}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <TextField
          ref={emailRef}
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder={t('auth.emailPlaceholder')}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder={t('auth.newPasswordPlaceholder')}
          returnKeyType="go"
          onSubmitEditing={register}
        />
        {error && <AppText style={{ color: colors.danger }}>{error}</AppText>}
        <Button title={t('auth.register')} onPress={register} loading={busy} />
      </View>
      <Button title={t('auth.haveAccount')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing(4),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    gap: spacing(4),
  },
});

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { api, errorMessage } from '@/lib/api';
import { getGoogleIdToken, googleConfigured } from '@/lib/google';
import type { Tokens } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { currentLang } from '@/store/settings';
import { colors, spacing } from '@/theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const setTokens = useAuth((s) => s.setTokens);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    if (!email || !password) return setError(t('auth.fillAll'));
    setBusy('email');
    setError(null);
    try {
      const { data } = await api.post<Tokens>('/auth/login', { email: email.trim(), password });
      await setTokens(data); // the root layout now shows the app
    } catch (e) {
      setError(errorMessage(e, t('auth.loginFailed')));
    } finally {
      setBusy(null);
    }
  }

  async function google() {
    if (!googleConfigured) return setError(t('auth.googleNotConfigured'));
    setBusy('google');
    setError(null);
    try {
      const idToken = await getGoogleIdToken();
      if (idToken) {
        const { data } = await api.post<Tokens>('/auth/google', {
          id_token: idToken,
          preferred_lang: currentLang(),
        });
        await setTokens(data);
      }
    } catch (e) {
      setError(errorMessage(e, t('auth.googleFailed')));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.brand}>
        <MaterialCommunityIcons name="image-filter-hdr" size={48} color={colors.primary} />
        <AppText variant="title">{t('auth.welcome')}</AppText>
        <AppText muted>{t('auth.tagline')}</AppText>
      </View>

      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={login}
      />
      {error && (
        <AppText style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      )}
      <Button
        title={t('auth.login')}
        onPress={login}
        loading={busy === 'email'}
        disabled={!!busy}
      />

      <AppText muted style={{ textAlign: 'center' }}>
        {t('auth.or')}
      </AppText>
      <Button
        title={t('auth.google')}
        variant="secondary"
        onPress={google}
        loading={busy === 'google'}
        disabled={!!busy}
        icon={<MaterialCommunityIcons name="google" size={20} color={colors.primary} />}
      />

      <Link href="/register" style={styles.link}>
        <AppText style={{ color: colors.accent }}>{t('auth.noAccount')}</AppText>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing(4) },
  brand: { alignItems: 'center', gap: spacing(1), marginBottom: spacing(4) },
  link: { alignSelf: 'center', padding: spacing(2) },
});

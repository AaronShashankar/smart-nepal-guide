import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { GoogleG, WelcomeBackdrop, welcomeStyles } from '@/components/Welcome';
import { api, errorMessage } from '@/lib/api';
import { getGoogleIdToken, googleConfigured } from '@/lib/google';
import type { Lang, Tokens } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { currentLang, useSettings } from '@/store/settings';
import { colors, radii, spacing } from '@/theme';

/** Welcome & sign in: photo, language switch, Google, create account, or log in with email. */
export default function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const setTokens = useAuth((s) => s.setTokens);
  const language = useSettings((s) => s.language) ?? 'en';
  const setLanguage = useSettings((s) => s.setLanguage);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  async function login() {
    if (!email || !password) return setError(t('auth.fillAll'));
    setBusy('email');
    setError(null);
    try {
      const { data } = await api.post<Tokens>('/auth/login', { email: email.trim(), password });
      setFormOpen(false);
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
    <WelcomeBackdrop>
      <View style={{ gap: spacing(3) }}>
        <AppText variant="display" style={welcomeStyles.title} accessibilityRole="header">
          {t('auth.headline')}
        </AppText>
        <AppText style={welcomeStyles.body}>{t('auth.pitch')}</AppText>
      </View>

      <Segmented<Lang>
        dark
        value={language}
        onChange={(lang) => setLanguage(lang)}
        options={[
          { value: 'en', label: 'English' },
          { value: 'ne', label: 'नेपाली' },
        ]}
      />

      <View style={{ gap: 10 }}>
        {error && !formOpen && (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <AppText variant="caption" weight="semibold" style={{ color: '#FFFFFF' }}>
              {error}
            </AppText>
          </View>
        )}
        <Button
          title={t('auth.google')}
          variant="light"
          icon={<GoogleG />}
          onPress={google}
          loading={busy === 'google'}
          disabled={!!busy}
        />
        <Button
          title={t('auth.createAccount')}
          onPress={() => router.push('/register')}
          disabled={!!busy}
        />
        <View style={styles.haveAccount}>
          <AppText
            variant="label"
            weight="regular"
            style={{ color: 'rgba(255,255,255,0.78)', fontSize: 15 }}
          >
            {t('auth.haveAccountQ')}
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setError(null);
              setFormOpen(true);
            }}
            hitSlop={12}
          >
            <AppText variant="label" style={styles.loginLink}>
              {t('auth.login')}
            </AppText>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFormOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setFormOpen(false)}
          accessibilityLabel={t('common.cancel')}
        />
        {/* Android apps are edge-to-edge, so the window no longer shrinks for the keyboard: without
            a behavior on both platforms the keyboard covered the whole form (V2-UI-02). */}
        <KeyboardAvoidingView behavior="padding">
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(5) }]}>
            <View style={styles.grabber} />
            <AppText variant="title">{t('auth.loginTitle')}</AppText>
            <TextField
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
              placeholder={t('auth.passwordPlaceholder')}
              returnKeyType="go"
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </WelcomeBackdrop>
  );
}

const styles = StyleSheet.create({
  haveAccount: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingTop: 4,
    minHeight: 44,
  },
  loginLink: { color: '#FFFFFF', fontSize: 15, textDecorationLine: 'underline' },
  error: { padding: spacing(3), borderRadius: 14, backgroundColor: 'rgba(185,28,28,0.92)' },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,16,31,0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    padding: spacing(5),
    paddingTop: spacing(3),
    gap: spacing(4),
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
});

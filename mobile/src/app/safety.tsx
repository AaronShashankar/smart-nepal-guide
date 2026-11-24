import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Section } from '@/components/Cards';
import { ListCard, PageHeader } from '@/components/Layout';
import {
  CallRow,
  EmergencyNumbers,
  SafetyDisclaimer,
  SosButton,
  SosStatus,
  useSos,
} from '@/components/Safety';
import { Screen } from '@/components/Screen';
import { useEmergencyContacts } from '@/lib/queries';
import { cachedContacts } from '@/lib/safety';
import type { EmergencyContact } from '@/lib/types';
import { colors, spacing } from '@/theme';

/** SOS & emergency numbers (V2-P3-01, V2-P3-02). Everything on this screen works offline. */
export default function SafetyScreen() {
  const { t } = useTranslation();
  const sos = useSos();
  const online = useEmergencyContacts();
  // The server's list when it loads, else the copy on the phone (offline).
  const [saved, setSaved] = useState<EmergencyContact[]>([]);
  useFocusEffect(
    useCallback(() => {
      cachedContacts().then(setSaved);
    }, []),
  );
  const contacts = online.data ?? saved;

  return (
    <Screen>
      <PageHeader title={t('safety.openSafety')} subtitle={t('safety.title')} />
      <SafetyDisclaimer />

      <View style={styles.sos}>
        <SosButton onTrigger={sos.trigger} busy={sos.busy} />
        <AppText variant="caption" muted style={styles.center}>
          {t('safety.holdHint')}
        </AppText>
      </View>
      <SosStatus state={sos.state} />

      <Section title={t('safety.contactsTitle')}>
        {contacts.length === 0 ? (
          <AppText muted>{t('safety.contactsEmpty')}</AppText>
        ) : (
          <ListCard>
            {contacts.map((c, i) => (
              <CallRow
                key={c.id}
                name={c.name}
                note={c.relation}
                phone={c.phone}
                icon="account-heart-outline"
                last={i === contacts.length - 1}
              />
            ))}
          </ListCard>
        )}
        <Button
          title={contacts.length === 0 ? t('safety.addContact') : t('safety.manageContacts')}
          variant="secondary"
          icon="account-plus-outline"
          onPress={() => router.push('/emergency-contacts')}
        />
      </Section>

      <Section title={t('safety.numbersTitle')}>
        <EmergencyNumbers />
      </Section>

      <Button
        title={t('safety.feel')}
        variant="dark"
        icon="heart-pulse"
        onPress={() => router.push('/symptoms')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sos: { alignItems: 'center', gap: spacing(3), paddingVertical: spacing(2) },
  center: { textAlign: 'center', maxWidth: 280, color: colors.textMuted },
});

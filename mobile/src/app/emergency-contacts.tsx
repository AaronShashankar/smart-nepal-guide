import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Section } from '@/components/Cards';
import { ListCard, PageHeader } from '@/components/Layout';
import { EmergencyNumbers, SafetyDisclaimer } from '@/components/Safety';
import { Screen } from '@/components/Screen';
import { QueryState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/api';
import { useDeleteContact, useEmergencyContacts, useSaveContact } from '@/lib/queries';
import type { EmergencyContact, EmergencyContactInput } from '@/lib/types';
import { colors, spacing } from '@/theme';

const MAX_CONTACTS = 5;
const EMPTY: EmergencyContactInput = { name: '', phone: '', email: null, relation: null };

function ContactForm({
  editing,
  onDone,
}: {
  editing: EmergencyContact | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveContact();
  const [form, setForm] = useState<EmergencyContactInput>(
    editing
      ? {
          name: editing.name,
          phone: editing.phone,
          email: editing.email,
          relation: editing.relation,
        }
      : EMPTY,
  );
  const [message, setMessage] = useState<string | null>(null);
  const phoneRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const relationRef = useRef<TextInputInstance>(null);

  const set = (key: keyof EmergencyContactInput, value: string) =>
    setForm((f) => ({
      ...f,
      [key]: key === 'email' || key === 'relation' ? value || null : value,
    }));

  async function submit() {
    setMessage(null);
    if (!form.name.trim() || !form.phone.trim()) {
      setMessage(t('safety.nameAndPhone'));
      return;
    }
    try {
      await save.mutateAsync({ id: editing?.id, body: form });
      setForm(EMPTY);
      setMessage(t('safety.saved'));
      onDone();
    } catch (e) {
      setMessage(errorMessage(e, t('common.error')));
    }
  }

  return (
    <View style={styles.form}>
      <AppText variant="subheading">
        {editing ? t('safety.editContact') : t('safety.addContact')}
      </AppText>
      <TextField
        label={t('safety.name')}
        placeholder={t('safety.namePlaceholder')}
        value={form.name}
        onChangeText={(v) => set('name', v)}
        autoCapitalize="words"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => phoneRef.current?.focus()}
      />
      <TextField
        ref={phoneRef}
        label={t('safety.phone')}
        placeholder={t('safety.phonePlaceholder')}
        hint={t('safety.phoneHint')}
        value={form.phone}
        onChangeText={(v) => set('phone', v)}
        keyboardType="phone-pad"
        autoComplete="tel"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label={t('safety.email')}
        placeholder={t('safety.emailPlaceholder')}
        value={form.email ?? ''}
        onChangeText={(v) => set('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => relationRef.current?.focus()}
      />
      <TextField
        ref={relationRef}
        label={t('safety.relation')}
        placeholder={t('safety.relationPlaceholder')}
        value={form.relation ?? ''}
        onChangeText={(v) => set('relation', v)}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {message && <AppText accessibilityLiveRegion="polite">{message}</AppText>}
      <Button title={t('safety.saveContact')} onPress={submit} loading={save.isPending} />
      {editing && <Button title={t('safety.cancelEdit')} variant="ghost" onPress={onDone} />}
    </View>
  );
}

function ContactRow({
  contact,
  last,
  onEdit,
}: {
  contact: EmergencyContact;
  last: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteContact();
  function confirmDelete() {
    Alert.alert(t('safety.deleteTitle', { name: contact.name }), t('safety.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('safety.delete'), style: 'destructive', onPress: () => remove.mutate(contact.id) },
    ]);
  }
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('safety.editContact')}: ${contact.name}`}
        onPress={onEdit}
        style={({ pressed }) => [{ flex: 1, gap: 2 }, pressed && { opacity: 0.7 }]}
      >
        <AppText variant="label" weight="semibold">
          {contact.name}
          {contact.relation ? ` · ${contact.relation}` : ''}
        </AppText>
        <AppText variant="caption" muted>
          {contact.phone}
          {contact.email ? ` · ${contact.email}` : ''}
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('safety.delete')}: ${contact.name}`}
        onPress={confirmDelete}
        hitSlop={8}
        style={({ pressed }) => [styles.delete, pressed && { opacity: 0.6 }]}
      >
        <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.danger} />
      </Pressable>
    </View>
  );
}

/** Settings → Emergency contacts (V2-P3-01): up to 5 people who get the SOS message. */
export default function EmergencyContactsScreen() {
  const { t } = useTranslation();
  const contacts = useEmergencyContacts();
  const [editing, setEditing] = useState<EmergencyContact | null>(null);

  return (
    <Screen avoidKeyboard>
      <PageHeader title={t('settings.contacts')} subtitle={t('safety.title')} />
      <SafetyDisclaimer />
      <QueryState query={contacts}>
        {(list) => (
          <>
            <Section title={t('safety.contactsTitle')}>
              {list.length === 0 ? (
                <AppText muted>{t('safety.contactsEmpty')}</AppText>
              ) : (
                <ListCard>
                  {list.map((c, i) => (
                    <ContactRow
                      key={c.id}
                      contact={c}
                      last={i === list.length - 1}
                      onEdit={() => setEditing(c)}
                    />
                  ))}
                </ListCard>
              )}
              <AppText variant="small" weight="regular" muted>
                {t('safety.contactsOffline')}
              </AppText>
            </Section>

            {editing || list.length < MAX_CONTACTS ? (
              <ContactForm
                key={editing?.id ?? 'new'}
                editing={editing}
                onDone={() => setEditing(null)}
              />
            ) : (
              <AppText muted>{t('safety.maxContacts')}</AppText>
            )}
          </>
        )}
      </QueryState>

      <Section title={t('safety.numbersTitle')}>
        <EmergencyNumbers />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing(3),
    padding: spacing(4),
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    minHeight: 60,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  delete: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

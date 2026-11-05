import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Section } from '@/components/Cards';
import { Chip, ChipGroup } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { QueryState } from '@/components/StateViews';
import { errorMessage } from '@/lib/api';
import { useInterests, useMe, useProfile, useSaveProfile } from '@/lib/queries';
import type {
  BudgetLevel,
  FitnessLevel,
  Profile,
  ProfileInput,
  TravelStyle,
  TrekExperience,
} from '@/lib/types';
import { colors, fonts, spacing } from '@/theme';

const toInput = (p: Profile): ProfileInput => ({ ...p, interests: p.interests.map((i) => i.code) });
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Yes / No / Prefer not to say -> true / false / null */
function YesNo({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const { t } = useTranslation();
  const current = value === null ? 'skip' : value ? 'yes' : 'no';
  return (
    <View style={styles.wrap}>
      <ChipGroup
        allowClear={false}
        options={[
          { value: 'yes', label: t('common.yes') },
          { value: 'no', label: t('common.no') },
          { value: 'skip', label: t('common.notSay') },
        ]}
        value={current}
        onChange={(v) => onChange(v === 'skip' ? null : v === 'yes')}
      />
    </View>
  );
}

function ProfileForm({ initial, isNew }: { initial: ProfileInput; isNew: boolean }) {
  const { t } = useTranslation();
  const interests = useInterests();
  const save = useSaveProfile();
  const [form, setForm] = useState<ProfileInput>(initial);
  const [showPicker, setShowPicker] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const options = <T extends string>(prefix: string, values: T[]) =>
    values.map((v) => ({ value: v, label: t(`profile.${prefix}_${v}`) }));

  async function submit() {
    setMessage(null);
    try {
      await save.mutateAsync(form);
      if (isNew) router.replace('/');
      else setMessage(t('profile.saved'));
    } catch (e) {
      setMessage(errorMessage(e, t('profile.saveFailed')));
    }
  }

  const dob = form.date_of_birth
    ? new Date(`${form.date_of_birth}T00:00:00`)
    : new Date(1995, 0, 1);

  return (
    <>
      <AppText muted>{t('profile.intro')}</AppText>

      <Section title={t('profile.dob')}>
        <Pressable
          style={styles.dateButton}
          onPress={() => setShowPicker(true)}
          accessibilityRole="button"
        >
          <AppText style={{ fontFamily: fonts.medium }}>
            {form.date_of_birth ?? t('profile.pickDate')}
          </AppText>
        </Pressable>
        {showPicker && (
          <DateTimePicker
            value={dob}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            minimumDate={new Date(1920, 0, 1)}
            onValueChange={(_, date) => {
              setShowPicker(Platform.OS === 'ios');
              set('date_of_birth', isoDate(date));
            }}
            onDismiss={() => setShowPicker(false)}
          />
        )}
      </Section>

      <Section title={t('profile.fitness')}>
        <View style={styles.wrap}>
          <ChipGroup
            options={options<FitnessLevel>('fitness', ['low', 'medium', 'high'])}
            value={form.fitness_level}
            onChange={(v) => set('fitness_level', v)}
          />
        </View>
      </Section>

      <Section title={t('profile.experience')}>
        <View style={styles.wrap}>
          <ChipGroup
            options={options<TrekExperience>('experience', ['none', 'beginner', 'experienced'])}
            value={form.trek_experience}
            onChange={(v) => set('trek_experience', v)}
          />
        </View>
      </Section>

      <Section title={t('profile.health')}>
        <View style={styles.why}>
          <AppText variant="caption">{t('profile.healthWhy')}</AppText>
        </View>
        <AppText variant="label">{t('profile.heart')}</AppText>
        <YesNo value={form.has_heart_condition} onChange={(v) => set('has_heart_condition', v)} />
        <AppText variant="label">{t('profile.asthma')}</AppText>
        <YesNo value={form.has_asthma} onChange={(v) => set('has_asthma', v)} />
      </Section>

      <Section title={t('profile.budget')}>
        <View style={styles.wrap}>
          <ChipGroup
            options={options<BudgetLevel>('budget', ['low', 'medium', 'high'])}
            value={form.budget_level}
            onChange={(v) => set('budget_level', v)}
          />
        </View>
      </Section>

      <Section title={t('profile.style')}>
        <View style={styles.wrap}>
          <ChipGroup
            options={options<TravelStyle>('style', ['solo', 'family', 'group'])}
            value={form.travel_style}
            onChange={(v) => set('travel_style', v)}
          />
        </View>
      </Section>

      <Section title={t('profile.interests')}>
        <View style={styles.wrap}>
          {interests.data?.map((i) => {
            const selected = form.interests.includes(i.code);
            return (
              <Chip
                key={i.code}
                label={i.name}
                selected={selected}
                onPress={() =>
                  set(
                    'interests',
                    selected
                      ? form.interests.filter((c) => c !== i.code)
                      : [...form.interests, i.code],
                  )
                }
              />
            );
          })}
        </View>
      </Section>

      {message && <AppText accessibilityLiveRegion="polite">{message}</AppText>}
      <Button title={t('common.save')} onPress={submit} loading={save.isPending} />
      {isNew && (
        <Button title={t('common.skip')} variant="ghost" onPress={() => router.replace('/')} />
      )}
    </>
  );
}

export default function ProfileScreen() {
  const profile = useProfile();
  const me = useMe();
  return (
    <Screen edges={[]}>
      <QueryState query={profile}>
        {(p) => <ProfileForm initial={toInput(p)} isNew={me.data?.has_profile === false} />}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  dateButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  why: { padding: spacing(3), borderRadius: 12, backgroundColor: '#E8EEF8' },
});

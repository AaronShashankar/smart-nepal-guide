'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button, IconButton } from '@/components/Button';
import { Section } from '@/components/Cards';
import { Chip } from '@/components/Chip';
import { ListCard, PageHeader } from '@/components/Layout';
import { EmergencyNumbers, RESULT_ICON, RESULT_TINT, SafetyDisclaimer } from '@/components/Safety';
import { Screen } from '@/components/Screen';
import { formatNumber, meters } from '@/lib/format';
import {
  type Answers,
  type LakeLouiseScore,
  RED_FLAGS,
  type RedFlag,
  scoreLakeLouise,
  SYMPTOMS,
  type Symptom,
} from '@/lib/lakeLouise';
import { useItinerary, useTrek } from '@/lib/queries';
import { enqueue, flushOutbox, inOutbox, locate, newId } from '@/lib/safety';
import { colors, radii, spacing, statusTints } from '@/theme';

const LEVELS = [0, 1, 2, 3] as const;

/** One question: the four official Lake Louise answers as a radio list. */
function Question({
  symptom,
  value,
  onChange,
}: {
  symptom: Symptom;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <Section title={t(`safety.symptom_${symptom}`)}>
      <ListCard>
        {LEVELS.map((level) => {
          const on = value === level;
          return (
            <Pressable
              key={level}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(level)}
              style={({ pressed }) => [
                styles.option,
                level < 3 && styles.divider,
                on && styles.optionOn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialCommunityIcons
                name={on ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={on ? colors.primary : colors.iconMuted}
              />
              <AppText variant="label" weight={on ? 'bold' : 'regular'} style={{ flex: 1 }}>
                {t(`safety.answer_${symptom}_${level}`)}
              </AppText>
              <AppText variant="caption" weight="bold" muted>
                {formatNumber(level)}
              </AppText>
            </Pressable>
          );
        })}
      </ListCard>
    </Section>
  );
}

function RedFlags({ value, onChange }: { value: RedFlag[]; onChange: (v: RedFlag[]) => void }) {
  const { t } = useTranslation();
  return (
    <Section title={t('safety.flagsTitle')}>
      <AppText variant="caption" muted>
        {t('safety.flagsHint')}
      </AppText>
      <ListCard>
        {RED_FLAGS.map((flag, i) => {
          const on = value.includes(flag);
          return (
            <Pressable
              key={flag}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(on ? value.filter((f) => f !== flag) : [...value, flag])}
              style={({ pressed }) => [
                styles.option,
                i < RED_FLAGS.length - 1 && styles.divider,
                on && { backgroundColor: statusTints.danger.bg },
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialCommunityIcons
                name={on ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={on ? colors.danger : colors.iconMuted}
              />
              <AppText variant="label" weight={on ? 'bold' : 'regular'} style={{ flex: 1 }}>
                {t(`safety.flag_${flag}`)}
              </AppText>
            </Pressable>
          );
        })}
      </ListCard>
    </Section>
  );
}

/** Today's altitude: one of the trek's stops, or the phone's GPS altitude. Optional. */
function WhereAreYou({
  trekId,
  altitude,
  onChange,
}: {
  trekId?: string;
  altitude: number | null;
  onChange: (m: number | null) => void;
}) {
  const { t } = useTranslation();
  const itinerary = useItinerary(trekId);
  const [gps, setGps] = useState<'idle' | 'busy' | 'none'>('idle');
  const stops = new Map<string, { name: string; altitude: number }>();
  for (const s of itinerary.data?.stages ?? []) {
    stops.set(s.to_place.id, { name: s.to_place.name, altitude: s.sleep_altitude_m });
  }

  async function readGps() {
    setGps('busy');
    const fix = await locate();
    if (fix?.altitudeM != null) {
      onChange(fix.altitudeM);
      setGps('idle');
    } else {
      setGps('none');
    }
  }

  return (
    <Section title={t('safety.whereTitle')}>
      <AppText variant="caption" muted>
        {t('safety.whereHint')}
      </AppText>
      {stops.size > 0 && (
        <View style={styles.wrap}>
          {[...stops].map(([placeId, s]) => (
            <Chip
              key={placeId}
              label={`${s.name} · ${meters(s.altitude)}`}
              selected={altitude === s.altitude}
              onPress={() => onChange(altitude === s.altitude ? null : s.altitude)}
            />
          ))}
        </View>
      )}
      <Button
        compact
        variant="secondary"
        icon="crosshairs-gps"
        title={t('safety.useGps')}
        loading={gps === 'busy'}
        onPress={readGps}
      />
      {altitude != null && ![...stops.values()].some((s) => s.altitude === altitude) && (
        <AppText variant="label">{t('safety.gpsAltitude', { altitude: meters(altitude) })}</AppText>
      )}
      {gps === 'none' && (
        <AppText variant="caption" style={{ color: colors.warning }}>
          {t('safety.gpsNone')}
        </AppText>
      )}
    </Section>
  );
}

/** The big coloured result, why, and what to do. */
function Result({
  score,
  saved,
  onAgain,
}: {
  score: LakeLouiseScore;
  saved: 'sending' | 'saved' | 'later';
  onAgain: () => void;
}) {
  const { t } = useTranslation();
  const tint = RESULT_TINT[score.result];
  return (
    <>
      <View
        style={[styles.result, { backgroundColor: tint.bg, borderColor: tint.border }]}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.resultTitle}>
          <MaterialCommunityIcons name={RESULT_ICON[score.result]} size={30} color={tint.fg} />
          <AppText variant="title" style={{ flex: 1, color: tint.fg }} accessibilityRole="header">
            {t(`safety.result_${score.result}`)}
          </AppText>
        </View>
        <AppText style={{ color: colors.textBody }}>
          {t(`safety.resultBody_${score.result}`)}
        </AppText>
        <AppText variant="label" style={{ color: tint.fg }}>
          {t('safety.score', { total: formatNumber(score.total) })} ·{' '}
          {t(`safety.severity_${score.severity}`)}
        </AppText>
        {score.reasons.map((code) => (
          <View key={code} style={styles.reason}>
            <MaterialCommunityIcons name="circle-small" size={20} color={tint.fg} />
            <AppText variant="caption" style={{ flex: 1, color: colors.textBody }}>
              {t(`safety.reason_${code}`)}
            </AppText>
          </View>
        ))}
      </View>
      {saved !== 'sending' && (
        <AppText variant="caption" muted>
          {t(saved === 'saved' ? 'safety.savedHistory' : 'safety.savedLater')}
        </AppText>
      )}
      <SafetyDisclaimer />
      {score.result === 'descend' && (
        <Button
          title={t('safety.sos')}
          icon="alarm-light-outline"
          onPress={() => router.push('/safety')}
        />
      )}
      <EmergencyNumbers only={['tourist_police', 'ambulance']} />
      <Button title={t('safety.checkAgain')} variant="secondary" icon="refresh" onPress={onAgain} />
      <AppText variant="small" weight="regular" muted>
        {t('safety.source')}
      </AppText>
    </>
  );
}

/** "How do you feel?": the Lake Louise AMS self-check (V2-P3-03). Works offline. */
export default function SymptomCheckerScreen() {
  const { t } = useTranslation();
  const { trekId } = useLocalSearchParams<{ trekId?: string }>();
  const trek = useTrek(trekId);
  const [answers, setAnswers] = useState<Partial<Record<Symptom, number>>>({});
  const [flags, setFlags] = useState<RedFlag[]>([]);
  const [altitude, setAltitude] = useState<number | null>(null);
  const [score, setScore] = useState<LakeLouiseScore | null>(null);
  const [saved, setSaved] = useState<'sending' | 'saved' | 'later'>('sending');
  const [missing, setMissing] = useState(false);

  async function submit() {
    if (SYMPTOMS.some((s) => answers[s] == null)) {
      setMissing(true);
      return;
    }
    setMissing(false);
    const full = { ...answers, red_flags: flags } as Answers;
    // Scored on the phone so the advice shows with no internet; the server scores it again.
    setScore(scoreLakeLouise(full));
    setSaved('sending');
    const id = newId();
    try {
      await enqueue({
        kind: 'symptom',
        body: {
          id,
          trek_id: trekId ?? null,
          altitude_m: altitude,
          headache: full.headache,
          gi: full.gi,
          fatigue: full.fatigue,
          dizziness: full.dizziness,
          red_flags: flags,
          checked_at: new Date().toISOString(),
        },
      });
      await flushOutbox();
      setSaved((await inOutbox(id)) ? 'later' : 'saved');
    } catch {
      setSaved('later');
    }
  }

  function again() {
    setAnswers({});
    setFlags([]);
    setScore(null);
  }

  return (
    <Screen>
      <PageHeader
        title={t('safety.checkerTitle')}
        subtitle={trek.data?.name ?? t('safety.title')}
        right={
          <IconButton
            icon="history"
            label={t('safety.history')}
            onPress={() => router.push('/symptoms/history')}
          />
        }
      />
      {score ? (
        <Result score={score} saved={saved} onAgain={again} />
      ) : (
        <>
          <AppText style={{ color: colors.textBody }}>{t('safety.checkerIntro')}</AppText>
          <SafetyDisclaimer />
          {SYMPTOMS.map((s) => (
            <Question
              key={s}
              symptom={s}
              value={answers[s]}
              onChange={(v) => setAnswers((a) => ({ ...a, [s]: v }))}
            />
          ))}
          <RedFlags value={flags} onChange={setFlags} />
          <WhereAreYou trekId={trekId} altitude={altitude} onChange={setAltitude} />
          {missing && (
            <AppText style={{ color: colors.danger }} accessibilityLiveRegion="polite">
              {t('safety.answerAll')}
            </AppText>
          )}
          <Button title={t('safety.seeResult')} icon="heart-pulse" onPress={submit} />
          <AppText variant="small" weight="regular" muted>
            {t('safety.source')}
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    minHeight: 52,
  },
  optionOn: { backgroundColor: colors.surfaceAlt },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  result: { gap: spacing(3), padding: spacing(4), borderRadius: radii.card, borderWidth: 1.5 },
  resultTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
});

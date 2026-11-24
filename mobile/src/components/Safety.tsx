import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { SymptomResult } from '@/lib/lakeLouise';
import { useMe } from '@/lib/queries';
import {
  cachedContacts,
  call,
  EMERGENCY_NUMBERS,
  enqueue,
  type Fix,
  flushOutbox,
  locate,
  newId,
  openSms,
  rememberedName,
  SAFETY_TEST_MODE,
  sosMessage,
  TOURIST_POLICE,
  clock,
} from '@/lib/safety';
import { colors, radii, spacing, statusTints, type Tint } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { ListCard } from './Layout';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Symptom checker result colours: every result also has a word, never colour alone. */
export const RESULT_TINT: Record<SymptomResult, Tint> = {
  ok: statusTints.ok,
  rest: statusTints.caution,
  descend: statusTints.danger,
};
export const RESULT_ICON: Record<SymptomResult, IconName> = {
  ok: 'check-circle-outline',
  rest: 'bed-outline',
  descend: 'arrow-down-bold-circle-outline',
};
export const HOLD_MS = 2000;

/**
 * "Bato is not a rescue service and not medical advice…": on every safety screen. In test mode
 * (EXPO_PUBLIC_SAFETY_TEST_NUMBERS set) a second banner says the calls go to test numbers.
 */
export function SafetyDisclaimer() {
  const { t } = useTranslation();
  const tint = statusTints.caution;
  const test = statusTints.rest;
  return (
    <>
      {SAFETY_TEST_MODE && (
        <View style={[styles.disclaimer, { backgroundColor: test.bg, borderColor: test.border }]}>
          <MaterialCommunityIcons name="flask-outline" size={20} color={test.fg} />
          <AppText variant="caption" weight="bold" style={{ flex: 1, color: test.fg }}>
            {t('safety.testMode')}
          </AppText>
        </View>
      )}
      <View style={[styles.disclaimer, { backgroundColor: tint.bg, borderColor: tint.border }]}>
        <MaterialCommunityIcons name="alert-outline" size={20} color={tint.fg} />
        <AppText variant="caption" weight="semibold" style={{ flex: 1, color: tint.fg }}>
          {t('safety.disclaimer')}
        </AppText>
      </View>
    </>
  );
}

/** One tappable phone number: tap → the phone's dialler opens. */
export function CallRow({
  name,
  phone,
  note,
  icon = 'phone',
  last,
}: {
  name: string;
  phone: string;
  note?: string | null;
  icon?: IconName;
  last?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('safety.callA11y', { name, phone })}
      onPress={() => call(phone)}
      style={({ pressed }) => [styles.callRow, !last && styles.divider, pressed && styles.pressed]}
    >
      <View style={styles.callIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" weight="semibold">
          {name}
        </AppText>
        {note ? (
          <AppText variant="small" weight="regular" muted>
            {note}
          </AppText>
        ) : null}
      </View>
      <AppText variant="subheading" style={{ color: colors.primary }}>
        {phone}
      </AppText>
    </Pressable>
  );
}

/** Police, Tourist Police, Ambulance, Fire: shipped inside the app, so they show offline. */
export function EmergencyNumbers({ only }: { only?: string[] }) {
  const { i18n } = useTranslation();
  const ne = i18n.language === 'ne';
  const list = only ? EMERGENCY_NUMBERS.filter((n) => only.includes(n.code)) : EMERGENCY_NUMBERS;
  return (
    <ListCard>
      {list.map((n, i) => (
        <CallRow
          key={n.code}
          name={ne ? n.name_ne : n.name_en}
          note={ne ? n.note_ne : n.note_en}
          phone={n.phone}
          icon={
            n.code === 'ambulance'
              ? 'ambulance'
              : n.code === 'fire'
                ? 'fire-truck'
                : 'police-badge-outline'
          }
          last={i === list.length - 1}
        />
      ))}
    </ListCard>
  );
}

// ---------------------------------------------------------------------- SOS
export type SosState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'opening' }
  | { status: 'done'; fix: Fix | null; contacts: number }
  | { status: 'failed'; phone: string };

/**
 * The SOS steps: find the position (10 s at most), write the message, open the SMS app to the
 * contacts kept on the phone (or call the Tourist Police if there are none), then queue a record
 * for the server. Works with mobile data off: only the record waits for internet.
 */
export function useSos() {
  const { t } = useTranslation();
  const me = useMe();
  const [state, setState] = useState<SosState>({ status: 'idle' });

  async function trigger() {
    setState({ status: 'locating' });
    const now = new Date();
    const fix = await locate();
    const name =
      me.data?.full_name || me.data?.email || (await rememberedName()) || t('safety.title');
    const message = sosMessage(name, fix, now);
    const contacts = await cachedContacts();
    setState({ status: 'opening' });
    try {
      if (contacts.length > 0)
        await openSms(
          contacts.map((c) => c.phone),
          message,
        );
      else await call(TOURIST_POLICE);
      setState({ status: 'done', fix, contacts: contacts.length });
    } catch {
      setState({ status: 'failed', phone: TOURIST_POLICE });
    }
    await enqueue({
      kind: 'sos',
      body: {
        id: newId(),
        latitude: fix?.lat ?? null,
        longitude: fix?.lng ?? null,
        accuracy_m: fix?.accuracyM ?? null,
        message,
        sent_at: now.toISOString(),
      },
    }).catch(() => {});
    flushOutbox().catch(() => {});
  }

  return { state, trigger, busy: state.status === 'locating' || state.status === 'opening' };
}

/**
 * The red SOS button: hold it for 2 seconds (a ring fills up, the phone vibrates) so a pocket tap
 * never sends an SOS. Screen-reader users double-tap it instead ("activate").
 */
export function SosButton({
  onTrigger,
  busy,
  size = 168,
}: {
  onTrigger: () => void;
  busy?: boolean;
  size?: number;
}) {
  const { t } = useTranslation();
  const [progress] = useState(() => new Animated.Value(0));
  const hold = useRef<Animated.CompositeAnimation | null>(null);
  const [holding, setHolding] = useState(false);

  const stroke = Math.max(6, Math.round(size / 18));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  function start() {
    if (busy) return;
    setHolding(true);
    Vibration.vibrate(30);
    hold.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false, // SVG props can't use the native driver
    });
    hold.current.start(({ finished }) => {
      hold.current = null;
      if (!finished) return;
      setHolding(false);
      progress.setValue(0);
      Vibration.vibrate([0, 200, 100, 200]);
      onTrigger();
    });
  }

  function cancel() {
    if (!hold.current) return;
    hold.current.stop();
    hold.current = null;
    setHolding(false);
    Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  }

  const small = size < 100;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('safety.holdA11y')}
      accessibilityState={{ busy }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && !busy && onTrigger()}
      onPressIn={start}
      onPressOut={cancel}
      style={{ width: size, height: size }}
    >
      <View
        style={[
          styles.sosFace,
          { width: size, height: size, borderRadius: size / 2 },
          (holding || busy) && { backgroundColor: colors.primaryPressed },
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" size={small ? 'small' : 'large'} />
        ) : (
          <>
            <AppText
              variant={small ? 'subheading' : 'display'}
              weight="extrabold"
              style={{ color: '#FFFFFF', fontSize: small ? 18 : 40, lineHeight: small ? 22 : 46 }}
            >
              {t('safety.sos')}
            </AppText>
            {!small && (
              <AppText
                variant="small"
                weight="semibold"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                {holding ? t('safety.keepHolding') : '2 s'}
              </AppText>
            )}
          </>
        )}
      </View>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#FFFFFF"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </Pressable>
  );
}

/** What happened after the SOS: shown under the button. */
export function SosStatus({ state }: { state: SosState }) {
  const { t } = useTranslation();
  if (state.status === 'idle') return null;
  if (state.status === 'locating' || state.status === 'opening') {
    return (
      <AppText variant="label" style={styles.center} accessibilityLiveRegion="polite">
        {t(state.status === 'locating' ? 'safety.locating' : 'safety.opening')}
      </AppText>
    );
  }
  if (state.status === 'failed') {
    return (
      <View style={[styles.statusBox, { borderColor: colors.danger }]}>
        <AppText style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {t('safety.failed', { phone: state.phone })}
        </AppText>
        <Button title={state.phone} icon="phone" onPress={() => call(state.phone)} />
      </View>
    );
  }
  const { fix } = state;
  return (
    <View style={styles.statusBox} accessibilityLiveRegion="polite">
      <AppText variant="subheading">{t('safety.readyTitle')}</AppText>
      <AppText style={{ color: colors.textBody }}>
        {state.contacts > 0
          ? t('safety.readyBody', { count: state.contacts })
          : t('safety.calledPolice', { phone: TOURIST_POLICE })}
      </AppText>
      {fix ? (
        <AppText variant="caption" muted>
          {t('safety.locationLine', {
            lat: fix.lat.toFixed(5),
            lng: fix.lng.toFixed(5),
            accuracy: fix.accuracyM ?? '?',
          })}
          {fix.lastKnown ? `\n${t('safety.lastKnownLine', { time: clock(fix.time) })}` : ''}
        </AppText>
      ) : (
        <AppText variant="caption" style={{ color: colors.warning }}>
          {t('safety.noLocation')}
        </AppText>
      )}
      {state.contacts > 0 && (
        <AppText variant="caption" muted>
          {t('safety.notSentHint', { phone: TOURIST_POLICE })}
        </AppText>
      )}
    </View>
  );
}

/**
 * "Safety on the trail" on the trek and trip pages: a small SOS button, plus links to the symptom
 * checker (treks only) and the emergency numbers.
 */
export function SafetyCard({ trekId }: { trekId?: string }) {
  const { t } = useTranslation();
  const sos = useSos();
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <SosButton size={76} onTrigger={sos.trigger} busy={sos.busy} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="subheading" style={{ color: '#FFFFFF' }}>
            {t('safety.cardTitle')}
          </AppText>
          <AppText variant="caption" weight="regular" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {t('safety.cardBody')}
          </AppText>
        </View>
      </View>
      {sos.state.status !== 'idle' && (
        <View style={styles.cardStatus}>
          <SosStatus state={sos.state} />
        </View>
      )}
      <View style={styles.cardLinks}>
        {trekId && (
          <Button
            compact
            variant="light"
            icon="heart-pulse"
            title={t('safety.feel')}
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/symptoms', params: { trekId } })}
          />
        )}
        <Button
          compact
          variant="light"
          icon="phone-alert-outline"
          title={t('safety.numbersTitle')}
          style={{ flex: 1 }}
          onPress={() => router.push('/safety')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disclaimer: {
    flexDirection: 'row',
    gap: spacing(2),
    alignItems: 'flex-start',
    padding: spacing(3),
    borderRadius: radii.chip,
    borderWidth: 1,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    minHeight: 60,
  },
  callIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  pressed: { opacity: 0.8 },
  sosFace: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  center: { textAlign: 'center' },
  statusBox: {
    gap: spacing(2),
    padding: spacing(4),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: { gap: spacing(3), padding: spacing(4), borderRadius: 22, backgroundColor: colors.navy },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(4) },
  cardStatus: { borderRadius: radii.card, overflow: 'hidden' },
  cardLinks: { flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' },
});

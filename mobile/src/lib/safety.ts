/**
 * Safety on the trail (V2 Phase 3 Core): emergency contacts kept on the phone, the SOS message,
 * the phone's position, and an offline queue ("outbox") for SOS events and symptom checks.
 *
 * Everything here must work with no internet: GPS comes from satellites, the SMS goes over the
 * mobile network, and the server only hears about it later, when the outbox is sent.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { requireOptionalNativeModule, uuid } from 'expo';
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

import emergencyNumbers from '@/data/emergencyNumbers.json';
import i18n from '@/i18n';

import { api } from './api';
import type { EmergencyContact } from './types';

/** Police, Tourist Police, Ambulance, Fire: shipped in the app, so they show offline. */
export interface EmergencyNumber {
  code: string;
  phone: string;
  name_en: string;
  name_ne: string;
  note_en: string;
  note_ne: string;
}
const REAL_NUMBERS: EmergencyNumber[] = emergencyNumbers;

/**
 * Test mode: EXPO_PUBLIC_SAFETY_TEST_NUMBERS in mobile/.env (comma-separated, never committed)
 * replaces the real emergency numbers, so SOS and the call buttons can be tried on a phone without
 * calling the police. The names stay; each number is swapped for a test number in turn. Remove the
 * line (and restart Metro / rebuild) to get the real numbers back.
 */
export const TEST_NUMBERS = (process.env.EXPO_PUBLIC_SAFETY_TEST_NUMBERS ?? '')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean);
export const SAFETY_TEST_MODE = TEST_NUMBERS.length > 0;

export const EMERGENCY_NUMBERS: EmergencyNumber[] = SAFETY_TEST_MODE
  ? REAL_NUMBERS.map((n, i) => ({ ...n, phone: TEST_NUMBERS[i % TEST_NUMBERS.length] }))
  : REAL_NUMBERS;
/** Who the SOS button calls when the user has no contacts of their own: the Tourist Police. */
export const TOURIST_POLICE =
  EMERGENCY_NUMBERS.find((n) => n.code === 'tourist_police')?.phone ?? '1144';

export const newId = () => uuid.v4();

// ------------------------------------------------------------ contacts cache
const CONTACTS_KEY = 'safety.contacts';
const OUTBOX_KEY = 'safety.outbox';
const NAME_KEY = 'safety.name';

/** The contacts last loaded from the server, so SOS works offline. AsyncStorage, not SecureStore:
 * SecureStore may refuse values over 2 KB, and five contacts with emails can pass that. */
export async function cachedContacts(): Promise<EmergencyContact[]> {
  try {
    const raw = await AsyncStorage.getItem(CONTACTS_KEY);
    return raw ? (JSON.parse(raw) as EmergencyContact[]) : [];
  } catch {
    return [];
  }
}

export async function cacheContacts(contacts: EmergencyContact[]): Promise<void> {
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

/** The name the SOS message is signed with; kept so it is known offline too. */
export async function rememberName(name: string): Promise<void> {
  await AsyncStorage.setItem(NAME_KEY, name);
}

export async function rememberedName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

/** On logout: another person may log in on this phone next. */
export async function clearSafetyData(): Promise<void> {
  await AsyncStorage.multiRemove([CONTACTS_KEY, OUTBOX_KEY, NAME_KEY]);
}

// ------------------------------------------------------------------ calling
export function call(phone: string) {
  return Linking.openURL(`tel:${phone}`);
}

// ----------------------------------------------------------------- position
export interface Fix {
  lat: number;
  lng: number;
  accuracyM: number | null;
  altitudeM: number | null;
  time: Date;
  /** true = the phone's last known position, because a fresh one did not come in time */
  lastKnown: boolean;
}

const FIX_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

const toFix = (pos: Location.LocationObject, lastKnown: boolean): Fix => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracyM: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null,
  altitudeM: pos.coords.altitude != null ? Math.round(pos.coords.altitude) : null,
  time: new Date(pos.timestamp),
  lastKnown,
});

/**
 * The best position the phone can give within 10 s: a fresh high-accuracy GPS fix, else the last
 * known position (with its time), else null. Asks for permission if it may still ask.
 */
export async function locate(): Promise<Fix | null> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return null;
  } catch {
    return null;
  }
  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      FIX_TIMEOUT_MS,
    );
    return toFix(pos, false);
  } catch {
    // no fix in time (indoors, location switched off): try the last known one
  }
  try {
    const last = await Location.getLastKnownPositionAsync();
    return last ? toFix(last, true) : null;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------- SOS message
const two = (n: number) => String(n).padStart(2, '0');
/** Always Latin digits: the message must work as a link and for anyone reading it. */
export const clock = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;
const stamp = (d: Date) =>
  `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${clock(d)}`;

export function sosMessage(name: string, fix: Fix | null, now: Date): string {
  if (!fix) return i18n.t('safety.sms.noLocation', { name, time: stamp(now) });
  const lat = fix.lat.toFixed(5);
  const lng = fix.lng.toFixed(5);
  return i18n.t(fix.lastKnown ? 'safety.sms.lastKnown' : 'safety.sms.withLocation', {
    name,
    lat,
    lng,
    accuracy: fix.accuracyM ?? '?',
    link: `https://maps.google.com/?q=${lat},${lng}`,
    fixTime: clock(fix.time),
    time: stamp(now),
  });
}

/**
 * Opens the phone's SMS app with the message and recipients filled in; the user presses Send
 * (Android doesn't let Play Store apps send SMS silently). Uses expo-sms when this build has it,
 * otherwise an sms: link, so a build made before expo-sms was added still works.
 */
export async function openSms(phones: string[], message: string): Promise<void> {
  if (requireOptionalNativeModule('ExpoSMS')) {
    const SMS = await import('expo-sms');
    if (await SMS.isAvailableAsync()) {
      await SMS.sendSMSAsync(phones, message);
      return;
    }
  }
  const body = encodeURIComponent(message);
  const url =
    Platform.OS === 'ios'
      ? `sms:/open?addresses=${phones.join(',')}&body=${body}`
      : `sms:${phones.join(';')}?body=${body}`;
  await Linking.openURL(url);
}

// ------------------------------------------------------------------- outbox
type OutboxItem = { kind: 'sos'; body: SosEventBody } | { kind: 'symptom'; body: SymptomCheckBody };

export interface SosEventBody {
  id: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  message: string;
  sent_at: string;
}

export interface SymptomCheckBody {
  id: string;
  trek_id: string | null;
  altitude_m: number | null;
  headache: number;
  gi: number;
  fatigue: number;
  dizziness: number;
  red_flags: string[];
  checked_at: string;
}

const OUTBOX_MAX = 50;
const PATHS = { sos: '/sos-events', symptom: '/symptom-checks' } as const;

async function readOutbox(): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

export async function outboxSize(kind?: OutboxItem['kind']): Promise<number> {
  return (await readOutbox()).filter((x) => !kind || x.kind === kind).length;
}

export async function inOutbox(id: string): Promise<boolean> {
  return (await readOutbox()).some((x) => x.body.id === id);
}

export async function enqueue(item: OutboxItem): Promise<void> {
  const items = await readOutbox();
  items.push(item);
  // Keep the newest; an SOS is never the one dropped while older symptom checks remain.
  while (items.length > OUTBOX_MAX) {
    const i = items.findIndex((x) => x.kind === 'symptom');
    items.splice(i >= 0 ? i : 0, 1);
  }
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

/** A 4xx (other than 401/408/429) will fail the same way next time: drop it, don't block. */
function isPermanent(error: unknown) {
  if (!axios.isAxiosError(error) || !error.response) return false;
  const s = error.response.status;
  return s >= 400 && s < 500 && s !== 401 && s !== 408 && s !== 429;
}

let flushing: Promise<number> | null = null;

/**
 * Sends the queued items in order; each one is removed only after the server accepted it (201),
 * so nothing is lost when the connection drops halfway. The server saves an id only once, so a
 * resend after a lost response is harmless. Returns how many were sent.
 */
export function flushOutbox(): Promise<number> {
  flushing ??= (async () => {
    let sent = 0;
    for (;;) {
      const [first] = await readOutbox();
      if (!first) break;
      try {
        await api.post(PATHS[first.kind], first.body);
        sent += 1;
      } catch (e) {
        if (!isPermanent(e)) break; // offline or server trouble: try again later
      }
      const rest = (await readOutbox()).filter((x) => x.body.id !== first.body.id);
      await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(rest));
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

import { notifications } from '@mantine/notifications';

import { errorMessage } from './api';
import i18n from './i18n';

export function notifySaved(message = i18n.t('common.saved')) {
  notifications.show({ color: 'green', message });
}

export function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: i18n.t('common.error'),
    message: errorMessage(error, i18n.t('common.error')),
    autoClose: 8000,
  });
}

/** Run a mutation, then show a green "Saved" or a red error toast. */
export async function withToast<T>(work: Promise<T>, message?: string): Promise<T | undefined> {
  try {
    const result = await work;
    notifySaved(message);
    return result;
  } catch (e) {
    notifyError(e);
    return undefined;
  }
}

/** Empty strings from inputs become null for the API. */
export const orNull = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
export const numOrNull = (v: string | number | null | undefined) =>
  v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v);

const NE_MONTHS = [
  'जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन',
  'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर',
];
const toNepaliDigits = (text: string) =>
  text.replace(/[0-9]/g, (d) => '०१२३४५६७८९'[Number(d)]);

/**
 * "19 Nov 2026", or "१९ नोभेम्बर २०२६" in Nepali. Built by hand because many browsers have no
 * Nepali date data and quietly fall back to English (BUG-09).
 */
export const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (i18n.language !== 'ne')
    return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  const day = toNepaliDigits(String(date.getDate()));
  return `${day} ${NE_MONTHS[date.getMonth()]} ${toNepaliDigits(String(date.getFullYear()))}`;
};

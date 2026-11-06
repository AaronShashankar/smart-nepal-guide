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

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(i18n.language === 'ne' ? 'ne-NP' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

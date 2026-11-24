import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useEmergencyContacts, useMe } from './queries';
import { flushOutbox, rememberName } from './safety';

/**
 * While logged in: keep the emergency contacts and the user's name on the phone (so SOS works
 * offline), and send queued SOS events and symptom checks whenever the app opens or comes back
 * to the front (V2 Phase 3).
 */
export function useSafetySync() {
  const client = useQueryClient();
  const me = useMe();
  useEmergencyContacts(); // loading it also refreshes the copy on the phone

  const name = me.data?.full_name || me.data?.email;
  useEffect(() => {
    if (name) rememberName(name).catch(() => {});
  }, [name]);

  useEffect(() => {
    const flush = () =>
      flushOutbox()
        .then((sent) => {
          if (sent > 0) client.invalidateQueries({ queryKey: ['symptom-checks'] });
        })
        .catch(() => {});
    flush();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flush();
    });
    return () => sub.remove();
  }, [client]);
}

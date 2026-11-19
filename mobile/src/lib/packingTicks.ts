import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Ticks live on the phone only (no account needed), one list per trek and month. */
export const packingKey = (trekId: string, month: number) => `packing:${trekId}:${month}`;

type Ticks = { key: string; codes: Set<string> };

/** The ticked item codes for a trek and month, saved in AsyncStorage on every change. */
export function usePackingTicks(trekId: string, month: number) {
  const key = packingKey(trekId, month);
  const [ticks, setTicks] = useState<Ticks>({ key: '', codes: new Set() });
  // The latest ticks, read by toggle(), so taps that arrive before a re-render still all count.
  const latest = useRef<Ticks>(ticks);

  const apply = useCallback((next: Ticks) => {
    latest.current = next;
    setTicks(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!cancelled) apply({ key, codes: new Set(raw ? (JSON.parse(raw) as string[]) : []) });
      })
      .catch(() => {
        if (!cancelled) apply({ key, codes: new Set() });
      });
    return () => {
      cancelled = true;
    };
  }, [key, apply]);

  const save = useCallback(
    (codes: Set<string>) => {
      apply({ key, codes });
      const write = codes.size
        ? AsyncStorage.setItem(key, JSON.stringify([...codes]))
        : AsyncStorage.removeItem(key);
      write.catch(() => {}); // a failed write only loses ticks; the list itself still works
    },
    [key, apply],
  );

  const toggle = useCallback(
    (code: string) => {
      const current = latest.current.key === key ? latest.current.codes : new Set<string>();
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      save(next);
    },
    [key, save],
  );

  const reset = useCallback(() => save(new Set()), [save]);

  // Until the stored ticks for this key are read, show none (not the previous month's).
  const loaded = ticks.key === key;
  return { ticked: loaded ? ticks.codes : new Set<string>(), loaded, toggle, reset };
}

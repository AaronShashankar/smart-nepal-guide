import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export type LocationState =
  | { status: 'idle' }
  | { status: 'asking' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'error' }
  | { status: 'ready'; coords: { lat: number; lng: number } };

/** Ask for "while using the app" location once, then read the position (balanced accuracy). */
export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: 'idle' });

  const request = useCallback(async () => {
    setState({ status: 'asking' });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setState({ status: 'denied', canAskAgain: permission.canAskAgain });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setState({
        status: 'ready',
        coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      });
    } catch {
      setState({ status: 'error' }); // e.g. location services switched off
    }
  }, []);

  return { state, request };
}

/**
 * The phone's last known position, but only if the user has ALREADY allowed location (we never
 * ask here). Rounded to 2 decimals (about 1 km): enough for "near you", and the query key stays
 * the same while the user walks around.
 */
export function useKnownPosition() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) return;
        const pos = await Location.getLastKnownPositionAsync();
        if (pos && alive) {
          const round = (n: number) => Math.round(n * 100) / 100;
          setCoords({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
        }
      } catch {
        // no position: recommendations simply do without it
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return coords;
}

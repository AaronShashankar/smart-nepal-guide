import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

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

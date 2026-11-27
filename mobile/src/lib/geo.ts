import type { LngLatBounds } from '@maplibre/maplibre-react-native';

/** Great-circle distance in km (same formula as the backend's app/algorithms/haversine.py). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** [west, south, east, north] around [lng, lat] points, padded so one point is not a zero box. */
export function boundsOf(coords: [number, number][], pad = 0.01): LngLatBounds {
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    Math.min(...lngs) - pad,
    Math.min(...lats) - pad,
    Math.max(...lngs) + pad,
    Math.max(...lats) + pad,
  ];
}

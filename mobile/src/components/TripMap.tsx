import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import type { LngLatBounds } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { MAP_FONT, OSM_STYLE } from '@/lib/mapStyle';
import type { TripStop } from '@/lib/types';
import { colors } from '@/theme';

const DAY_COLORS = ['#C8102E', '#003893', '#2E7D32', '#B26A00', '#6A1B9A', '#00838F'];

/**
 * Numbered markers in visiting order, joined by straight lines
 * (real road routing is future scope).
 */
export function TripMap({ stops }: { stops: TripStop[] }) {
  const { points, line, bounds } = useMemo(() => {
    const coords = stops.map((s) => [s.place.longitude, s.place.latitude]);
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const pad = 0.01; // so a single stop is not zoomed in all the way
    return {
      points: {
        type: 'FeatureCollection',
        features: stops.map((s, i) => ({
          type: 'Feature',
          id: s.id,
          geometry: { type: 'Point', coordinates: coords[i] },
          properties: {
            label: String(s.visit_order ?? i + 1),
            color: DAY_COLORS[((s.day_no ?? 1) - 1) % DAY_COLORS.length],
          },
        })),
      } as GeoJSON.FeatureCollection,
      line: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      } as GeoJSON.Feature,
      bounds: [
        Math.min(...lngs) - pad,
        Math.min(...lats) - pad,
        Math.max(...lngs) + pad,
        Math.max(...lats) + pad,
      ] as LngLatBounds,
    };
  }, [stops]);

  if (stops.length === 0) return null;

  return (
    <View style={styles.box}>
      <Map
        // Re-create the map when the stops change so the camera fits the new bounds.
        key={stops.map((s) => s.id).join(',')}
        style={StyleSheet.absoluteFill}
        mapStyle={OSM_STYLE}
        logo={false}
        attribution={false}
      >
        <Camera
          initialViewState={{ bounds, padding: { top: 40, right: 40, bottom: 40, left: 40 } }}
        />
        {stops.length > 1 && (
          <GeoJSONSource id="trip-line" data={line}>
            <Layer
              id="trip-line-layer"
              type="line"
              paint={{
                'line-color': colors.accent,
                'line-width': 3,
                'line-dasharray': [2, 1.5],
              }}
            />
          </GeoJSONSource>
        )}
        <GeoJSONSource id="trip-stops" data={points}>
          <Layer
            id="trip-stop-dots"
            type="circle"
            paint={{
              'circle-radius': 12,
              'circle-color': ['get', 'color'] as never,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
          <Layer
            id="trip-stop-numbers"
            type="symbol"
            layout={{
              'text-field': ['get', 'label'],
              'text-font': MAP_FONT,
              'text-size': 12,
              'text-allow-overlap': true,
            }}
            paint={{ 'text-color': '#ffffff' }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 260, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.chip },
});

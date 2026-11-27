import { Camera, type CameraRef, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { boundsOf } from '@/lib/geo';
import { MAP_FONT, useMapStyle } from '@/lib/mapStyle';
import type { Stage } from '@/lib/types';
import { colors, radii } from '@/theme';

const PADDING = { top: 36, right: 36, bottom: 36, left: 36 };

/**
 * The trek's route on the itinerary screen (V2-MAP-06): one straight segment per day between the
 * villages, day numbers on the sleeping places. `day` (from a tap on the altitude chart)
 * highlights that day's segment in crimson and moves the camera to it; day 0 = the start.
 */
export function TrekRouteMap({ stages, day }: { stages: Stage[]; day: number | null }) {
  const mapStyle = useMapStyle();
  const camera = useRef<CameraRef>(null);

  const { segments, stops, allBounds } = useMemo(() => {
    const coords: [number, number][] = [];
    const segs: GeoJSON.Feature[] = stages.map((s) => {
      const a: [number, number] = [s.from_place.longitude, s.from_place.latitude];
      const b: [number, number] = [s.to_place.longitude, s.to_place.latitude];
      coords.push(a, b);
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [a, b] },
        properties: { day: s.day },
      };
    });
    // One dot per village where you sleep (rest days share the dot); the start gets "S".
    const seen = new Set<string>();
    const dots: GeoJSON.Feature[] = [];
    const first = stages[0];
    if (first) {
      seen.add(first.from_place.id);
      dots.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [first.from_place.longitude, first.from_place.latitude],
        },
        properties: { day: 0, label: 'S' },
      });
    }
    for (const s of stages) {
      if (seen.has(s.to_place.id)) continue;
      seen.add(s.to_place.id);
      dots.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.to_place.longitude, s.to_place.latitude] },
        properties: { day: s.day, label: String(s.day) },
      });
    }
    return {
      segments: { type: 'FeatureCollection', features: segs } as GeoJSON.FeatureCollection,
      stops: { type: 'FeatureCollection', features: dots } as GeoJSON.FeatureCollection,
      allBounds: boundsOf(coords),
    };
  }, [stages]);

  // Move to the chosen day, or back to the whole trek.
  useEffect(() => {
    const stage = day ? stages.find((s) => s.day === day) : null;
    if (stage && !stage.is_rest_day) {
      camera.current?.fitBounds(
        boundsOf(
          [
            [stage.from_place.longitude, stage.from_place.latitude],
            [stage.to_place.longitude, stage.to_place.latitude],
          ],
          0.02,
        ),
        { padding: PADDING, duration: 700 },
      );
    } else if (stage) {
      camera.current?.easeTo({
        center: [stage.to_place.longitude, stage.to_place.latitude],
        zoom: 12,
        duration: 700,
      });
    } else {
      camera.current?.fitBounds(allBounds, { padding: PADDING, duration: 700 });
    }
  }, [day, stages, allBounds]);

  if (stages.length === 0) return null;
  const chosen = day ?? -1;

  return (
    <View style={styles.box}>
      <Map style={StyleSheet.absoluteFill} mapStyle={mapStyle} logo={false} attribution={false}>
        <Camera ref={camera} initialViewState={{ bounds: allBounds, padding: PADDING }} />
        <GeoJSONSource id="stage-lines" data={segments}>
          <Layer
            id="stage-casing"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#FFFFFF', 'line-width': 7 }}
          />
          <Layer
            id="stage-line"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': [
                'case',
                ['==', ['get', 'day'], chosen],
                colors.primary,
                colors.navy,
              ] as never,
              'line-width': ['case', ['==', ['get', 'day'], chosen], 5.5, 3.5] as never,
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="stage-stops" data={stops}>
          <Layer
            id="stage-dots"
            type="circle"
            paint={{
              'circle-radius': 10,
              'circle-color': [
                'case',
                ['==', ['get', 'day'], chosen],
                colors.primary,
                colors.navy,
              ] as never,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
          <Layer
            id="stage-numbers"
            type="symbol"
            layout={{
              'text-field': ['get', 'label'],
              'text-font': MAP_FONT,
              'text-size': 11,
              'text-allow-overlap': true,
              'symbol-sort-key': ['get', 'day'],
            }}
            paint={{ 'text-color': '#FFFFFF' }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 240, borderRadius: radii.panel, overflow: 'hidden', backgroundColor: '#E8EEF2' },
});

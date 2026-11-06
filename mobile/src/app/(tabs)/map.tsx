import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { ErrorState, Loading } from '@/components/StateViews';
import { useCategories, usePlaces } from '@/lib/queries';
import { categoryColors, colors, spacing } from '@/theme';

// OpenStreetMap raster tiles (XYZ tile protocol). For heavy/production use, switch to a
// tile provider or your own tile server, per the OSM tile usage policy.
const OSM_STYLE: StyleSpecification = {
  version: 8,
  // Fonts for the text labels (symbol layers). Without a glyphs URL MapLibre Native tries to
  // load an empty URL ("Unable to parse resourceUrl"). OpenFreeMap's Noto Sans also has the
  // Devanagari range, so Nepali place names render.
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

const NEPAL_CENTER: [number, number] = [84.1, 28.3];

export default function MapScreen() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const categories = useCategories();
  const places = usePlaces({ category, page_size: 500 });

  const geojson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: (places.data?.items ?? []).map((p) => ({
        type: 'Feature',
        id: p.id,
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: { id: p.id, name: p.name, category: p.category.code },
      })),
    }),
    [places.data],
  );

  // circle-color chosen per category with a "match" expression
  const colorMatch = useMemo(
    () => ['match', ['get', 'category'], ...Object.entries(categoryColors).flat(), colors.accent],
    [],
  );

  return (
    <View style={styles.fill}>
      <Map style={styles.fill} mapStyle={OSM_STYLE} logo={false} attribution compass>
        <Camera initialViewState={{ center: NEPAL_CENTER, zoom: 6.2 }} />
        <GeoJSONSource
          id="places"
          data={geojson}
          onPress={(e) => {
            const id = e.nativeEvent.features[0]?.properties?.id;
            if (id) router.push({ pathname: '/place/[id]', params: { id: String(id) } });
          }}
        >
          <Layer
            id="place-dots"
            type="circle"
            paint={{
              'circle-radius': 7,
              'circle-color': colorMatch as never,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
          <Layer
            id="place-labels"
            type="symbol"
            minzoom={9}
            layout={{
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Regular'], // must exist on the glyphs server above
              'text-size': 12,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
            }}
            paint={{ 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }}
          />
        </GeoJSONSource>
      </Map>

      <SafeAreaView edges={['top']} style={styles.overlay} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label={t('explore.all')}
            selected={!category}
            onPress={() => setCategory(undefined)}
          />
          {categories.data?.map((c) => (
            <View key={c.code} style={styles.legendChip}>
              <View
                style={[styles.dot, { backgroundColor: categoryColors[c.code] ?? colors.accent }]}
              />
              <Chip
                label={c.name}
                selected={category === c.code}
                onPress={() => setCategory(c.code)}
              />
            </View>
          ))}
        </ScrollView>
        {places.isPending && <Loading label={t('map.loadingMarkers')} />}
        {places.isError && <ErrorState error={places.error} onRetry={() => places.refetch()} />}
      </SafeAreaView>
      <AppText variant="caption" muted style={styles.attribution}>
        {t('map.attribution')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  chips: { gap: spacing(2), padding: spacing(3) },
  legendChip: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: -6,
    zIndex: 1,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  attribution: {
    position: 'absolute',
    bottom: spacing(1),
    right: spacing(2),
    backgroundColor: '#ffffffcc',
    paddingHorizontal: spacing(1.5),
    borderRadius: 4,
  },
});

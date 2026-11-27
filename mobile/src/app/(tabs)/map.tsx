import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  type GeoJSONSourceRef,
  Layer,
  Map,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { MapPreview, type MapSelection } from '@/components/MapPreview';
import { ErrorState, Loading } from '@/components/StateViews';
import { haversineKm } from '@/lib/geo';
import { MAP_FONT, useMapStyle } from '@/lib/mapStyle';
import { useCategories, usePlaces, useTrekRoutes } from '@/lib/queries';
import type { PlaceSummary, RiskLevel } from '@/lib/types';
import {
  categoryColors,
  colors,
  difficultyColors,
  radii,
  shadows,
  spacing,
  TAB_BAR_SPACE,
} from '@/theme';

// Opens on central Nepal, Pokhara to Everest: every trek plus Kathmandu. All of Nepal is too
// wide for a phone screen (the treks became specks); a centre point cut off the Everest region.
const START_BOUNDS: [number, number, number, number] = [83.55, 27.35, 87.05, 28.95];
const START_PADDING = { top: 90, right: 16, bottom: 140, left: 16 };
const LEVELS: RiskLevel[] = ['easy', 'moderate', 'hard', 'risky'];
const VILLAGE = 'village'; // trek stops: drawn on the trek lines from VILLAGE_MINZOOM
const VILLAGE_MINZOOM = 9;

type Coords = { lat: number; lng: number };

/** Small key for the trek line colours: personal risk when we have it, else trek difficulty. */
function Legend({ personal }: { personal: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={styles.legend} accessible accessibilityRole="summary">
      <AppText variant="small" weight="bold" muted numberOfLines={1}>
        {personal ? t('map.legendRisk') : t('map.legendDifficulty')}
      </AppText>
      <View style={styles.legendRow}>
        {LEVELS.map((l) => (
          <View key={l} style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: difficultyColors[l] }]} />
            <AppText variant="small" weight="semibold">
              {t(`difficulty.${l}`)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function MapScreen() {
  const { t } = useTranslation();
  const mapStyle = useMapStyle();
  const camera = useRef<CameraRef>(null);
  const placeSource = useRef<GeoJSONSourceRef>(null);

  const [category, setCategory] = useState<string | undefined>(undefined);
  const [selection, setSelection] = useState<MapSelection>(null);
  const [me, setMe] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const categories = useCategories();
  const places = usePlaces({ category, page_size: 500 });
  const routes = useTrekRoutes();

  // Show the "you are here" dot straight away if location was already allowed (never ask here).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) return;
        const pos = await Location.getLastKnownPositionAsync();
        if (pos && alive) setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // no position: the map works without it
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Trek villages lie on the trek lines: they get their own layer that shows only when zoomed in,
  // so at country level the treks read as lines and the clusters hold the sights.
  const [placeData, villageData] = useMemo(() => {
    const toCollection = (items: PlaceSummary[]): GeoJSON.FeatureCollection => ({
      type: 'FeatureCollection',
      features: items.map((p) => ({
        type: 'Feature',
        id: p.id,
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: { id: p.id, name: p.name, category: p.category.code },
      })),
    });
    const items = places.data?.items ?? [];
    return [
      toCollection(items.filter((p) => p.category.code !== VILLAGE)),
      toCollection(items.filter((p) => p.category.code === VILLAGE)),
    ];
  }, [places.data]);

  const selectPlace = (id: unknown) => {
    const place = places.data?.items.find((p) => p.id === id);
    if (place) setSelection({ kind: 'place', place });
  };

  const routeData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: (routes.data ?? []).map((r) => ({
        type: 'Feature',
        id: r.id,
        geometry: { type: 'LineString', coordinates: r.coordinates },
        properties: {
          id: r.id,
          name: r.name,
          color: difficultyColors[r.my_risk ?? r.base_difficulty],
        },
      })),
    }),
    [routes.data],
  );
  const personal = (routes.data ?? []).some((r) => r.my_risk != null);

  // circle-color chosen per category with a "match" expression
  const colorMatch = useMemo(
    () => ['match', ['get', 'category'], ...Object.entries(categoryColors).flat(), colors.accent],
    [],
  );

  const selectedTrekId = selection?.kind === 'trek' ? selection.trek.id : '';
  const selectedPlaceId = selection?.kind === 'place' ? selection.place.id : '';

  async function locate() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setNotice(t('map.locationDenied'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMe(here);
      camera.current?.flyTo({ center: [here.lng, here.lat], zoom: 12, duration: 1200 });
    } catch {
      setNotice(t('map.locationError')); // e.g. location services switched off
    } finally {
      setLocating(false);
    }
  }

  let distanceKm: number | null = null;
  if (me && selection) {
    const [lng, lat] =
      selection.kind === 'place'
        ? [selection.place.longitude, selection.place.latitude]
        : selection.trek.coordinates[0];
    distanceKm = haversineKm(me.lat, me.lng, lat, lng);
  }

  return (
    <View style={styles.fill}>
      <Map
        style={styles.fill}
        mapStyle={mapStyle}
        logo={false}
        attribution={false}
        compass
        onPress={(e) => {
          // A tap on a marker or line also reaches the map: only a tap on empty map closes.
          const hit = 'features' in e.nativeEvent && e.nativeEvent.features.length > 0;
          if (!hit) setSelection(null);
        }}
      >
        <Camera ref={camera} initialViewState={{ bounds: START_BOUNDS, padding: START_PADDING }} />

        {/* V2-MAP-01: every trek as a line, coloured by risk for you (or by difficulty) */}
        <GeoJSONSource
          id="treks"
          data={routeData}
          onPress={(e) => {
            e.stopPropagation();
            const id = e.nativeEvent.features[0]?.properties?.id;
            const trek = routes.data?.find((r) => r.id === id);
            if (trek) setSelection({ kind: 'trek', trek });
          }}
        >
          <Layer
            id="trek-casing"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': '#FFFFFF',
              'line-width': ['case', ['==', ['get', 'id'], selectedTrekId], 10, 6] as never,
            }}
          />
          <Layer
            id="trek-line"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': ['get', 'color'] as never,
              'line-width': ['case', ['==', ['get', 'id'], selectedTrekId], 6, 3.5] as never,
            }}
          />
          <Layer
            id="trek-name"
            type="symbol"
            minzoom={8}
            layout={{
              'symbol-placement': 'line',
              'text-field': ['get', 'name'],
              'text-font': MAP_FONT,
              'text-size': 12,
            }}
            paint={{
              'text-color': ['get', 'color'] as never,
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 1.6,
            }}
          />
        </GeoJSONSource>

        {/* V2-MAP-07: places cluster when zoomed out; a tap on a cluster zooms in */}
        <GeoJSONSource
          id="places"
          ref={placeSource}
          data={placeData}
          cluster
          clusterRadius={45}
          clusterMaxZoom={11}
          onPress={async (e) => {
            e.stopPropagation();
            const feature = e.nativeEvent.features[0];
            const props = feature?.properties;
            if (!feature || !props) return;
            if (props.cluster) {
              const zoom = await placeSource.current?.getClusterExpansionZoom(props.cluster_id);
              const point = feature.geometry as GeoJSON.Point;
              camera.current?.easeTo({
                center: point.coordinates as [number, number],
                zoom: Math.min(zoom ?? 10, 14),
                duration: 500,
              });
              return;
            }
            selectPlace(props.id);
          }}
        >
          <Layer
            id="place-clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': colors.navy,
              'circle-radius': ['step', ['get', 'point_count'], 15, 5, 18, 15, 22] as never,
              'circle-stroke-width': 3,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
          <Layer
            id="place-cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': ['Noto Sans Bold'],
              'text-size': 13,
              'text-allow-overlap': true,
            }}
            paint={{ 'text-color': '#FFFFFF' }}
          />
          <Layer
            id="place-dots"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-radius': ['case', ['==', ['get', 'id'], selectedPlaceId], 10, 7] as never,
              'circle-color': colorMatch as never,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
          <Layer
            id="place-labels"
            type="symbol"
            minzoom={9}
            filter={['!', ['has', 'point_count']]}
            layout={{
              'text-field': ['get', 'name'],
              'text-font': MAP_FONT,
              'text-size': 12,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
            }}
            paint={{ 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }}
          />
        </GeoJSONSource>

        <GeoJSONSource
          id="villages"
          data={villageData}
          onPress={(e) => {
            e.stopPropagation();
            selectPlace(e.nativeEvent.features[0]?.properties?.id);
          }}
        >
          <Layer
            id="village-dots"
            type="circle"
            minzoom={VILLAGE_MINZOOM}
            paint={{
              'circle-radius': ['case', ['==', ['get', 'id'], selectedPlaceId], 9, 6] as never,
              'circle-color': categoryColors[VILLAGE] ?? colors.accent,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
          <Layer
            id="village-labels"
            type="symbol"
            minzoom={10}
            layout={{
              'text-field': ['get', 'name'],
              'text-font': MAP_FONT,
              'text-size': 11,
              'text-offset': [0, 1.1],
              'text-anchor': 'top',
            }}
            paint={{ 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }}
          />
        </GeoJSONSource>

        {/* V2-MAP-02: the blue "you are here" dot, once location is allowed */}
        {me && <UserLocation accuracy animated />}
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
            // The dot is the marker colour on the map: the chip doubles as the legend.
            <Chip
              key={c.code}
              label={c.name}
              icon="circle"
              iconColor={categoryColors[c.code] ?? colors.accent}
              selected={category === c.code}
              onPress={() => setCategory(c.code)}
            />
          ))}
        </ScrollView>
        {places.isPending && <Loading label={t('map.loadingMarkers')} />}
        {places.isError && <ErrorState error={places.error} onRetry={() => places.refetch()} />}
        {notice && (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <AppText variant="caption" weight="semibold" style={{ color: '#FFFFFF' }}>
              {notice}
            </AppText>
          </View>
        )}
      </SafeAreaView>

      <View style={styles.bottom} pointerEvents="box-none">
        <View style={styles.controls} pointerEvents="box-none">
          {routes.data && routes.data.length > 0 ? <Legend personal={personal} /> : <View />}
          <Pressable
            onPress={locate}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel={t('map.locate')}
            style={({ pressed }) => [styles.locate, pressed && { opacity: 0.8 }]}
          >
            {locating ? (
              <ActivityIndicator color={colors.navy} />
            ) : (
              <MaterialCommunityIcons
                name={me ? 'crosshairs-gps' : 'crosshairs'}
                size={24}
                color={colors.navy}
              />
            )}
          </Pressable>
        </View>
        {selection && (
          <MapPreview
            selection={selection}
            distanceKm={distanceKm}
            onClose={() => setSelection(null)}
          />
        )}
        <AppText variant="small" muted style={styles.attribution}>
          {t('map.attribution')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  chips: { gap: spacing(2), paddingHorizontal: spacing(4), paddingVertical: spacing(3) },
  notice: {
    marginHorizontal: spacing(4),
    padding: spacing(3),
    borderRadius: radii.card,
    backgroundColor: 'rgba(14,23,38,0.88)',
  },
  // Everything at the bottom sits just above the floating tab bar.
  bottom: {
    position: 'absolute',
    left: spacing(3),
    right: spacing(3),
    bottom: TAB_BAR_SPACE + spacing(1),
    gap: spacing(2),
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing(2),
  },
  legend: {
    flexShrink: 1,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    gap: 4,
    ...shadows.card,
  },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing(2), rowGap: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendLine: { width: 12, height: 4, borderRadius: 2 },
  locate: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  attribution: {
    alignSelf: 'flex-end',
    backgroundColor: '#ffffffcc',
    paddingHorizontal: spacing(1.5),
    borderRadius: 4,
    fontSize: 9,
  },
});

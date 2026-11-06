import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

// Same OpenStreetMap raster style as the mobile app (mobile/src/lib/mapStyle.ts).
const OSM_STYLE: StyleSpecification = {
  version: 8,
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

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
}

/** Click (or drag the pin) to choose a location. */
export function MapPicker({ latitude, longitude, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  // Keep the latest callback without re-creating the map.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const hasPoint = latitude != null && longitude != null;
    const m = new maplibregl.Map({
      container: container.current,
      style: OSM_STYLE,
      center: hasPoint ? [longitude, latitude] : NEPAL_CENTER,
      zoom: hasPoint ? 12 : 6.2,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    const pin = new maplibregl.Marker({ color: '#C8102E', draggable: true });
    if (hasPoint) pin.setLngLat([longitude, latitude]).addTo(m);
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    m.on('click', (e) => {
      pin.setLngLat(e.lngLat).addTo(m);
      onChangeRef.current(round(e.lngLat.lat), round(e.lngLat.lng));
    });
    pin.on('dragend', () => {
      const p = pin.getLngLat();
      onChangeRef.current(round(p.lat), round(p.lng));
    });
    map.current = m;
    marker.current = pin;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  // Typed coordinates move the pin.
  useEffect(() => {
    const m = map.current;
    const pin = marker.current;
    if (!m || !pin || latitude == null || longitude == null) return;
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
    const current = pin.getLngLat?.();
    if (current && current.lat === latitude && current.lng === longitude) return;
    pin.setLngLat([longitude, latitude]).addTo(m);
  }, [latitude, longitude]);

  return <div ref={container} className="map-picker" />;
}

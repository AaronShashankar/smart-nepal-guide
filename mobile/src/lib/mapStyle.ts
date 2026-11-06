import type { StyleSpecification } from '@maplibre/maplibre-react-native';

// OpenStreetMap raster tiles (XYZ tile protocol). For heavy/production use, switch to a
// tile provider or your own tile server, per the OSM tile usage policy.
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  // Fonts for text labels (symbol layers). Without a glyphs URL MapLibre Native tries to
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

/** Must exist on the glyphs server above. */
export const MAP_FONT = ['Noto Sans Regular'];

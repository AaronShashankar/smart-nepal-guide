import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import { useSettings } from '@/store/settings';

/*
 * Bato base map (V2-MAP-03, V2-MAP-04).
 *
 * Vector tiles from OpenFreeMap (OpenMapTiles schema, free, no API key, made for apps), drawn
 * with our own style in the Bato colours, plus shaded relief from the free AWS Terrain Tiles so
 * the Himalaya stand out. This replaces tile.openstreetmap.org, whose usage policy does not allow
 * heavy use from apps.
 *
 * Labels follow the app language. The tiles have no name:ne, but inside Nepal OpenStreetMap's
 * own `name` is already Nepali (काठमाडौं, मनास्लु). So in Nepali we show `name` when it is
 * written in Devanagari and the English name otherwise (Tibetan peaks are named in Chinese,
 * which the map font cannot draw).
 */

const TILES = 'https://tiles.openfreemap.org/planet';
const TERRAIN = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

/** Fonts on the glyph server below; Noto Sans also has Devanagari. */
export const MAP_FONT = ['Noto Sans Regular'];
const BOLD = ['Noto Sans Bold'];
const ITALIC = ['Noto Sans Italic'];

export const MAP_ATTRIBUTION = '© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors';

const C = {
  land: '#F1F2EC',
  wood: '#D9E7CF',
  grass: '#E4EDD6',
  ice: '#FFFFFF',
  rock: '#E6E2DA',
  residential: '#E9E6E0',
  park: '#D6E9CC',
  parkLine: '#0F7B4D',
  water: '#A8CBE2',
  waterText: '#2F5D80',
  road: '#FFFFFF',
  roadCase: '#D3D7DD',
  major: '#FAE6C4',
  majorCase: '#E3C08A',
  path: '#8D5524',
  border: '#0B1F4D',
  text: '#2B3545',
  textStrong: '#0E1726',
  peak: '#6B4F2A',
  halo: '#FFFFFF',
};

type Expr = unknown[];

/** The label expression for one language. */
function nameExpr(lang: 'en' | 'ne'): Expr {
  const english = ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];
  if (lang === 'en') return english;
  // Strings compare by code unit, so this is "the name starts with a Devanagari letter".
  const devanagari = ['all', ['>=', ['get', 'name'], 'ऀ'], ['<', ['get', 'name'], 'ঀ']];
  return ['case', ['all', ['has', 'name'], devanagari], ['get', 'name'], english];
}

export function makeMapStyle(lang: 'en' | 'ne'): StyleSpecification {
  const name = nameExpr(lang);
  const label = (size: number, color = C.text) => ({
    paint: { 'text-color': color, 'text-halo-color': C.halo, 'text-halo-width': 1.4 },
    layout: { 'text-field': name, 'text-font': MAP_FONT, 'text-size': size },
  });

  const layers = [
    { id: 'land', type: 'background', paint: { 'background-color': C.land } },
    {
      id: 'landcover',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      paint: {
        'fill-color': [
          'match',
          ['get', 'class'],
          'wood',
          C.wood,
          'grass',
          C.grass,
          'farmland',
          C.grass,
          'ice',
          C.ice,
          'rock',
          C.rock,
          'sand',
          C.rock,
          C.grass,
        ],
        'fill-opacity': ['match', ['get', 'class'], 'ice', 0.9, 0.7],
      },
    },
    {
      id: 'residential',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      minzoom: 9,
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood']]],
      paint: { 'fill-color': C.residential },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      paint: { 'fill-color': C.park, 'fill-opacity': 0.45 },
    },
    {
      id: 'park-outline',
      type: 'line',
      source: 'omt',
      'source-layer': 'park',
      minzoom: 7,
      paint: {
        'line-color': C.parkLine,
        'line-opacity': 0.35,
        'line-width': 1,
        'line-dasharray': [3, 2],
      },
    },
    // Shaded relief over the land colours and under the water, roads and labels.
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'terrain',
      paint: {
        'hillshade-exaggeration': 0.45,
        'hillshade-shadow-color': '#3B4A5E',
        'hillshade-highlight-color': '#FFFFFF',
        'hillshade-accent-color': '#5F6B7C',
      },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      paint: { 'fill-color': C.water },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      minzoom: 7,
      paint: {
        'line-color': C.water,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 12, 1.6, 15, 3],
      },
    },
    {
      id: 'boundary-province',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      minzoom: 6,
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: {
        'line-color': C.border,
        'line-opacity': 0.25,
        'line-width': 0.8,
        'line-dasharray': [4, 3],
      },
    },
    {
      id: 'boundary-country',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': C.border, 'line-opacity': 0.55, 'line-width': 1.4 },
    },
    // Trails: what trekkers walk on.
    {
      id: 'path',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
      paint: { 'line-color': C.path, 'line-width': 1.2, 'line-dasharray': [2, 1.5] },
    },
    {
      id: 'road-minor-case',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]],
      paint: {
        'line-color': C.roadCase,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 8],
      },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]],
      paint: {
        'line-color': C.road,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 6],
      },
    },
    {
      id: 'road-major-case',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
      paint: {
        'line-color': C.majorCase,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 10, 3, 16, 12],
      },
    },
    {
      id: 'road-major',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
      paint: {
        'line-color': C.major,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 10, 1.8, 16, 9],
      },
    },
    {
      id: 'water-name',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      minzoom: 9,
      layout: { 'text-field': name, 'text-font': ITALIC, 'text-size': 12 },
      paint: { 'text-color': C.waterText, 'text-halo-color': C.halo, 'text-halo-width': 1.2 },
    },
    {
      id: 'road-name',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 13,
      layout: {
        'text-field': name,
        'text-font': MAP_FONT,
        'text-size': 11,
        'symbol-placement': 'line',
      },
      paint: { 'text-color': C.text, 'text-halo-color': C.halo, 'text-halo-width': 1.2 },
    },
    // Peaks: name and height, the biggest first.
    {
      id: 'peak',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'mountain_peak',
      minzoom: 8,
      filter: ['==', ['get', 'class'], 'peak'],
      layout: {
        'text-field': [
          'case',
          ['has', 'ele'],
          ['concat', '▲ ', name, '\n', ['to-string', ['get', 'ele']], ' m'],
          ['concat', '▲ ', name],
        ],
        'text-font': MAP_FONT,
        'text-size': 11,
        'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'ele'], 0]],
      },
      paint: { 'text-color': C.peak, 'text-halo-color': C.halo, 'text-halo-width': 1.4 },
    },
    {
      id: 'place-village',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['village', 'hamlet', 'suburb']]],
      ...label(11),
    },
    {
      id: 'place-town',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 8,
      filter: ['==', ['get', 'class'], 'town'],
      ...label(12),
    },
    {
      id: 'place-city',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 5,
      filter: ['==', ['get', 'class'], 'city'],
      paint: { 'text-color': C.textStrong, 'text-halo-color': C.halo, 'text-halo-width': 1.6 },
      layout: {
        'text-field': name,
        'text-font': BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 10, 15],
      },
    },
    {
      id: 'place-country',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      maxzoom: 8,
      filter: ['==', ['get', 'class'], 'country'],
      paint: { 'text-color': C.border, 'text-halo-color': C.halo, 'text-halo-width': 1.6 },
      layout: {
        'text-field': name,
        'text-font': BOLD,
        'text-size': 14,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
      },
    },
  ];

  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: TILES, attribution: MAP_ATTRIBUTION },
      terrain: {
        type: 'raster-dem',
        tiles: [TERRAIN],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        attribution: 'Terrain: Mapzen / AWS Terrain Tiles',
      },
    },
    layers,
  } as unknown as StyleSpecification;
}

/** The base map style in the app's language (a new style object only when the language changes). */
export function useMapStyle(): StyleSpecification {
  const lang = useSettings((s) => s.language ?? 'en');
  return useMemo(() => makeMapStyle(lang), [lang]);
}

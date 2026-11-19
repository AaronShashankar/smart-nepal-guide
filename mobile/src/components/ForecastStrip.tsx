'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatNumber } from '@/lib/format';
import { useWeather } from '@/lib/queries';
import type { Weather } from '@/lib/types';
import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Day = Weather['days'][number];

/** WMO weather code -> icon (the sentence is `weather.code.<code>` in en.json / ne.json). */
export function weatherIcon(code: number): IconName {
  if (code <= 1) return 'weather-sunny';
  if (code === 2) return 'weather-partly-cloudy';
  if (code === 3) return 'weather-cloudy';
  if (code === 45 || code === 48) return 'weather-fog';
  if (code === 65 || code === 82) return 'weather-pouring';
  if (code === 66 || code === 67) return 'weather-snowy-rainy';
  if (code === 75 || code === 86) return 'weather-snowy-heavy';
  if ([71, 73, 77, 85].includes(code)) return 'weather-snowy';
  if (code === 95) return 'weather-lightning-rainy';
  if (code === 96 || code === 99) return 'weather-hail';
  if (code >= 51 && code <= 81) return 'weather-rainy';
  return 'weather-cloudy';
}

const degrees = (c: number | null) => (c == null ? '—' : `${formatNumber(Math.round(c))}°`);

function dayName(t: TFunction, date: string, index: number) {
  if (index === 0) return t('weather.today');
  const weekdays = t('weather.weekdays', { returnObjects: true }) as string[];
  return weekdays[new Date(`${date}T00:00:00`).getDay()];
}

function describe(t: TFunction, d: Day, index: number) {
  const values = {
    day: dayName(t, d.date, index),
    sky: t(`weather.code.${d.code}`, { defaultValue: t('weather.unknown') }),
    max: degrees(d.max_c),
    min: degrees(d.min_c),
    rain: t('weather.rain', { value: formatNumber(d.rain_mm ?? 0, 1) }),
  };
  return d.rain_mm ? t('weather.dayRain', values) : t('weather.day', values);
}

function updatedText(t: TFunction, weather: Weather) {
  const minutes = Math.max(0, (Date.now() - Date.parse(weather.fetched_at)) / 60000);
  const hours = formatNumber(Math.max(1, Math.round(minutes / 60)));
  if (weather.stale) return t('weather.stale', { value: hours });
  if (minutes < 1) return t('weather.updatedNow');
  if (minutes < 60)
    return t('weather.updatedMinutes', { value: formatNumber(Math.floor(minutes)) });
  return t('weather.updatedHours', { value: hours });
}

/**
 * V2 Phase 1: 7-day forecast (Open-Meteo via our API, cached in Redis for an hour) for a place, or
 * for a trek's highest sleeping place. Tap a day to read it in words. Loading or failing hides it:
 * the weather is extra information, not worth a big error on the page.
 */
export function ForecastStrip({ type, id }: { type: 'place' | 'trek'; id: string }) {
  const { t } = useTranslation();
  const weather = useWeather(type, id);
  const [selected, setSelected] = useState(0);
  const data = weather.data;
  if (!data || data.days.length === 0) return null;
  const day = data.days[Math.min(selected, data.days.length - 1)];

  return (
    <View style={styles.box}>
      <AppText variant="label">{t('weather.title', { place: data.place.name })}</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {data.days.map((d, i) => (
          <Pressable
            key={d.date}
            onPress={() => setSelected(i)}
            style={[styles.day, i === selected && styles.selected]}
            accessibilityRole="button"
            accessibilityState={{ selected: i === selected }}
            accessibilityLabel={describe(t, d, i)}
          >
            <AppText variant="caption" muted>
              {dayName(t, d.date, i)}
            </AppText>
            <MaterialCommunityIcons name={weatherIcon(d.code)} size={26} color={colors.accent} />
            <AppText variant="label">{degrees(d.max_c)}</AppText>
            <AppText variant="caption" muted>
              {degrees(d.min_c)}
            </AppText>
            {!!d.rain_mm && (
              <AppText variant="caption" style={{ color: colors.accent }}>
                {t('weather.rain', { value: formatNumber(d.rain_mm, 1) })}
              </AppText>
            )}
          </Pressable>
        ))}
      </ScrollView>
      <AppText variant="caption">{describe(t, day, selected)}</AppText>
      <AppText variant="caption" muted style={data.stale && { color: colors.warning }}>
        {updatedText(t, data)} · {t('weather.source')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: spacing(3.5),
    backgroundColor: colors.surface,
    borderRadius: 14,
    gap: spacing(2),
  },
  row: { gap: spacing(2) },
  day: {
    width: 64,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing(2),
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selected: { borderColor: colors.accent },
});

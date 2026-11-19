'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import { type ComponentRef, useRef, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { days as daysText, formatNumber, km, meters } from '@/lib/format';
import type { AltitudePoint, AltitudeProfile } from '@/lib/types';
import { colors, spacing, statusColors } from '@/theme';

import { AppText } from './AppText';

const HEIGHT = 180;
const PAD = { left: 48, right: 12, top: 10, bottom: 22 };
const REFERENCE_M = [3000, 5000]; // dashed lines: acclimatisation starts / very high altitude
const LABEL_H = 16;

/**
 * Days are spread evenly along the x-axis (a rest day adds no km but still gets its own flat step):
 * the start is at 0, a day's sleeping place at x = day, its high point half-way through the day.
 * The straight lines between the points are the linear interpolation from the backend
 * (app/algorithms/altitude_profile.py); each segment has the colour of that day's acclimatisation status.
 */
const xOf = (p: AltitudePoint) => (p.kind === 'high' ? p.day - 0.5 : p.day);

export function AltitudeChart({ profile }: { profile: AltitudeProfile }) {
  const { t } = useTranslation();
  const box = useRef<ComponentRef<typeof View>>(null);
  const [width, setWidth] = useState(0);
  const [originX, setOriginX] = useState(0);
  const [selected, setSelected] = useState<AltitudePoint | null>(null);

  const points = profile.points;
  if (points.length < 2) return null;
  const highest = points.reduce((a, b) => (b.altitude_m > a.altitude_m ? b : a));
  const shown = selected ?? highest;

  const alts = points.map((p) => p.altitude_m);
  const lo = Math.floor(Math.min(...alts) / 500) * 500;
  const hi = Math.max(Math.ceil(Math.max(...alts) / 500) * 500, lo + 500);
  const dayCount = Math.max(profile.total_days, 1);
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + (x / dayCount) * plotW;
  const sy = (alt: number) => PAD.top + ((hi - alt) / (hi - lo)) * plotH;

  const line = points.map((p) => `${sx(xOf(p))},${sy(p.altitude_m)}`);
  const area = `M${sx(0)},${sy(lo)} L${line.join(' L')} L${sx(xOf(points.at(-1)!))},${sy(lo)} Z`;

  // y labels: bottom, top and the reference lines, skipping any that would overlap
  const yLabels: number[] = [];
  for (const alt of [lo, hi, ...REFERENCE_M.filter((a) => a > lo && a < hi)]) {
    if (yLabels.every((other) => Math.abs(sy(other) - sy(alt)) >= LABEL_H)) yLabels.push(alt);
  }
  const step = dayCount <= 12 ? 1 : 2;
  const dayTicks = Array.from({ length: dayCount }, (_, i) => i + 1).filter(
    (d) => d % step === 0 || d === 1,
  );

  function pick(e: GestureResponderEvent) {
    const x = ((e.nativeEvent.pageX - originX - PAD.left) / plotW) * dayCount;
    const nearest = points.reduce((a, b) => (Math.abs(xOf(b) - x) < Math.abs(xOf(a) - x) ? b : a));
    setSelected(nearest);
  }

  const where =
    shown.day === 0 ? t('altitude.start') : t('itinerary.day', { day: formatNumber(shown.day) });

  return (
    <View style={styles.card}>
      <AppText variant="label">{t('altitude.title')}</AppText>
      <AppText variant="caption" style={{ color: statusColors[shown.status] }}>
        {`${where} · ${shown.place || t('altitude.highPoint')} · ${meters(shown.altitude_m)} · ${km(shown.km)}`}
      </AppText>

      <View
        ref={box}
        style={{ height: HEIGHT }}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          box.current?.measureInWindow((x) => setOriginX(x));
        }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderTerminationRequest={() => true}
        accessible
        accessibilityLabel={t('altitude.a11y', {
          from: meters(points[0].altitude_m),
          max: meters(highest.altitude_m),
          days: daysText(dayCount),
        })}
      >
        {width > 0 && (
          <>
            <Svg width={width} height={HEIGHT}>
              {REFERENCE_M.filter((a) => a > lo && a < hi).map((a) => (
                <Line
                  key={a}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={sy(a)}
                  y2={sy(a)}
                  stroke={colors.textMuted}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              ))}
              <Line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={sy(lo)}
                y2={sy(lo)}
                stroke={colors.border}
              />
              <Path d={area} fill={colors.primary} fillOpacity={0.08} />
              {points.slice(1).map((p, i) => (
                <Line
                  key={`${p.day}-${p.kind}`}
                  x1={sx(xOf(points[i]))}
                  y1={sy(points[i].altitude_m)}
                  x2={sx(xOf(p))}
                  y2={sy(p.altitude_m)}
                  stroke={statusColors[p.status]}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              ))}
              <Circle
                cx={sx(xOf(shown))}
                cy={sy(shown.altitude_m)}
                r={5}
                fill={statusColors[shown.status]}
                stroke={colors.surface}
                strokeWidth={2}
              />
            </Svg>

            {yLabels.map((alt) => (
              <AppText
                key={alt}
                variant="caption"
                muted
                style={[styles.yLabel, { top: sy(alt) - LABEL_H / 2 - 1 }]}
              >
                {formatNumber(alt)}
              </AppText>
            ))}
            {dayTicks.map((d) => (
              <AppText
                key={d}
                variant="caption"
                muted
                style={[styles.xLabel, { left: sx(d) - 12, top: HEIGHT - PAD.bottom + 2 }]}
              >
                {formatNumber(d)}
              </AppText>
            ))}
          </>
        )}
      </View>
      <AppText variant="caption" muted>
        {t('altitude.tapHint')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing(3.5), backgroundColor: colors.surface, borderRadius: 14, gap: 2 },
  yLabel: { position: 'absolute', left: 0, width: PAD.left - 6, textAlign: 'right', fontSize: 11 },
  xLabel: { position: 'absolute', width: 24, textAlign: 'center', fontSize: 11 },
});

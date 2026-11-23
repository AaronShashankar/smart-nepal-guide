'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import { type ComponentRef, useRef, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { days as daysText, formatNumber, km, meters } from '@/lib/format';
import type { AltitudePoint, AltitudeProfile } from '@/lib/types';
import { colors, radii, shadows, spacing, statusColors } from '@/theme';

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
  const isTop = shown === highest;

  return (
    <View style={styles.card}>
      <View style={styles.readout}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="small" weight="bold" muted style={styles.upper}>
            {isTop ? `${where} · ${t('altitude.highest')}` : `${where} · ${km(shown.km)}`}
          </AppText>
          <AppText variant="title" style={{ fontSize: 20, lineHeight: 26 }} numberOfLines={1}>
            {shown.place || t('altitude.highPoint')}
          </AppText>
        </View>
        <AppText variant="display" style={{ fontSize: 26, lineHeight: 32, color: colors.primary }}>
          {meters(shown.altitude_m)}
        </AppText>
      </View>

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
              <Defs>
                <LinearGradient id="altfill" x1="0" x2="0" y1="0" y2="1">
                  <Stop offset="0" stopColor={colors.navy} stopOpacity={0.16} />
                  <Stop offset="1" stopColor={colors.navy} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {REFERENCE_M.filter((a) => a > lo && a < hi).map((a) => (
                <Line
                  key={a}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={sy(a)}
                  y2={sy(a)}
                  stroke={a >= 5000 ? colors.danger : colors.textMuted}
                  strokeOpacity={0.5}
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
              <Path d={area} fill="url(#altfill)" />
              {points.slice(1).map((p, i) => (
                <Line
                  key={`${p.day}-${p.kind}`}
                  x1={sx(xOf(points[i]))}
                  y1={sy(points[i].altitude_m)}
                  x2={sx(xOf(p))}
                  y2={sy(p.altitude_m)}
                  stroke={statusColors[p.status]}
                  strokeWidth={p.status === 'ok' ? 2.5 : 3.5}
                  strokeLinecap="round"
                />
              ))}
              <Line
                x1={sx(xOf(shown))}
                x2={sx(xOf(shown))}
                y1={PAD.top}
                y2={sy(lo)}
                stroke={colors.primary}
                strokeWidth={1.5}
              />
              <Circle
                cx={sx(xOf(shown))}
                cy={sy(shown.altitude_m)}
                r={6}
                fill={colors.primary}
                stroke={colors.surface}
                strokeWidth={2.5}
              />
            </Svg>

            {yLabels.map((alt) => (
              <AppText
                key={alt}
                variant="small"
                muted
                style={[styles.yLabel, { top: sy(alt) - LABEL_H / 2 - 1 }]}
              >
                {formatNumber(alt)}
              </AppText>
            ))}
            {dayTicks.map((d) => (
              <AppText
                key={d}
                variant="small"
                muted
                style={[styles.xLabel, { left: sx(d) - 12, top: HEIGHT - PAD.bottom + 2 }]}
              >
                {formatNumber(d)}
              </AppText>
            ))}
          </>
        )}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: statusColors.ok, height: 3 }]} />
          <AppText variant="small" style={{ color: colors.textSecondary }}>
            {t('altitude.legendOk')}
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: statusColors.caution }]} />
          <AppText variant="small" style={{ color: colors.textSecondary }}>
            {t('altitude.legendCaution')}
          </AppText>
        </View>
      </View>
      <AppText variant="small" weight="regular" muted>
        {t('altitude.tapHint')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    gap: spacing(3),
    ...shadows.card,
  },
  readout: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(3) },
  upper: { textTransform: 'uppercase', letterSpacing: 0.4 },
  yLabel: { position: 'absolute', left: 0, width: PAD.left - 6, textAlign: 'right', fontSize: 10 },
  xLabel: { position: 'absolute', width: 24, textAlign: 'center', fontSize: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 4, borderRadius: 2 },
});

/** Small crimson altitude line for the "Itinerary & altitude" card on the trek page. */
export function AltitudeSparkline({
  profile,
  height = 90,
}: {
  profile: AltitudeProfile;
  height?: number;
}) {
  const points = profile.points;
  if (points.length < 2) return null;
  const W = 350;
  const alts = points.map((p) => p.altitude_m);
  const lo = Math.min(...alts);
  const hi = Math.max(Math.max(...alts), lo + 1);
  const dayCount = Math.max(profile.total_days, 1);
  const x = (p: AltitudePoint) => (xOf(p) / dayCount) * W;
  const y = (alt: number) => 8 + ((hi - alt) / (hi - lo)) * (height - 16);
  const line = `M${points.map((p) => `${x(p).toFixed(1)} ${y(p.altitude_m).toFixed(1)}`).join(' L')}`;
  const last = points.at(-1)!;
  const area = `${line} L${x(last).toFixed(1)} ${height} L0 ${height} Z`;
  const top = points.reduce((a, b) => (b.altitude_m > a.altitude_m ? b : a));
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={0.22} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#spark)" />
      <Path
        d={line}
        fill="none"
        stroke={colors.primary}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle
        cx={x(top)}
        cy={y(top.altitude_m)}
        r={4}
        fill={colors.primary}
        stroke="#FFFFFF"
        strokeWidth={2}
      />
    </Svg>
  );
}

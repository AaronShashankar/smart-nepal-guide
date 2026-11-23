'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Section } from '@/components/Cards';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { QueryState } from '@/components/StateViews';
import { days, formatNumber, meters, monthName } from '@/lib/format';
import { usePackingTicks } from '@/lib/packingTicks';
import { usePacking, useTrek } from '@/lib/queries';
import type { PackingList } from '@/lib/types';
import { colors, spacing } from '@/theme';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

type Item = PackingList['groups'][number]['items'][number];

/** "because you go above 4,000 m", "Winter, above 3,500 m", "Trek of 10 days or more" … */
function reasonText(t: ReturnType<typeof useTranslation>['t'], item: Item) {
  if (item.reason === 'WINTER' && item.value != null)
    return t('packing.reason.WINTER_HIGH', { value: meters(item.value) });
  if (item.reason === 'ALTITUDE')
    return t('packing.reason.ALTITUDE', { value: meters(item.value) });
  if (item.reason === 'LONG_TREK')
    return t('packing.reason.LONG_TREK', { value: days(item.value ?? 0) });
  return t(`packing.reason.${item.reason}`);
}

function Row({ item, ticked, onToggle }: { item: Item; ticked: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const why = reasonText(t, item);
  return (
    <Pressable
      onPress={onToggle}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: ticked }}
      accessibilityLabel={`${item.name}. ${why}`}
    >
      <MaterialCommunityIcons
        name={ticked ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={26}
        color={ticked ? colors.success : colors.textMuted}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={ticked && styles.done}>{item.name}</AppText>
        {item.note && (
          <AppText variant="caption" muted>
            {item.note}
          </AppText>
        )}
        <AppText variant="caption" style={styles.reason}>
          {why}
        </AppText>
      </View>
    </Pressable>
  );
}

function Checklist({ list, trekName }: { list: PackingList; trekName: string }) {
  const { t } = useTranslation();
  const { ticked, loaded, toggle, reset } = usePackingTicks(list.trek_id, list.month);
  const codes = list.groups.flatMap((g) => g.items.map((i) => i.code));
  const done = codes.filter((c) => ticked.has(c)).length;

  return (
    <>
      <AppText muted>
        {t('packing.intro', {
          trek: trekName,
          month: monthName(list.month),
          altitude: meters(list.max_altitude_m),
          days: days(list.total_days),
        })}
      </AppText>

      <View style={styles.progressBox}>
        <View style={styles.progressText}>
          <AppText variant="subheading">
            {loaded
              ? t('packing.progress', {
                  done: formatNumber(done),
                  total: formatNumber(list.total_items),
                })
              : ' '}
          </AppText>
        </View>
        <View style={styles.bar}>
          <View
            style={[
              styles.barFill,
              { width: `${list.total_items ? (done / list.total_items) * 100 : 0}%` },
            ]}
          />
        </View>
        <AppText variant="caption" muted>
          {t('packing.saved')}
        </AppText>
        {/* Always mounted, only disabled when nothing is ticked: a Nepali button label that is
            mounted later (after the first tick) lost its last word on Android (BUG-15). */}
        <Button
          title={t('packing.reset')}
          variant="secondary"
          onPress={reset}
          disabled={done === 0}
          icon="restore"
        />
      </View>

      {list.groups.map((g) => (
        <Section key={g.group} title={t(`packing.group.${g.group}`)}>
          <View style={styles.card}>
            {g.items.map((item, i) => (
              <View key={item.code} style={i > 0 && styles.divider}>
                <Row
                  item={item}
                  ticked={ticked.has(item.code)}
                  onToggle={() => toggle(item.code)}
                />
              </View>
            ))}
          </View>
        </Section>
      ))}
    </>
  );
}

export default function PackingScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const trek = useTrek(id);
  const packing = usePacking(id, month);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('packing.title') }} />
      <Section title={t('packing.month')}>
        <View style={styles.months}>
          {MONTHS.map((m) => (
            <Chip key={m} label={monthName(m)} selected={m === month} onPress={() => setMonth(m)} />
          ))}
        </View>
      </Section>

      <QueryState query={packing}>
        {(list) => <Checklist list={list} trekName={trek.data?.name ?? ''} />}
      </QueryState>

      <View style={styles.disclaimer}>
        <MaterialCommunityIcons name="information-outline" size={18} color={colors.textMuted} />
        <AppText variant="caption" muted style={{ flex: 1 }}>
          {t('packing.disclaimer')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  progressBox: {
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: 20,
    gap: spacing(2),
  },
  progressText: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.background, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.success },
  card: { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: spacing(4) },
  row: {
    flexDirection: 'row',
    gap: spacing(3),
    paddingVertical: spacing(3),
    alignItems: 'flex-start',
    minHeight: 48,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  done: { color: colors.textMuted, textDecorationLine: 'line-through' },
  reason: { color: colors.textMuted, fontStyle: 'italic' },
  disclaimer: { flexDirection: 'row', gap: spacing(2), alignItems: 'flex-start' },
});

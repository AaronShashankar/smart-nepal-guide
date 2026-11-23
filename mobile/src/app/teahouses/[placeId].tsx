import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { Empty, QueryState } from '@/components/StateViews';
import { useTeahouses } from '@/lib/queries';
import type { Teahouse } from '@/lib/types';
import { colors, spacing } from '@/theme';

function Amenity({ label, value }: { label: string; value: boolean | null }) {
  if (value == null) return null; // unknown: say nothing rather than guess
  return (
    <View style={styles.amenity}>
      <MaterialCommunityIcons
        name={value ? 'check-circle-outline' : 'close-circle-outline'}
        size={16}
        color={value ? colors.success : colors.textMuted}
      />
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

function TeahouseCard({ house }: { house: Teahouse }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <AppText variant="subheading">{house.name}</AppText>
      {house.price_note && <AppText muted>{house.price_note}</AppText>}
      <View style={styles.row}>
        <Amenity label={t('teahouses.wifi')} value={house.has_wifi} />
        <Amenity label={t('teahouses.shower')} value={house.has_hot_shower} />
      </View>
      {house.phone && (
        <Pressable
          style={styles.row}
          accessibilityRole="link"
          onPress={() => Linking.openURL(`tel:${house.phone!.replace(/\s/g, '')}`)}
        >
          <MaterialCommunityIcons name="phone-outline" size={18} color={colors.accent} />
          <AppText style={{ color: colors.accent }}>{house.phone}</AppText>
        </Pressable>
      )}
    </View>
  );
}

export default function TeahousesScreen() {
  const { t } = useTranslation();
  const { placeId, name } = useLocalSearchParams<{ placeId: string; name?: string }>();
  const teahouses = useTeahouses(placeId);
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('teahouses.title', { place: name ?? '' }) }} />
      <QueryState query={teahouses}>
        {(items) =>
          items.length === 0 ? (
            <Empty message={t('teahouses.empty')} />
          ) : (
            <View style={{ gap: spacing(3) }}>
              {items.map((h) => (
                <TeahouseCard key={h.id} house={h} />
              ))}
            </View>
          )
        }
      </QueryState>
      <AppText variant="caption" muted>
        {t('teahouses.note')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: 20,
    gap: spacing(1.5),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), flexWrap: 'wrap' },
  amenity: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
});

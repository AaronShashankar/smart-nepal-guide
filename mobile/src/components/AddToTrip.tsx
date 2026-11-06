import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { useAddStop, useCreateTrip, useTrips } from '@/lib/queries';
import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Loading } from './StateViews';
import { TextField } from './TextField';

/** "Add to My Trip" button + a bottom sheet: choose an existing trip or make a new one. */
export function AddToTrip({ placeId, placeName }: { placeId: string; placeName: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const trips = useTrips();
  const addStop = useAddStop();
  const createTrip = useCreateTrip();
  const busy = addStop.isPending || createTrip.isPending;

  const done = (tripTitle: string) => {
    setOpen(false);
    setTitle('');
    setMessage({ text: t('trips.added', { place: placeName, trip: tripTitle }), ok: true });
  };
  const fail = (e: unknown) => {
    setOpen(false);
    setMessage({ text: errorMessage(e, t('common.error')), ok: false });
  };

  async function addTo(tripId: string, tripTitle: string) {
    try {
      await addStop.mutateAsync({ tripId, placeId });
      done(tripTitle);
    } catch (e) {
      fail(e);
    }
  }

  async function createWithPlace() {
    const name = title.trim() || t('trips.defaultTitle');
    try {
      await createTrip.mutateAsync({ title: name, place_ids: [placeId] });
      done(name);
    } catch (e) {
      fail(e);
    }
  }

  return (
    <View style={{ gap: spacing(2) }}>
      <Button
        title={t('trips.addToTrip')}
        variant="secondary"
        icon={<MaterialCommunityIcons name="map-marker-plus" size={20} color={colors.primary} />}
        onPress={() => {
          setMessage(null);
          setOpen(true);
        }}
      />
      {message && (
        <AppText variant="caption" style={{ color: message.ok ? colors.success : colors.danger }}>
          {message.text}
        </AppText>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(4) }]}>
          <AppText variant="heading">{t('trips.chooseTrip')}</AppText>
          {trips.isPending ? (
            <Loading />
          ) : (
            <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: spacing(2) }}>
              {(trips.data ?? []).map((trip) => (
                <Pressable
                  key={trip.id}
                  style={styles.option}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => addTo(trip.id, trip.title)}
                >
                  <MaterialCommunityIcons name="map-marker-path" size={22} color={colors.primary} />
                  <AppText style={{ flex: 1 }}>{trip.title}</AppText>
                  <AppText variant="caption" muted>
                    {t('trips.stops', {
                      count: trip.stop_count,
                      value: formatNumber(trip.stop_count),
                    })}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <TextField
            label={t('trips.newTrip')}
            placeholder={t('trips.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <Button title={t('trips.createWithPlace')} onPress={createWithPlace} loading={busy} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0006' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing(4),
    gap: spacing(3),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3.5),
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
});

'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { useAddStop, useCreateTrip, useTrips } from '@/lib/queries';
import { colors, radii, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Loading } from './StateViews';
import { TextField } from './TextField';

/**
 * "Add to trip" button + a bottom sheet: choose an existing trip or make a new one. `trigger` draws
 * a custom button (the place page's bottom bar); then the result goes to `onResult` instead of
 * being shown under the button.
 */
export function AddToTrip({
  placeId,
  placeName,
  trigger,
  onResult,
}: {
  placeId: string;
  placeName: string;
  trigger?: (open: () => void) => React.ReactNode;
  onResult?: (message: { text: string; ok: boolean }) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const trips = useTrips();
  const addStop = useAddStop();
  const createTrip = useCreateTrip();
  const busy = addStop.isPending || createTrip.isPending;

  const report = (m: { text: string; ok: boolean }) => (onResult ? onResult(m) : setMessage(m));
  const done = (tripTitle: string) => {
    setOpen(false);
    setTitle('');
    report({ text: t('trips.added', { place: placeName, trip: tripTitle }), ok: true });
  };
  const fail = (e: unknown) => {
    setOpen(false);
    report({ text: errorMessage(e, t('common.error')), ok: false });
  };
  const show = () => {
    setMessage(null);
    setOpen(true);
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
    <View style={trigger ? { flex: 1.2 } : { gap: spacing(2) }}>
      {trigger ? (
        trigger(show)
      ) : (
        <Button
          title={t('trips.addToTrip')}
          variant="secondary"
          icon="map-marker-plus"
          onPress={show}
        />
      )}
      {message && (
        <AppText variant="caption" style={{ color: message.ok ? colors.success : colors.danger }}>
          {message.text}
        </AppText>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(4) }]}>
          <View style={styles.grabber} />
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
  backdrop: { flex: 1, backgroundColor: 'rgba(8,16,31,0.45)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    padding: spacing(5),
    paddingTop: spacing(3),
    gap: spacing(3),
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing(1),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(4),
    minHeight: 56,
    backgroundColor: colors.surface,
    borderRadius: radii.tile,
  },
});

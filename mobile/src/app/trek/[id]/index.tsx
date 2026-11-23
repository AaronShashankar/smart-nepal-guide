'use no memo'; // reads the language through lib/format: see the note there (BUG-14)

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AltitudeSparkline } from '@/components/AltitudeChart';
import { AppText } from '@/components/AppText';
import { BudgetTable } from '@/components/BudgetTable';
import { Button } from '@/components/Button';
import { DifficultyBadge, Section } from '@/components/Cards';
import { Pill } from '@/components/Chip';
import { ForecastStrip } from '@/components/ForecastStrip';
import {
  ACTION_BAR_SPACE,
  BottomActionBar,
  ContentSheet,
  HeroHeader,
  HighlightLink,
  ListCard,
  ListRow,
  PageHeader,
  StatTiles,
} from '@/components/Layout';
import { ReviewsSection } from '@/components/Reviews';
import { RatingBadge } from '@/components/Stars';
import { QueryState } from '@/components/StateViews';
import { days, km, meters, npr, regionName } from '@/lib/format';
import { useAltitudeProfile, useRefreshDetail, useTrek, useTrekBudget } from '@/lib/queries';
import type { Permit, TrekDetail } from '@/lib/types';
import { colors, radii, spacing } from '@/theme';

function TrekBudget({ id }: { id: string }) {
  const { t } = useTranslation();
  const budget = useTrekBudget(id);
  return (
    <Section title={t('budget.title')}>
      <QueryState query={budget}>{(b) => <BudgetTable budget={b} />}</QueryState>
    </Section>
  );
}

function Permits({ permits }: { permits: Permit[] }) {
  const { t } = useTranslation();
  const other = (p: Permit) =>
    [
      p.fee_saarc_npr != null && `${t('trek.feeSaarc')} ${npr(p.fee_saarc_npr)}`,
      p.fee_nepali_npr != null && `${t('trek.feeNepali')} ${npr(p.fee_nepali_npr)}`,
    ]
      .filter(Boolean)
      .join(' · ');
  return (
    <Section title={t('trek.permits')}>
      <ListCard>
        {permits.map((p, i) => (
          <ListRow
            key={p.code}
            last={i === permits.length - 1}
            label={p.name}
            sub={[p.description, other(p)].filter(Boolean).join('\n') || undefined}
            value={npr(p.fee_foreign_npr)}
          />
        ))}
      </ListCard>
      <AppText variant="small" weight="regular" muted>
        {t('trek.feeForeignNote')}
      </AppText>
    </Section>
  );
}

/** "Itinerary & altitude" card with a small chart, opening the full itinerary. */
function ItineraryCard({ trek }: { trek: TrekDetail }) {
  const { t } = useTranslation();
  const profile = useAltitudeProfile(trek.id);
  const top = profile.data?.points.reduce((a, b) => (b.altitude_m > a.altitude_m ? b : a));
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/trek/[id]/itinerary', params: { id: trek.id } })}
      style={({ pressed }) => [styles.itinerary, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.between}>
        <AppText variant="subheading" weight="extrabold">
          {t('trek.itineraryTitle')}
        </AppText>
        <View style={styles.inline}>
          <AppText variant="label" style={{ color: colors.primary }}>
            {t('trek.open')}
          </AppText>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primary} />
        </View>
      </View>
      {profile.data && <AltitudeSparkline profile={profile.data} />}
      {(trek.start_place || top) && (
        <View style={styles.between}>
          <AppText variant="small" muted>
            {trek.start_place?.name ?? ''}
          </AppText>
          {top?.place ? (
            <AppText variant="small" muted>
              {top.place} · {meters(top.altitude_m)}
            </AppText>
          ) : null}
          <AppText variant="small" muted>
            {trek.end_place?.name ?? ''}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.linkIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      </View>
      <AppText variant="subheading" style={{ flex: 1 }}>
        {label}
      </AppText>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

export default function TrekDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trek = useTrek(id);
  const refresh = useRefreshDetail('trek', id);

  if (!trek.data) {
    return (
      <SafeAreaView style={styles.fill}>
        <View style={{ padding: spacing(5), gap: spacing(5) }}>
          <PageHeader title="" />
          <QueryState query={trek}>{() => null}</QueryState>
        </View>
      </SafeAreaView>
    );
  }
  const tr = trek.data;
  const openRisk = () => router.push({ pathname: '/trek/[id]/risk', params: { id: tr.id } });

  return (
    <View style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingBottom: ACTION_BAR_SPACE + spacing(12) }}
        keyboardShouldPersistTaps="handled" // the review sheet is a Modal inside (BUG-11)
        refreshControl={<RefreshControl {...refresh} />}
      >
        <HeroHeader height={440}>
          <View style={styles.inline}>
            <DifficultyBadge level={tr.base_difficulty} />
            <Pill label={regionName(tr.region)} onPhoto />
          </View>
          <AppText variant="display" style={{ color: '#FFFFFF' }} accessibilityRole="header">
            {tr.name}
          </AppText>
          <RatingBadge rating={tr.rating} light />
        </HeroHeader>

        <ContentSheet>
          <StatTiles
            tiles={[
              { label: t('trek.duration'), value: days(tr.total_days) },
              { label: t('trek.distance'), value: km(tr.total_distance_km) },
              { label: t('trek.highest'), value: meters(tr.max_altitude_m) },
            ]}
          />

          <HighlightLink
            icon="shield-check-outline"
            title={t('trek.riskTitle')}
            body={t('trek.checkRiskHint')}
            onPress={openRisk}
          />

          <ForecastStrip type="trek" id={tr.id} />

          {tr.overview && (
            <Section title={t('trek.overview')}>
              <AppText style={{ color: colors.textBody }}>{tr.overview}</AppText>
            </Section>
          )}

          <ItineraryCard trek={tr} />

          {tr.start_place && tr.end_place && (
            <Section title={t('trek.route')}>
              <ListCard>
                {[
                  { label: t('trek.start'), place: tr.start_place },
                  { label: t('trek.end'), place: tr.end_place },
                ].map(({ label, place }, i) => (
                  <Link
                    key={label}
                    href={{ pathname: '/place/[id]', params: { id: place.id } }}
                    asChild
                  >
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.routeRow, i === 0 && styles.divider]}
                    >
                      <View style={styles.linkIcon}>
                        <MaterialCommunityIcons
                          name={i === 0 ? 'flag-outline' : 'flag-checkered'}
                          size={18}
                          color={colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="small" muted>
                          {label}
                        </AppText>
                        <AppText variant="label" weight="semibold">
                          {place.name}
                        </AppText>
                      </View>
                      <AppText variant="caption" weight="bold" muted>
                        {meters(place.altitude_m)}
                      </AppText>
                    </Pressable>
                  </Link>
                ))}
              </ListCard>
            </Section>
          )}

          {tr.permits.length > 0 && <Permits permits={tr.permits} />}

          <TrekBudget id={tr.id} />

          <LinkRow
            icon="bag-personal-outline"
            label={t('trek.packingList')}
            onPress={() => router.push({ pathname: '/trek/[id]/packing', params: { id: tr.id } })}
          />

          <ReviewsSection target={{ type: 'trek', id: tr.id }} />
        </ContentSheet>
      </ScrollView>

      <BottomActionBar>
        <Button
          title={t('trek.viewItinerary')}
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/trek/[id]/itinerary', params: { id: tr.id } })}
        />
        <Button title={t('trek.checkRisk')} style={{ flex: 1.3 }} onPress={openRisk} />
      </BottomActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itinerary: {
    gap: spacing(3),
    padding: spacing(4),
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(4),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
});

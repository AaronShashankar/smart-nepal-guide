import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';

import { api } from './api';
import { cacheContacts } from './safety';
import type {
  Acclimatisation,
  AltitudeProfile,
  Budget,
  Category,
  EmergencyContact,
  EmergencyContactInput,
  Interest,
  Itinerary,
  Me,
  NearPlace,
  PackingList,
  Page,
  PlaceDetail,
  PlaceSummary,
  Prediction,
  Profile,
  ProfileInput,
  RiskLevel,
  Recommendations,
  Review,
  ReviewPage,
  RiskResult,
  SaferAlternatives,
  SearchResult,
  SharedTrip,
  ShareLinks,
  SymptomCheckOut,
  Teahouse,
  TrekDetail,
  TrekSummary,
  TripDetail,
  TripSummary,
  Weather,
} from './types';

// The language is part of every content query key, so switching language refetches.
const useLang = () => useSettings((s) => s.language ?? 'en');

const get = async <T>(url: string, params?: object) => (await api.get<T>(url, { params })).data;

export function useCategories() {
  const lang = useLang();
  return useQuery({
    queryKey: ['categories', lang],
    queryFn: () => get<Category[]>('/categories'),
    staleTime: 60 * 60 * 1000,
  });
}

export function useInterests() {
  const lang = useLang();
  return useQuery({ queryKey: ['interests', lang], queryFn: () => get<Interest[]>('/interests') });
}

export interface PlaceFilters {
  category?: string;
  district?: string;
  province?: string;
  q?: string;
  bbox?: [minLng: number, minLat: number, maxLng: number, maxLat: number];
  page_size?: number;
}

export function usePlaces(filters: PlaceFilters = {}) {
  const lang = useLang();
  const { bbox, ...rest } = filters;
  const params = {
    ...rest,
    ...(bbox && { min_lng: bbox[0], min_lat: bbox[1], max_lng: bbox[2], max_lat: bbox[3] }),
  };
  return useQuery({
    queryKey: ['places', lang, params],
    queryFn: () => get<Page<PlaceSummary>>('/places', params),
    placeholderData: keepPreviousData,
  });
}

export function usePlace(id: string | undefined) {
  const lang = useLang();
  return useQuery({
    queryKey: ['place', id, lang],
    queryFn: () => get<PlaceDetail>(`/places/${id}`),
    enabled: !!id,
  });
}

export interface TrekFilters {
  region?: string;
  min_days?: number;
  max_days?: number;
  difficulty?: RiskLevel;
}

export function useTreks(filters: TrekFilters = {}, enabled = true) {
  const lang = useLang();
  return useQuery({
    queryKey: ['treks', lang, filters],
    queryFn: () => get<Page<TrekSummary>>('/treks', { ...filters, page_size: 50 }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useTrekRegions() {
  return useQuery({ queryKey: ['trek-regions'], queryFn: () => get<string[]>('/treks/regions') });
}

export function useTrek(id: string | undefined) {
  const lang = useLang();
  return useQuery({
    queryKey: ['trek', id, lang],
    queryFn: () => get<TrekDetail>(`/treks/${id}`),
    enabled: !!id,
  });
}

export function useItinerary(id: string | undefined) {
  const lang = useLang();
  return useQuery({
    queryKey: ['itinerary', id, lang],
    queryFn: () => get<Itinerary>(`/treks/${id}/stages`),
    enabled: !!id,
  });
}

export function useAltitudeProfile(id: string | undefined) {
  const lang = useLang();
  return useQuery({
    queryKey: ['altitude-profile', id, lang],
    queryFn: () => get<AltitudeProfile>(`/treks/${id}/altitude-profile`),
    enabled: !!id,
  });
}

/** Asked again for every new risk check (`predictionId`), so a changed profile is used. */
export function useSaferAlternatives(id: string, month: number, predictionId: string) {
  const lang = useLang();
  return useQuery({
    queryKey: ['safer-alternatives', id, month, predictionId, lang],
    queryFn: () => get<SaferAlternatives>(`/treks/${id}/safer-alternatives?month=${month}`),
  });
}

/** 7-day forecast; the server caches it for an hour, so the app keeps it for 30 minutes. */
export function useWeather(type: 'place' | 'trek', id: string | undefined) {
  const lang = useLang();
  return useQuery({
    queryKey: ['weather', type, id, lang],
    queryFn: () => get<Weather>(`/${type}s/${id}/weather`),
    enabled: !!id,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}

/** Packing checklist for a trek and month (rule-based on the server). */
export function usePacking(id: string | undefined, month: number) {
  const lang = useLang();
  return useQuery({
    queryKey: ['packing', id, month, lang],
    queryFn: () => get<PackingList>(`/treks/${id}/packing`, { month }),
    enabled: !!id,
    placeholderData: keepPreviousData, // keep the old list on screen while the month changes
  });
}

export function useAcclimatisation(id: string | undefined) {
  const lang = useLang();
  return useQuery({
    queryKey: ['acclimatisation', id, lang],
    queryFn: () => get<Acclimatisation>(`/treks/${id}/acclimatisation`),
    enabled: !!id,
  });
}

export function usePredictRisk() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: { trek_id: string; month: number }) =>
      (await api.post<RiskResult>('/predict-risk', body)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: ['predictions'] }),
  });
}

export function usePredictions() {
  const lang = useLang();
  return useQuery({
    queryKey: ['predictions', lang],
    queryFn: () => get<Prediction[]>('/me/predictions'),
  });
}

export function useSearch(q: string) {
  const lang = useLang();
  const query = q.trim();
  return useQuery({
    queryKey: ['search', lang, query],
    queryFn: () => get<SearchResult>('/search', { q: query, limit: 20 }),
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
  });
}

// ---------------------------------------------------------------- account

export function useMe() {
  const token = useAuth((s) => s.accessToken);
  return useQuery({ queryKey: ['me'], queryFn: () => get<Me>('/me'), enabled: !!token });
}

export function useProfile() {
  const lang = useLang();
  return useQuery({ queryKey: ['profile', lang], queryFn: () => get<Profile>('/me/profile') });
}

export function useSaveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: ProfileInput) => (await api.put<Profile>('/me/profile', body)).data,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['profile'] });
      client.invalidateQueries({ queryKey: ['me'] });
      // Interests, budget level and nationality change these:
      client.invalidateQueries({ queryKey: ['recommendations'] });
      client.invalidateQueries({ queryKey: ['trek-budget'] });
    },
  });
}

export function useUpdateMe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Pick<Me, 'full_name' | 'phone' | 'preferred_lang'>>) =>
      (await api.patch<Me>('/me', body)).data,
    onSuccess: (me) => client.setQueryData(['me'], me),
  });
}

// ------------------------------------------------------------------ trips

export function useTrips() {
  return useQuery({ queryKey: ['trips'], queryFn: () => get<TripSummary[]>('/trips') });
}

export function useTrip(id: string | undefined) {
  const lang = useLang();
  return useQuery({
    queryKey: ['trip', id, lang],
    queryFn: () => get<TripDetail>(`/trips/${id}`),
    enabled: !!id,
  });
}

/** Every trip change returns the whole trip: store it and refresh the list. */
function useTripMutation<V>(fn: (vars: V) => Promise<TripDetail>) {
  const client = useQueryClient();
  const lang = useLang();
  return useMutation({
    mutationFn: fn,
    onSuccess: (trip) => {
      client.setQueryData(['trip', trip.id, lang], trip);
      client.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export const useCreateTrip = () =>
  useTripMutation(
    async (body: { title: string; start_date?: string | null; place_ids?: string[] }) =>
      (await api.post<TripDetail>('/trips', body)).data,
  );

export const useUpdateTrip = () =>
  useTripMutation(
    async ({ id, ...body }: { id: string; title?: string; start_date?: string | null }) =>
      (await api.patch<TripDetail>(`/trips/${id}`, body)).data,
  );

export const useAddStop = () =>
  useTripMutation(
    async ({ tripId, placeId }: { tripId: string; placeId: string }) =>
      (await api.post<TripDetail>(`/trips/${tripId}/stops`, { place_id: placeId })).data,
  );

export const useRemoveStop = () =>
  useTripMutation(
    async ({ tripId, stopId }: { tripId: string; stopId: string }) =>
      (await api.delete<TripDetail>(`/trips/${tripId}/stops/${stopId}`)).data,
  );

export const useOptimiseTrip = () =>
  useTripMutation(
    async ({ tripId }: { tripId: string }) =>
      (await api.post<TripDetail>(`/trips/${tripId}/optimise`, {})).data,
  );

export function useDeleteTrip() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/trips/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['trips'] }),
  });
}

// ------------------------------------------------- V2 Phase 2: personal & community

/**
 * "Recommended for you". `coords` is the phone's position only when location was already allowed
 * (useKnownPosition never asks); without it the server uses the user's latest trip.
 */
export function useRecommendations(coords?: { lat: number; lng: number } | null) {
  const lang = useLang();
  const token = useAuth((s) => s.accessToken);
  return useQuery({
    queryKey: ['recommendations', lang, coords ?? null],
    queryFn: () => get<Recommendations>('/recommendations', { limit: 10, ...coords }),
    enabled: !!token,
    placeholderData: keepPreviousData, // no flash when the position arrives
  });
}

type RecTarget = { type: 'place' | 'trek'; id: string };
// Same scope = run one after another, so a quick "Undo" never reaches the server before the hide.
const DISMISS_SCOPE = { id: 'recommendation-dismiss' };

/** "Not interested": hide the card at once, then tell the server (V2-SR-03). */
export function useDismissRecommendation() {
  const client = useQueryClient();
  return useMutation({
    scope: DISMISS_SCOPE,
    mutationFn: async (target: RecTarget) => {
      await api.post('/recommendations/dismissed', target);
    },
    onMutate: async (target) => {
      await client.cancelQueries({ queryKey: ['recommendations'] });
      client.setQueriesData<Recommendations>({ queryKey: ['recommendations'] }, (old) =>
        old
          ? {
              ...old,
              items: old.items.filter((r) => !(r.type === target.type && r.item.id === target.id)),
            }
          : old,
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['recommendations'] }),
  });
}

/** Undo "Not interested". */
export function useUndoDismiss() {
  const client = useQueryClient();
  return useMutation({
    scope: DISMISS_SCOPE,
    mutationFn: async (target: RecTarget) => {
      await api.delete(`/recommendations/dismissed/${target.type}/${target.id}`);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['recommendations'] }),
  });
}

export function useNearPlaces(coords: { lat: number; lng: number } | null, radiusKm = 20) {
  const lang = useLang();
  return useQuery({
    queryKey: ['near', lang, coords, radiusKm],
    queryFn: () => get<NearPlace[]>('/places/near', { ...coords, radius_km: radiusKm, limit: 20 }),
    enabled: !!coords,
  });
}

export type ReviewTarget = { type: 'place' | 'trek'; id: string };
const reviewsUrl = (t: ReviewTarget) =>
  `/${t.type === 'place' ? 'places' : 'treks'}/${t.id}/reviews`;

export function useReviews(target: ReviewTarget) {
  return useQuery({
    queryKey: ['reviews', target.type, target.id],
    queryFn: () => get<ReviewPage>(reviewsUrl(target)),
  });
}

/** After a review changes: refresh its list, the item's rating and the recommendations. */
function useReviewChanged(target: ReviewTarget) {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: ['reviews', target.type, target.id] });
    client.invalidateQueries({ queryKey: [target.type, target.id] });
    client.invalidateQueries({ queryKey: [target.type === 'place' ? 'places' : 'treks'] });
    client.invalidateQueries({ queryKey: ['recommendations'] });
  };
}

export function useSaveReview(target: ReviewTarget) {
  const changed = useReviewChanged(target);
  return useMutation({
    mutationFn: async (body: { rating: number; comment: string | null }) =>
      (await api.post<Review>(reviewsUrl(target), body)).data,
    onSuccess: changed,
  });
}

export function useDeleteReview(target: ReviewTarget) {
  const changed = useReviewChanged(target);
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/reviews/${id}`),
    onSuccess: changed,
  });
}

export function useTrekBudget(id: string | undefined) {
  const lang = useLang();
  return useQuery({
    queryKey: ['trek-budget', id, lang],
    queryFn: () => get<Budget>(`/treks/${id}/budget`),
    enabled: !!id,
  });
}

export function useTripBudget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => (await api.post<Budget>(`/trips/${tripId}/budget`)).data,
    onSuccess: (_, tripId) => client.invalidateQueries({ queryKey: ['trip', tripId] }),
  });
}

export function useShareTrip() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) =>
      (await api.post<ShareLinks>(`/trips/${tripId}/share`)).data,
    onSuccess: (_, tripId) => client.invalidateQueries({ queryKey: ['trip', tripId] }),
  });
}

export function useStopSharing() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => api.delete(`/trips/${tripId}/share`),
    onSuccess: (_, tripId) => client.invalidateQueries({ queryKey: ['trip', tripId] }),
  });
}

export function useSharedTrip(token: string | undefined) {
  const lang = useLang();
  return useQuery({
    queryKey: ['shared-trip', token, lang],
    queryFn: () => get<SharedTrip>(`/shared/trips/${token}`),
    enabled: !!token,
    retry: false, // a stopped link is a 404: show it at once
  });
}

export function useTeahouses(placeId: string | undefined) {
  const lang = useLang();
  return useQuery({
    queryKey: ['teahouses', placeId, lang],
    queryFn: () => get<Teahouse[]>(`/places/${placeId}/teahouses`),
    enabled: !!placeId,
  });
}

/**
 * Pull-to-refresh for a place or trek page: reloads the item, its reviews and (for a trek) the
 * budget, so changes made in the admin panel show without restarting the app (BUG-12).
 */
export function useRefreshDetail(type: ReviewTarget['type'], id: string | undefined) {
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    const keys = [
      [type, id],
      ['reviews', type, id],
      ['weather', type, id],
      ...(type === 'trek' ? [['trek-budget', id]] : []),
    ];
    await Promise.allSettled(keys.map((queryKey) => client.refetchQueries({ queryKey })));
    setRefreshing(false);
  }, [client, type, id]);
  return { refreshing, onRefresh };
}

// ------------------------------------------------- V2 Phase 3: safety (Core)

/** The user's emergency contacts. Every load is also kept on the phone, so SOS works offline. */
export function useEmergencyContacts() {
  const token = useAuth((s) => s.accessToken);
  return useQuery({
    queryKey: ['emergency-contacts'],
    queryFn: async () => {
      const contacts = await get<EmergencyContact[]>('/me/emergency-contacts');
      await cacheContacts(contacts);
      return contacts;
    },
    enabled: !!token,
  });
}

export function useSaveContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: EmergencyContactInput }) =>
      id
        ? (await api.patch<EmergencyContact>(`/me/emergency-contacts/${id}`, body)).data
        : (await api.post<EmergencyContact>('/me/emergency-contacts', body)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: ['emergency-contacts'] }),
  });
}

export function useDeleteContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/me/emergency-contacts/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['emergency-contacts'] }),
  });
}

export function useSymptomHistory() {
  const lang = useLang();
  return useQuery({
    queryKey: ['symptom-checks', lang],
    queryFn: () => get<SymptomCheckOut[]>('/me/symptom-checks'),
  });
}

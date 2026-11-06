import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';

import { api } from './api';
import type {
  Acclimatisation,
  Category,
  Interest,
  Itinerary,
  Me,
  Page,
  PlaceDetail,
  PlaceSummary,
  Prediction,
  Profile,
  ProfileInput,
  RiskLevel,
  RiskResult,
  SearchResult,
  TrekDetail,
  TrekSummary,
  TripDetail,
  TripSummary,
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
    queryFn: () => get<SearchResult>('/search', { q: query }),
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

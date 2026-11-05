import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';

import { api } from './api';
import type {
  Category,
  Interest,
  Me,
  Page,
  PlaceDetail,
  PlaceSummary,
  Profile,
  ProfileInput,
  RiskLevel,
  SearchResult,
  TrekDetail,
  TrekSummary,
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

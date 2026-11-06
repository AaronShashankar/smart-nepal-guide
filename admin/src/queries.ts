import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './api';
import type {
  Category,
  CategoryIn,
  Page,
  Permit,
  PermitIn,
  Photo,
  Place,
  PlaceIn,
  PlaceRow,
  ReviewRow,
  ReviewStatus,
  Stats,
  Trek,
  TrekIn,
  TrekRow,
  UserRow,
} from './types';

const get = async <T>(url: string, params?: object) => (await api.get<T>(url, { params })).data;

export const useStats = () =>
  useQuery({ queryKey: ['stats'], queryFn: () => get<Stats>('/admin/stats') });

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () => get<Category[]>('/admin/categories') });

export const usePlaces = (params: { q?: string; category?: string; page?: number }) =>
  useQuery({
    queryKey: ['places', params],
    queryFn: () => get<Page<PlaceRow>>('/admin/places', { ...params, page_size: 25 }),
    placeholderData: (prev) => prev,
  });

/** Every place, for the trek stage pickers. */
export const useAllPlaces = () =>
  useQuery({
    queryKey: ['places', 'all'],
    queryFn: () => get<Page<PlaceRow>>('/admin/places', { page_size: 1000 }),
  });

export const usePlace = (id: string | undefined) =>
  useQuery({
    queryKey: ['place', id],
    queryFn: () => get<Place>(`/admin/places/${id}`),
    enabled: !!id,
  });

export const usePermits = () =>
  useQuery({ queryKey: ['permits'], queryFn: () => get<Permit[]>('/admin/permits') });

export const useTreks = () =>
  useQuery({ queryKey: ['treks'], queryFn: () => get<TrekRow[]>('/admin/treks') });

export const useTrek = (id: string | undefined) =>
  useQuery({
    queryKey: ['trek', id],
    queryFn: () => get<Trek>(`/admin/treks/${id}`),
    enabled: !!id,
  });

export const useUsers = (params: { q?: string; page?: number }) =>
  useQuery({
    queryKey: ['users', params],
    queryFn: () => get<Page<UserRow>>('/admin/users', { ...params, page_size: 25 }),
    placeholderData: (prev) => prev,
  });

export const useReviews = (status?: ReviewStatus) =>
  useQuery({
    queryKey: ['reviews', status],
    queryFn: () => get<ReviewRow[]>('/admin/reviews', status ? { status } : undefined),
  });

/** A mutation that refreshes the given query groups (and the dashboard counts) afterwards. */
function useAdminMutation<V, R>(fn: (vars: V) => Promise<R>, invalidate: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        [...invalidate, 'stats'].map((key) => qc.invalidateQueries({ queryKey: [key] })),
      ),
  });
}

const save = async <T>(path: string, id: string | undefined, body: unknown) =>
  (id ? await api.put<T>(`${path}/${id}`, body) : await api.post<T>(path, body)).data;
const remove = (path: string) => api.delete(path).then(() => undefined);

export const useSaveCategory = () =>
  useAdminMutation(
    ({ id, body }: { id?: string; body: CategoryIn }) =>
      save<Category>('/admin/categories', id, body),
    ['categories'],
  );
export const useDeleteCategory = () =>
  useAdminMutation((id: string) => remove(`/admin/categories/${id}`), ['categories']);

export const useSavePlace = () =>
  useAdminMutation(
    ({ id, body }: { id?: string; body: PlaceIn }) => save<Place>('/admin/places', id, body),
    ['places', 'place', 'categories'],
  );
export const useDeletePlace = () =>
  useAdminMutation((id: string) => remove(`/admin/places/${id}`), ['places', 'categories']);

export const useUploadPhoto = () =>
  useAdminMutation(({ placeId, file }: { placeId: string; file: File }) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<Photo>(`/admin/places/${placeId}/photos`, form).then((r) => r.data);
  }, ['place', 'places']);
export const useDeletePhoto = () =>
  useAdminMutation(
    ({ placeId, photoId }: { placeId: string; photoId: string }) =>
      remove(`/admin/places/${placeId}/photos/${photoId}`),
    ['place', 'places'],
  );

export const useSavePermit = () =>
  useAdminMutation(
    ({ id, body }: { id?: string; body: PermitIn }) => save<Permit>('/admin/permits', id, body),
    ['permits'],
  );
export const useDeletePermit = () =>
  useAdminMutation((id: string) => remove(`/admin/permits/${id}`), ['permits']);

export const useSaveTrek = () =>
  useAdminMutation(
    ({ id, body }: { id?: string; body: TrekIn }) => save<Trek>('/admin/treks', id, body),
    ['treks', 'trek', 'permits'],
  );
export const useDeleteTrek = () =>
  useAdminMutation((id: string) => remove(`/admin/treks/${id}`), ['treks', 'permits']);

export const useSetBlocked = () =>
  useAdminMutation(
    ({ id, blocked }: { id: string; blocked: boolean }) =>
      api.put<UserRow>(`/admin/users/${id}/block`, { is_blocked: blocked }).then((r) => r.data),
    ['users'],
  );

export const useSetReviewStatus = () =>
  useAdminMutation(
    ({ id, status }: { id: string; status: ReviewStatus }) =>
      api.put<ReviewRow>(`/admin/reviews/${id}/status`, { status }).then((r) => r.data),
    ['reviews'],
  );

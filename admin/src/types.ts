// Mirrors backend/app/schemas/admin.py

export type RiskLevel = 'easy' | 'moderate' | 'hard' | 'risky';
export const RISK_LEVELS: RiskLevel[] = ['easy', 'moderate', 'hard', 'risky'];
// Same colours as the mobile app's difficulty badges.
export const LEVEL_COLORS: Record<RiskLevel, string> = {
  easy: '#2E7D32',
  moderate: '#9A7B00',
  hard: '#D9480F',
  risky: '#B3261E',
};
export type ReviewStatus = 'visible' | 'hidden';

export interface Page<T> {
  items: T[];
  total: number;
}

export interface Stats {
  users: number;
  blocked_users: number;
  places: number;
  treks: number;
  trips: number;
  reviews: number;
  risk_predictions: number;
  predictions_by_level: Partial<Record<RiskLevel, number>>;
}

export interface CategoryIn {
  code: string;
  icon: string | null;
  name_en: string;
  name_ne: string | null;
}
export interface Category extends CategoryIn {
  id: string;
  place_count: number;
}

export interface PlaceText {
  name: string | null;
  description: string | null;
  how_to_reach: string | null;
}
export interface ClimateRow {
  month: number;
  avg_temp_c: number | null;
  rainfall_mm: number | null;
  visibility_score: number | null;
}
export interface PlaceIn {
  category_code: string;
  latitude: number;
  longitude: number;
  altitude_m: number | null;
  district: string | null;
  province: string | null;
  entry_fee_npr: number | null;
  is_published: boolean;
  en: PlaceText;
  ne: PlaceText;
  aliases: string[];
  climate: ClimateRow[];
}
export interface Photo {
  id: string;
  url: string;
  sort_order: number;
}
export interface Place extends PlaceIn {
  id: string;
  photos: Photo[];
  updated_at: string;
}
export interface PlaceRow {
  id: string;
  name_en: string;
  name_ne: string | null;
  category_code: string;
  district: string | null;
  altitude_m: number | null;
  latitude: number;
  longitude: number;
  is_published: boolean;
  photo_count: number;
  updated_at: string;
}

export interface PermitIn {
  code: string;
  fee_nepali_npr: number | null;
  fee_saarc_npr: number | null;
  fee_foreign_npr: number | null;
  name_en: string;
  description_en: string | null;
  name_ne: string | null;
  description_ne: string | null;
}
export interface Permit extends PermitIn {
  id: string;
  trek_count: number;
}

export interface TrekText {
  name: string | null;
  overview: string | null;
}
export interface Stage {
  from_place_id: string;
  to_place_id: string;
  distance_km: number;
  walk_hours: number;
  highest_point_m: number | null;
  notes_en: string | null;
  notes_ne: string | null;
}
export interface TrekIn {
  region: string;
  base_difficulty: RiskLevel;
  is_published: boolean;
  en: TrekText;
  ne: TrekText;
  permit_codes: string[];
  stages: Stage[];
}
export interface Trek extends TrekIn {
  id: string;
  total_days: number;
  total_distance_km: number | null;
  max_altitude_m: number | null;
  updated_at: string;
}
export interface TrekRow {
  id: string;
  name_en: string;
  name_ne: string | null;
  region: string;
  total_days: number;
  max_altitude_m: number | null;
  base_difficulty: RiskLevel;
  is_published: boolean;
  updated_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: 'traveller' | 'admin';
  auth_provider: string;
  is_blocked: boolean;
  created_at: string;
  prediction_count: number;
  trip_count: number;
}

export interface ReviewRow {
  id: string;
  user_email: string;
  target_type: 'place' | 'trek';
  target_name: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  created_at: string;
}

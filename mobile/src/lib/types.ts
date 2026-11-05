// Mirrors the backend Pydantic schemas (backend/app/schemas).

export type Lang = 'en' | 'ne';
export type RiskLevel = 'easy' | 'moderate' | 'hard' | 'risky';
export type FitnessLevel = 'low' | 'medium' | 'high';
export type TrekExperience = 'none' | 'beginner' | 'experienced';
export type BudgetLevel = 'low' | 'medium' | 'high';
export type TravelStyle = 'solo' | 'family' | 'group';

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Me {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'traveller' | 'admin';
  auth_provider: 'email' | 'google';
  preferred_lang: Lang;
  has_profile: boolean;
}

export interface Interest {
  code: string;
  name: string;
}

export interface Profile {
  date_of_birth: string | null;
  fitness_level: FitnessLevel | null;
  trek_experience: TrekExperience | null;
  has_heart_condition: boolean | null;
  has_asthma: boolean | null;
  budget_level: BudgetLevel | null;
  travel_style: TravelStyle | null;
  interests: Interest[];
}

export type ProfileInput = Omit<Profile, 'interests'> & { interests: string[] };

export interface Category {
  id: string;
  code: string;
  icon: string | null;
  name: string;
}

export interface PlaceSummary {
  id: string;
  name: string;
  category: Category;
  latitude: number;
  longitude: number;
  altitude_m: number | null;
  district: string | null;
  province: string | null;
  entry_fee_npr: number | null;
  thumbnail_url: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface PlaceDetail extends PlaceSummary {
  description: string | null;
  how_to_reach: string | null;
  photos: { url: string; sort_order: number }[];
  best_months: number[];
  nearby: { id: string; name: string; category: Category; distance_km: number }[];
}

export interface PlaceRef {
  id: string;
  name: string;
  altitude_m: number | null;
  latitude: number;
  longitude: number;
}

export interface TrekSummary {
  id: string;
  name: string;
  region: string;
  total_days: number;
  total_distance_km: number | null;
  max_altitude_m: number | null;
  base_difficulty: RiskLevel;
}

export interface Permit {
  code: string;
  name: string;
  description: string | null;
  fee_nepali_npr: number | null;
  fee_saarc_npr: number | null;
  fee_foreign_npr: number | null;
}

export interface TrekDetail extends TrekSummary {
  overview: string | null;
  permits: Permit[];
  start_place: PlaceRef | null;
  end_place: PlaceRef | null;
  stage_count: number;
}

export interface SearchHit {
  type: 'place' | 'trek';
  id: string;
  name: string;
  subtitle: string | null;
  score: number;
  matched: string;
}

export interface SearchResult {
  query: string;
  places: SearchHit[];
  treks: SearchHit[];
}

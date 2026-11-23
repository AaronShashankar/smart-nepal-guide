// Mirrors the backend Pydantic schemas (backend/app/schemas).

export type Lang = 'en' | 'ne';
export type RiskLevel = 'easy' | 'moderate' | 'hard' | 'risky';
export type FitnessLevel = 'low' | 'medium' | 'high';
export type TrekExperience = 'none' | 'beginner' | 'experienced';
export type BudgetLevel = 'low' | 'medium' | 'high';
export type TravelStyle = 'solo' | 'family' | 'group';
export type Nationality = 'nepali' | 'saarc' | 'foreign';

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
  nationality: Nationality;
  interests: Interest[];
}

export type ProfileInput = Omit<Profile, 'interests'> & { interests: string[] };

export interface Category {
  id: string;
  code: string;
  icon: string | null;
  name: string;
}

/** Bayesian average of the visible reviews (score) and how many there are (count). */
export interface Rating {
  score: number;
  count: number;
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
  rating?: Rating | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface PlaceDetail extends PlaceSummary {
  entry_fee_saarc_npr: number | null;
  entry_fee_nepali_npr: number | null;
  description: string | null;
  how_to_reach: string | null;
  photos: { url: string; sort_order: number }[];
  best_months: number[];
  nearby: { id: string; name: string; category: Category; distance_km: number }[];
  /** Codes from PLACE_TAGS (backend enums.py), shown as chips */
  tags: string[];
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
  rating?: Rating | null;
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
  /** What matched: the item's own name, its district, its category or a village on the trek */
  match: 'name' | 'district' | 'category' | 'via';
  category: Category | null; // places
  district: string | null; // places
  region: string | null; // treks
  total_days: number | null; // treks
  via: string | null; // treks found through a village they pass
}

export interface SearchResult {
  query: string;
  places: SearchHit[];
  treks: SearchHit[];
}

// ------------------------------------------------------------ Phase 2: itinerary & risk

export interface Stage {
  day: number;
  from_place: PlaceRef;
  to_place: PlaceRef;
  sleep_altitude_m: number;
  gain_m: number;
  distance_km: number;
  walk_hours: number;
  highest_point_m: number | null;
  is_rest_day: boolean;
  notes: string | null;
  teahouse_count: number;
}

export interface Itinerary {
  summary: {
    start_place: PlaceRef | null;
    end_place: PlaceRef | null;
    total_days: number;
    total_distance_km: number;
    max_altitude_m: number;
    max_sleep_altitude_m: number;
    max_daily_gain_m: number;
    max_daily_gain_day: number | null;
    rest_days: number;
  };
  stages: Stage[];
}

export type AcclimatisationStatus = 'ok' | 'caution' | 'danger';
export type AcclimatisationCode = 'GAIN_OVER_500' | 'NEEDS_REST' | 'REST_DAY';

// ------------------------------------------------------------ V2 Phase 1: smart trek features

export interface AltitudePoint {
  km: number;
  altitude_m: number;
  day: number; // 0 = start point
  place: string; // '' for a high point between two places
  kind: 'start' | 'high' | 'sleep';
  status: AcclimatisationStatus;
}

export interface AltitudeProfile {
  points: AltitudePoint[];
  max_altitude_m: number;
  total_km: number;
  total_days: number;
}

export interface Acclimatisation {
  status: AcclimatisationStatus;
  passes: boolean;
  days: {
    day: number;
    status: AcclimatisationStatus;
    gain_m: number;
    codes: AcclimatisationCode[];
  }[];
  suggested_rest_days: { before_day: number; place: string; altitude_m: number }[];
}

export type ReasonCode =
  | 'HIGH_ALTITUDE'
  | 'HIGH_DAILY_GAIN'
  | 'HEALTH_ISSUE'
  | 'NO_EXPERIENCE'
  | 'BEGINNER'
  | 'LOW_FITNESS'
  | 'WINTER_MONTH'
  | 'MONSOON_MONTH'
  | 'AGE_RISK'
  | 'LONG_DAYS';

export interface Reason {
  code: ReasonCode;
  params: Record<string, number | null>;
}

export interface RiskResult {
  id: string;
  trek_id: string;
  trek_name: string;
  month: number;
  level: RiskLevel;
  confidence: number;
  reasons: Reason[];
  acclimatisation: Acclimatisation;
  model: { version: string; algorithm: 'decision_tree' | 'random_forest' } | null;
  input: {
    max_altitude_m: number;
    max_daily_gain_m: number;
    total_days: number;
    distance_per_day_km: number;
    month: number;
    age: number;
    fitness_level: FitnessLevel;
    trek_experience: TrekExperience;
    has_health_issue: boolean;
  };
  created_at: string;
}

export interface Prediction {
  id: string;
  trek_id: string;
  trek_name: string;
  month: number;
  level: RiskLevel;
  confidence: number;
  reasons: Reason[];
  created_at: string;
}

// ------------------------------------------------------------ Phase 3: trip planner

export interface TripSummary {
  id: string;
  title: string;
  start_date: string | null;
  stop_count: number;
  total_days: number | null;
  total_km: number | null;
  updated_at: string;
}

export interface TripStop {
  id: string;
  place: PlaceSummary;
  visit_order: number | null;
  day_no: number | null;
  visit_hours: number;
}

export interface TripDay {
  day_no: number;
  stop_ids: string[];
  km: number;
  travel_hours: number;
  visit_hours: number;
}

export interface TripDetail extends TripSummary {
  is_optimised: boolean;
  estimated_budget_npr: number | null;
  is_shared: boolean;
  stops: TripStop[];
  days: TripDay[];
  nearest_neighbour_km: number | null;
}

// ------------------------------------------------- Version 2 Phase 2: personal & community

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  lang: Lang;
  author_name: string | null;
  status: 'visible' | 'hidden';
  is_mine: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewPage {
  items: Review[];
  total: number;
  page: number;
  page_size: number;
  rating: Rating;
  mine: Review | null;
}

export type BecauseCode =
  | 'INTEREST_NATURE'
  | 'INTEREST_CULTURE'
  | 'INTEREST_ADVENTURE'
  | 'INTEREST_RELIGIOUS'
  | 'GOOD_SEASON'
  | 'FITS_BUDGET'
  | 'HIGHLY_RATED'
  | 'OFTEN_PLANNED'
  | 'FITS_YOU'
  | 'NEAR_YOU'
  | 'NEAR_YOUR_TRIP'
  | 'SIMILAR_TO_LIKED'
  | 'EXPLORE_MORE';

interface RecommendationBase {
  score: number;
  because: BecauseCode[];
  /** Treks: our risk model's level for you this month (needs a complete profile) */
  risk_level: RiskLevel | null;
  /** From your position (if location is allowed) or your latest trip */
  distance_km: number | null;
}
export type Recommendation =
  | (RecommendationBase & { type: 'place'; item: PlaceSummary })
  | (RecommendationBase & { type: 'trek'; item: TrekSummary });

export interface Recommendations {
  mode: 'personal' | 'popular';
  month: number;
  items: Recommendation[];
}

export interface NearPlace extends PlaceSummary {
  distance_km: number;
}

export type BudgetCode =
  'FOOD' | 'STAY' | 'TRANSPORT' | 'ENTRY_FEE' | 'PERMIT' | 'TRAILHEAD_TRANSPORT';

export interface Budget {
  total_npr: number;
  budget_level: BudgetLevel;
  nationality: Nationality;
  region: string;
  days: number;
  lines: { code: BudgetCode; label: string | null; qty: number; rate: number; amount: number }[];
}

export interface ShareLinks {
  token: string;
  url: string;
  app_url: string;
}

export interface SharedTrip {
  title: string;
  start_date: string | null;
  total_days: number | null;
  total_km: number | null;
  is_optimised: boolean;
  stops: TripStop[];
  days: TripDay[];
}

export interface Teahouse {
  id: string;
  name: string;
  phone: string | null;
  price_note: string | null;
  has_wifi: boolean | null;
  has_hot_shower: boolean | null;
  updated_at: string;
}

export type AlternativeReason =
  'LOWER_ALTITUDE' | 'SMALLER_GAIN' | 'FEWER_DAYS' | 'SHORTER_DAYS' | 'LOWER_RISK';

export interface SaferAlternatives {
  trek_id: string;
  month: number;
  level: RiskLevel;
  k: number;
  items: {
    trek: TrekSummary;
    level: RiskLevel;
    distance: number;
    why: AlternativeReason;
    why_from: number | null;
    why_to: number | null;
  }[];
}

export interface Weather {
  place: PlaceRef; // for a trek: its highest sleeping place
  fetched_at: string;
  stale: boolean;
  days: {
    date: string; // YYYY-MM-DD
    code: number; // WMO weather code
    max_c: number | null;
    min_c: number | null;
    rain_mm: number | null;
  }[];
}

export type PackingReason = 'ALWAYS' | 'ALTITUDE' | 'WINTER' | 'MONSOON' | 'LONG_TREK' | 'PERMIT';
export type PackingGroup = 'clothing' | 'gear' | 'health' | 'documents';

export interface PackingList {
  trek_id: string;
  month: number;
  max_altitude_m: number;
  total_days: number;
  total_items: number;
  groups: {
    group: PackingGroup;
    items: {
      code: string; // rule code, or "permit:<CODE>"
      name: string;
      note: string | null;
      reason: PackingReason;
      value: number | null; // metres (ALTITUDE, WINTER) or days (LONG_TREK)
    }[];
  }[];
}

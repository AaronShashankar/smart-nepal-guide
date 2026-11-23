import i18n from '@/i18n';

/*
 * These helpers read the current language from i18n, which the React Compiler cannot see: it would
 * keep "8 days" after switching to नेपाली because `days(8)` looks unchanged (BUG-14). Every file that
 * imports from here starts with 'use no memo' so its components are re-rendered normally.
 */

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

/** 1234 -> "1,234" in English, "१,२३४" in Nepali. */
export function formatNumber(value: number, maxFractionDigits = 0): string {
  const text = value.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits });
  return i18n.language === 'ne' ? toNepaliDigits(text) : text;
}

export function toNepaliDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => NEPALI_DIGITS[Number(d)]);
}

export const meters = (m: number | null) =>
  m == null ? '—' : i18n.t('units.m', { value: formatNumber(m) });
export const km = (value: number | null) =>
  value == null ? '—' : i18n.t('units.km', { value: formatNumber(value, 1) });
export const npr = (value: number | null) =>
  value == null ? i18n.t('common.free') : i18n.t('units.npr', { value: formatNumber(value) });
export const days = (count: number) =>
  i18n
    .t('units.days', { count, value: formatNumber(count) })
    .replace(String(count), formatNumber(count));
export const monthName = (month: number) => i18n.t(`months.${month}`);
const shortMonth = (month: number) => i18n.t(`monthsShort.${month}`);

/** [11, 12, 1] -> "Nov–Jan"; months that are not one run -> "Mar, Oct"; all 12 -> "All year". */
export function monthRange(months: number[]): string {
  const set = new Set(months);
  if (set.size === 0) return '—';
  if (set.size === 12) return i18n.t('place.allYear');
  const prev = (m: number) => (m === 1 ? 12 : m - 1);
  const starts = [...set].filter((m) => !set.has(prev(m))).sort((a, b) => a - b);
  if (starts.length !== 1)
    return [...set]
      .sort((a, b) => a - b)
      .map(shortMonth)
      .join(', ');
  const first = starts[0];
  const last = ((first - 1 + set.size - 1) % 12) + 1;
  return first === last ? shortMonth(first) : `${shortMonth(first)}–${shortMonth(last)}`;
}

/**
 * Region, district and province are plain text in the database (English). Known names have a
 * Nepali form in ne.json; anything new from the admin panel is shown as it is (BUG-09).
 */
const placeName = (kind: 'region' | 'district' | 'province', value: string) =>
  i18n.t(`names.${kind}.${value}`, { defaultValue: value });
export const regionName = (value: string) => placeName('region', value);
export const districtName = (value: string) => placeName('district', value);
export const provinceName = (value: string) => placeName('province', value);

import i18n from '@/i18n';

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

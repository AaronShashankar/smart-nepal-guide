/**
 * Altitude sickness symptom checker: the Lake Louise AMS score, 2018 version (V2-P3-03).
 *
 * The same rules as backend/app/algorithms/lake_louise.py, so the check works with no internet.
 * Both copies are tested against backend/tests/data/lake_louise_cases.json (pytest, and
 * scripts/check-lake-louise.mjs in verify.sh), so they cannot drift apart.
 *
 * Keep this file free of imports and of TypeScript-only syntax that has runtime code (enums):
 * Node runs it directly in the check script.
 *
 *   total = headache + gi + fatigue + dizziness (each 0-3)
 *   AMS when headache >= 1 and total >= 3: mild 3-5, moderate 6-9, severe 10-12
 *   descend  any red flag, or moderate / severe AMS
 *   rest     mild AMS, or total >= 3 without a headache
 *   ok       total < 3
 *
 * Roach RC et al., "The 2018 Lake Louise Acute Mountain Sickness Score",
 * High Altitude Medicine & Biology 19(1), 2018.
 */

export type Symptom = 'headache' | 'gi' | 'fatigue' | 'dizziness';
export type RedFlag = 'confusion' | 'breathless' | 'worse_after_rest';
export type Severity = 'none' | 'mild' | 'moderate' | 'severe';
export type SymptomResult = 'ok' | 'rest' | 'descend';

export const SYMPTOMS: Symptom[] = ['headache', 'gi', 'fatigue', 'dizziness'];
export const RED_FLAGS: RedFlag[] = ['confusion', 'breathless', 'worse_after_rest'];

export type Answers = Record<Symptom, number> & { red_flags: RedFlag[] };

export interface LakeLouiseScore {
  total: number;
  severity: Severity;
  result: SymptomResult;
  /** Codes the app turns into text: RED_FLAG_*, AMS_MILD/MODERATE/SEVERE, NO_HEADACHE, LOW_SCORE */
  reasons: string[];
}

const MAX_ITEM = 3;
const AMS_MIN_TOTAL = 3;
const MODERATE_MIN_TOTAL = 6;
const SEVERE_MIN_TOTAL = 10;

export function severityOf(headache: number, total: number): Severity {
  if (headache < 1 || total < AMS_MIN_TOTAL) return 'none';
  if (total >= SEVERE_MIN_TOTAL) return 'severe';
  if (total >= MODERATE_MIN_TOTAL) return 'moderate';
  return 'mild';
}

export function scoreLakeLouise(answers: Answers): LakeLouiseScore {
  for (const name of SYMPTOMS) {
    const v = answers[name];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_ITEM) {
      throw new RangeError(`${name} must be a whole number from 0 to ${MAX_ITEM}`);
    }
  }
  for (const flag of answers.red_flags) {
    if (!RED_FLAGS.includes(flag)) throw new RangeError(`Unknown red flag: ${flag}`);
  }

  const total = answers.headache + answers.gi + answers.fatigue + answers.dizziness;
  const severity = severityOf(answers.headache, total);
  const flags = [...new Set(answers.red_flags)].sort();

  const reasons = flags.map((f) => `RED_FLAG_${f.toUpperCase()}`);
  if (severity !== 'none') reasons.push(`AMS_${severity.toUpperCase()}`);
  else if (total >= AMS_MIN_TOTAL) reasons.push('NO_HEADACHE');
  else reasons.push('LOW_SCORE');

  let result: SymptomResult = 'ok';
  if (flags.length > 0 || severity === 'moderate' || severity === 'severe') result = 'descend';
  else if (total >= AMS_MIN_TOTAL) result = 'rest';

  return { total, severity, result, reasons };
}

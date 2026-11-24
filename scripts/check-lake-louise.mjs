// Checks the app's Lake Louise score (mobile/src/lib/lakeLouise.ts) against the shared case table
// that pytest also uses (backend/tests/data/lake_louise_cases.json), so the offline copy in the app
// can't drift from the server. Node runs the .ts file directly (type stripping, Node >= 23.6).
// Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-lake-louise.mjs
// (run by ./scripts/verify.sh)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deepStrictEqual } from 'node:assert/strict';

import { scoreLakeLouise } from '../mobile/src/lib/lakeLouise.ts';

const table = new URL('../backend/tests/data/lake_louise_cases.json', import.meta.url);
const { cases } = JSON.parse(readFileSync(fileURLToPath(table), 'utf8'));

let failed = 0;
for (const c of cases) {
  try {
    deepStrictEqual(scoreLakeLouise(c.answers), c.expect);
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${c.name}\n${e.message}\n`);
  }
}

// Bad answers must be refused, as in the Python copy.
for (const bad of [
  { headache: 4, gi: 0, fatigue: 0, dizziness: 0, red_flags: [] },
  { headache: 1.5, gi: 0, fatigue: 0, dizziness: 0, red_flags: [] },
  { headache: 1, gi: 0, fatigue: 0, dizziness: 0, red_flags: ['dizzy'] },
]) {
  try {
    scoreLakeLouise(bad);
    failed += 1;
    console.error(`FAIL accepted bad answers ${JSON.stringify(bad)}`);
  } catch {
    // expected
  }
}

if (failed) {
  console.error(`${failed} Lake Louise check(s) failed`);
  process.exit(1);
}
console.log(`Lake Louise (app copy): ${cases.length} shared cases pass`);

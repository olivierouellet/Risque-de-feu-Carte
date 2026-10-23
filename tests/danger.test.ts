import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseRestrictions } from '../src/data/sopfeu';
import { alert, fireBan, inEffect, placeLevels, quebecTime } from '../src/danger';
import type { DangerReport } from '../src/types';

const restrictions = parseRestrictions(
  JSON.parse(readFileSync(new URL('./fixtures/mesures_test_zone_6.json', import.meta.url), 'utf8')),
);

// Same cases as the integration's test_today_moves_with_the_calendar.
describe('placeLevels', () => {
  const report: DangerReport = {
    zones: [
      { number: 1, name: 'A', levels: [2, 4, 3] },
      { number: 2, name: 'B', levels: [3, 1, null] },
    ],
    calculated: quebecTime(2026, 7, 1, 14, 30),
  };

  it('takes the highest of the zones', () => {
    expect(placeLevels(report, quebecTime(2026, 7, 1, 23, 59))).toEqual([3, 4, 3]);
  });

  it('moves today forward at midnight in Québec', () => {
    expect(placeLevels(report, quebecTime(2026, 7, 2, 0, 0))).toEqual([4, 3, null]);
    expect(placeLevels(report, quebecTime(2026, 7, 3, 9, 0))).toEqual([3, null, null]);
    expect(placeLevels(report, quebecTime(2026, 7, 4, 9, 0))).toEqual([null, null, null]);
  });
});

describe('fireBan and alert', () => {
  it('follows the measure dates', () => {
    expect(fireBan(restrictions, quebecTime(2026, 10, 22, 2, 41))).toBe(false);
    expect(fireBan(restrictions, quebecTime(2026, 10, 22, 2, 42))).toBe(true);
    expect(fireBan(restrictions, quebecTime(2026, 11, 2, 2, 42))).toBe(false);
    expect(inEffect(restrictions, quebecTime(2026, 11, 2, 2, 42))).toEqual([]);
  });

  it('turns on from the threshold, or with a ban when it counts', () => {
    expect(alert(3, false, 3, true)).toBe(true);
    expect(alert(2, false, 3, true)).toBe(false);
    expect(alert(2, true, 3, true)).toBe(true);
    expect(alert(2, true, 3, false)).toBe(false);
    expect(alert(null, false, 2, true)).toBe(false);
  });
});

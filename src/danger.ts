import { FIRE_BAN_TYPE, QUEBEC_TZ } from './const';
import type { DangerReport, FireZone, Restriction } from './types';

export const MINUTE = 60_000;
export const DAY = 86_400_000;
export const DAYS = 3;

const dayParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: QUEBEC_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Days since the epoch of the calendar day `t` falls on in Québec. */
export function dayNumber(t: number): number {
  const [y, m, d] = dayParts.format(t).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}

/** Days since the calculation: day 1 is the calculation's day, so before the next one, today is day 2. */
export function dayOffset(report: DangerReport, now: number): number {
  if (report.calculated === null) return 0;
  return Math.max(0, dayNumber(now) - dayNumber(report.calculated));
}

/** Today, tomorrow and the day after for one zone; null past the last calculated day. */
export function zoneLevels(zone: FireZone, offset: number): (number | null)[] {
  return Array.from({ length: DAYS }, (_, i) => (i + offset < DAYS ? (zone.levels[i + offset] ?? null) : null));
}

/** Today, tomorrow and the day after for the place: the highest of its zones (a municipality can span several). */
export function placeLevels(report: DangerReport, now: number): (number | null)[] {
  const offset = dayOffset(report, now);
  const byZone = report.zones.map((z) => zoneLevels(z, offset));
  return Array.from({ length: DAYS }, (_, i) => {
    const known = byZone.map((levels) => levels[i]).filter((l): l is number => l !== null);
    return known.length ? Math.max(...known) : null;
  });
}

/** The measures that have started and not ended. */
export function inEffect(restrictions: Restriction[], now: number): Restriction[] {
  return restrictions.filter((r) => (r.start === null || r.start <= now) && (r.end === null || now < r.end));
}

/** An open-fire ban in or near the forest applies to the place. */
export function fireBan(restrictions: Restriction[], now: number): boolean {
  return inEffect(restrictions, now).some((r) => r.type === FIRE_BAN_TYPE);
}

/** Today's danger reaches the threshold, or a fire ban applies when it counts (same rule as the integration). */
export function alert(level: number | null, banned: boolean, threshold: number, includeFireBan: boolean): boolean {
  return (level !== null && level >= threshold) || (includeFireBan && banned);
}

/** Offset of Québec time from UTC at `t`, in ms (−4 h in summer, −5 h in winter). */
function quebecOffset(t: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: QUEBEC_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
      .formatToParts(t)
      .map((p) => [p.type, Number(p.value)]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - Math.floor(t / MINUTE) * MINUTE;
}

/** Epoch ms of a Québec wall-clock time. */
export function quebecTime(year: number, month: number, day: number, hour: number, minute: number): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const guess = wall - quebecOffset(wall);
  return wall - quebecOffset(guess);
}

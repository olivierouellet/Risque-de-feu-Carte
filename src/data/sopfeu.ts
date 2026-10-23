import { API_URL, DEFAULT_INCLUDE_FIRE_BAN, DEFAULT_THRESHOLD, LEVEL_KEYS, RESTRICTION_FILTERS } from '../const';
import { quebecTime } from '../danger';
import type { DangerReport, FireData, FireZone, HassEntity, Municipality, Restriction } from '../types';

/** "2026-10-22 14:30:52" for the danger, "2026/10/22 02:39" for the measures. */
const DATE = /(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{1,2}):(\d{2})/;
const CACHE_PREFIX = 'risque-de-feu-carte:';
const DANGER_CACHE_MS = 30 * 60_000;
const LIST_CACHE_MS = 7 * 86_400_000;

type Json = Record<string, unknown>;

export function parseDate(text: unknown): number | null {
  const m = DATE.exec(typeof text === 'string' ? text : '');
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return quebecTime(y, mo, d, h, mi);
}

/** 1 (low) to 5 (extreme); null outside the season or when the value is unknown. */
export function parseLevel(day: unknown): number | null {
  const level = Number((day as Json | null)?.Id);
  return level in LEVEL_KEYS ? level : null;
}

/** The danger report, as served (`[[zones], {date}]`) or as documented (`{"Zones": [...], ...}`). */
export function parseDanger(data: unknown): DangerReport {
  let raw: unknown[];
  let meta: Json;
  if (Array.isArray(data) && Array.isArray(data[0])) {
    raw = data[0];
    meta = (data.slice(1).find((x) => x && typeof x === 'object') as Json) ?? {};
  } else if (data && typeof data === 'object' && !Array.isArray(data)) {
    meta = data as Json;
    raw = Array.isArray(meta.Zones) ? meta.Zones : [];
  } else {
    throw new Error('Unexpected danger response');
  }
  const zones = raw.map((item) => {
    const z = item as Json;
    const number = Number(z.NumeroZone);
    if (!Number.isInteger(number)) throw new Error('Unexpected danger zone');
    return {
      number,
      name: String(z.NomZone ?? '').trim(),
      levels: [parseLevel(z.DangerJour1), parseLevel(z.DangerJour2), parseLevel(z.DangerJour3)],
    };
  });
  return { zones, calculated: parseDate(meta.DateDernierCalculDanger) };
}

/** The measures, without their polygons. */
export function parseRestrictions(data: unknown): Restriction[] {
  if (!Array.isArray(data)) throw new Error('Unexpected measures response');
  return data.map((m: Json) => ({
    type: Number(m.TypeMesureId),
    rtfType: m.TypeRtfId === null || m.TypeRtfId === undefined ? null : Number(m.TypeRtfId),
    descriptionFr: String(m.DescriptionFr ?? '').trim(),
    descriptionEn: String(m.DescriptionEn ?? '').trim(),
    start: parseDate(m.DateDebut),
    end: parseDate(m.DateFin),
  }));
}

/** Québec's municipalities (type 3) with their administrative region (type 1), by name. */
export function parseMunicipalities(data: unknown): Municipality[] {
  if (!Array.isArray(data)) throw new Error('Unexpected geographic codes');
  const regions = new Map(data.filter((x: Json) => x.Type === 1).map((x: Json) => [String(x.CodeGeo), String(x.Nom)]));
  return data
    .filter((x: Json) => x.Type === 3 && x.CodeGeo && x.Nom)
    .map((x: Json) => ({
      code: String(x.CodeGeo),
      name: String(x.Nom),
      region: regions.get(String(x.RegionAdministrativeId)) ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Parsed results kept in this browser for `maxAge`; storage is optional (private windows, previews). */
async function cached<T>(key: string, maxAge: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) ?? 'null');
    if (hit && Date.now() - hit.at < maxAge) return hit.value as T;
  } catch {
    // no storage: fetch
  }
  const value = await load();
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // storage full or blocked: fine
  }
  return value;
}

async function getJson(path: string, query: string): Promise<unknown> {
  const response = await fetch(`${API_URL}/${path}${query ? `?${query}` : ''}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** Query for one place. Coordinates are rounded to about 100 m: enough for a zone, and kinder to privacy. */
export function placeQuery(place: { zone?: number; municipality?: string; latitude?: number; longitude?: number }) {
  if (place.municipality) return `noMun=${encodeURIComponent(place.municipality)}`;
  if (place.zone !== undefined) return `noZdi=${place.zone}`;
  if (place.latitude === undefined || place.longitude === undefined) throw new Error('No place');
  return `lat=${place.latitude.toFixed(3)}&lon=${place.longitude.toFixed(3)}`;
}

export function fetchDanger(query: string): Promise<DangerReport> {
  return cached(`danger:${query}`, DANGER_CACHE_MS, async () => parseDanger(await getJson('danger-incendie', query)));
}

export function fetchRestrictions(query: string): Promise<Restriction[]> {
  return cached(`measures:${query}`, DANGER_CACHE_MS, async () =>
    parseRestrictions(await getJson('mesures-preventives', `${RESTRICTION_FILTERS}&${query}`)),
  );
}

/** Every zone's number and name, for the editor. */
export function fetchZones(): Promise<{ number: number; name: string }[]> {
  return cached('zones', LIST_CACHE_MS, async () =>
    parseDanger(await getJson('danger-incendie', ''))
      .zones.map(({ number, name }) => ({ number, name }))
      .sort((a, b) => a.number - b.number),
  );
}

export function fetchMunicipalities(): Promise<Municipality[]> {
  return cached('municipalities', LIST_CACHE_MS, async () =>
    parseMunicipalities(await getJson('codes-geographiques', '')),
  );
}

/** This device's position; the browser asks for permission, and needs HTTPS. */
export function devicePosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('No geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      reject,
      { maximumAge: 3_600_000, timeout: 30_000 },
    );
  });
}

const toTime = (value: unknown) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? Date.parse(value) : null;
const toLevel = (value: unknown) => (value === null || value === undefined ? null : parseLevel({ Id: value }));

/** The Alert sensor of the Risque de feu integration: its levels, zones and measures. */
export function fromEntity(stateObj: HassEntity): FireData | null {
  const a = stateObj.attributes;
  if (!Array.isArray(a.fire_zones)) return null;
  const zones: FireZone[] = a.fire_zones.map((z: Json) => ({
    number: Number(z.number),
    name: String(z.name ?? ''),
    levels: Array.isArray(z.levels) ? z.levels.map(toLevel) : [],
  }));
  const restrictions: Restriction[] = (Array.isArray(a.restrictions) ? a.restrictions : []).map((r: Json) => ({
    type: Number(r.type),
    rtfType: r.rtf_type === null || r.rtf_type === undefined ? null : Number(r.rtf_type),
    descriptionFr: String(r.description_fr ?? ''),
    descriptionEn: String(r.description_en ?? ''),
    start: toTime(r.start),
    end: toTime(r.end),
  }));
  return {
    place: typeof a.place === 'string' ? a.place : undefined,
    levels: Array.isArray(a.levels) ? a.levels.map(toLevel) : [null, null, null],
    zones,
    restrictions,
    fireBan: a.fire_ban === true,
    calculated: toTime(a.calculated),
    threshold: Number(a.threshold ?? DEFAULT_THRESHOLD),
    includeFireBan: a.include_fire_ban === undefined ? DEFAULT_INCLUDE_FIRE_BAN : a.include_fire_ban === true,
    alert: stateObj.state === 'on' ? true : stateObj.state === 'off' ? false : undefined,
  };
}

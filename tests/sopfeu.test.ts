import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  fromEntity,
  parseDanger,
  parseDate,
  parseMunicipalities,
  parseRestrictions,
  placeQuery,
} from '../src/data/sopfeu';
import { quebecTime } from '../src/danger';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

describe('parseDanger', () => {
  it('reads the recorded SOPFEU response', () => {
    const report = parseDanger(fixture('danger_saguenay.json'));
    expect(report).toEqual({
      zones: [{ number: 31, name: 'Saguenay', levels: [2, 1, 1] }],
      calculated: quebecTime(2026, 10, 22, 14, 30),
    });
    expect(parseDanger(fixture('danger_la_tuque.json')).zones).toHaveLength(8);
  });

  it('accepts the documented shape and unknown levels', () => {
    const report = parseDanger({
      Zones: [{ NumeroZone: 12, NomZone: 'Pontiac', DangerJour1: { Id: 0 }, DangerJour2: null }],
      DateDernierCalculDanger: '2024/06/08 14:11:23',
    });
    expect(report.zones[0].levels).toEqual([null, null, null]);
    expect(report.calculated).toBe(quebecTime(2024, 6, 8, 14, 11));
  });

  it('rejects responses it does not understand', () => {
    expect(() => parseDanger('<html>')).toThrow('Unexpected danger response');
    expect(() => parseDanger([[{ NomZone: 'sans numéro' }], {}])).toThrow('Unexpected danger zone');
    expect(parseDate('bientôt')).toBeNull();
  });
});

describe('parseRestrictions and parseMunicipalities', () => {
  it('reads the recorded measures', () => {
    const restrictions = parseRestrictions(fixture('mesures_test_zone_6.json'));
    expect(restrictions.map((r) => [r.type, r.rtfType])).toEqual([
      [2, 3],
      [1, null],
      [2, 1],
    ]);
    expect(restrictions[1].descriptionEn).toBe('Ban on open fires');
    expect(restrictions[1].end).toBe(quebecTime(2026, 11, 2, 2, 42));
  });

  it('keeps municipalities with their region, sorted by name', () => {
    const municipalities = parseMunicipalities(fixture('codes_geographiques.json'));
    expect(municipalities.map((m) => m.name)).toEqual([
      'Eeyou Istchee Baie-James',
      'Gaspé',
      'La Tuque',
      'Montréal',
      'Québec',
      'Saguenay',
    ]);
    expect(municipalities[1]).toEqual({ code: '03005', name: 'Gaspé', region: 'Gaspésie - Îles-de-la-Madeleine' });
  });
});

describe('placeQuery', () => {
  it('builds one query per kind of place', () => {
    expect(placeQuery({ zone: 31 })).toBe('noZdi=31');
    expect(placeQuery({ municipality: '03005' })).toBe('noMun=03005');
    expect(placeQuery({ latitude: 48.43123, longitude: -71.06789 })).toBe('lat=48.431&lon=-71.068');
    expect(() => placeQuery({})).toThrow('No place');
  });
});

describe('fromEntity', () => {
  it('reads the integration Alert sensor attributes', () => {
    const data = fromEntity({
      entity_id: 'binary_sensor.risque_de_feu_saguenay_alerte',
      state: 'off',
      last_updated: '',
      attributes: {
        place: 'Saguenay',
        level: 2,
        levels: [2, 1, null],
        threshold: 4,
        include_fire_ban: false,
        fire_ban: true,
        fire_zones: [{ number: 31, name: 'Saguenay', levels: [2, 1, null] }],
        restrictions: [
          {
            type: 1,
            rtf_type: null,
            description_fr: 'Interdiction',
            description_en: 'Ban on open fires',
            start: '2026-10-22T02:42:00-04:00',
            end: null,
          },
        ],
        calculated: '2026-10-22T14:30:00-04:00',
      },
    });
    expect(data).toEqual({
      place: 'Saguenay',
      levels: [2, 1, null],
      zones: [{ number: 31, name: 'Saguenay', levels: [2, 1, null] }],
      restrictions: [
        {
          type: 1,
          rtfType: null,
          descriptionFr: 'Interdiction',
          descriptionEn: 'Ban on open fires',
          start: quebecTime(2026, 10, 22, 2, 42),
          end: null,
        },
      ],
      fireBan: true,
      calculated: quebecTime(2026, 10, 22, 14, 30),
      threshold: 4,
      includeFireBan: false,
      alert: false,
    });
  });

  it('ignores other entities', () => {
    expect(fromEntity({ entity_id: 'sensor.x', state: '1', last_updated: '', attributes: {} })).toBeNull();
  });
});

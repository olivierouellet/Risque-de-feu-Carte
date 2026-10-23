/**
 * Dev harness: renders the card in several situations with a mock `hass`, plus minimal
 * stand-ins for ha-card and ha-icon. Run with `yarn start`. URL options: `?dark&lang=en&width=320`.
 */
import '../src/risque-de-feu-carte';
import type { RisqueDeFeuCarte } from '../src/risque-de-feu-carte';
import type { HassEntity, HomeAssistant, RisqueDeFeuCarteConfig } from '../src/types';
import { quebecTime } from '../src/danger';
import * as mdi from '@mdi/js';

class HaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = `<style>:host{display:block;background:var(--card-background-color);
      border-radius:var(--ha-card-border-radius);box-shadow:var(--ha-card-box-shadow);color:var(--primary-text-color)}</style><slot></slot>`;
  }
}
customElements.define('ha-card', HaCard);

/** Real Material Design Icons, as Home Assistant draws them, so screenshots match. */
class HaIcon extends HTMLElement {
  static observedAttributes = ['icon'];
  attributeChangedCallback() {
    const name = (this.getAttribute('icon') ?? '').replace(/^mdi:/, '');
    const key = 'mdi' + name.replace(/(^|-)(\w)/g, (_, _dash, c: string) => c.toUpperCase());
    const path = (mdi as Record<string, string>)[key] ?? '';
    // In a shadow root: light-DOM children would shift the nodes Lit binds to while it clones templates.
    this.style.cssText = 'display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)';
    (this.shadowRoot ?? this.attachShadow({ mode: 'open' })).innerHTML =
      `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="${path}"/></svg>`;
  }
}
customElements.define('ha-icon', HaIcon);

const params = new URLSearchParams(location.search);
if (params.has('dark')) document.body.classList.add('dark');
// Phone-width check: ?width=320 lays the cards out in one column of that width.
if (params.get('width')) document.getElementById('cards')!.style.gridTemplateColumns = `${params.get('width')}px`;

const NOW = quebecTime(2026, 10, 22, 16, 0);
const iso = (y: number, m: number, d: number, h: number, mi: number) =>
  new Date(quebecTime(y, m, d, h, mi)).toISOString();
const CALCULATED = iso(2026, 10, 22, 14, 30);
const restriction = (type: number, rtf: number | null, fr: string, en: string) => ({
  type,
  rtf_type: rtf,
  description_fr: fr,
  description_en: en,
  start: iso(2026, 10, 22, 2, 42),
  end: iso(2026, 11, 2, 2, 42),
});

/** An Alert sensor as the integration publishes it. */
function alertSensor(
  id: string,
  place: string,
  zones: Array<[number, string, (number | null)[]]>,
  extra: Partial<{ fire_ban: boolean; restrictions: unknown[]; threshold: number }> = {},
): HassEntity {
  const levels = [0, 1, 2].map((i) => {
    const known = zones.map((z) => z[2][i]).filter((l): l is number => l !== null);
    return known.length ? Math.max(...known) : null;
  });
  return {
    entity_id: id,
    // The card trusts the sensor's on/off; let it compute the alert here.
    state: 'unknown',
    last_updated: '',
    attributes: {
      place,
      level: levels[0],
      levels,
      threshold: extra.threshold ?? 3,
      include_fire_ban: true,
      fire_ban: extra.fire_ban ?? false,
      fire_zones: zones.map(([number, name, l]) => ({ number, name, levels: l })),
      restrictions: extra.restrictions ?? [],
      calculated: CALCULATED,
    },
  };
}

const states = [
  alertSensor('binary_sensor.risque_de_feu_saguenay_alerte', 'Saguenay', [[31, 'Saguenay', [2, 1, 1]]]),
  alertSensor(
    'binary_sensor.risque_de_feu_megiscane_gouin_alerte',
    'Mégiscane-Gouin',
    [[6, 'Mégiscane-Gouin', [3, 4, 3]]],
    {
      fire_ban: true,
      restrictions: [
        restriction(2, 3, 'Restriction de travaux en forêt (8H/20H)', 'Forestry operations restrictions (8h/20h)'),
        restriction(
          1,
          null,
          'Interdiction de faire des feux à ciel ouvert en forêt ou à proximité',
          'Ban on open fires',
        ),
      ],
    },
  ),
  alertSensor('binary_sensor.risque_de_feu_la_tuque_alerte', 'La Tuque', [
    [26, 'La Tuque', [4, 5, 5]],
    [25, 'St-Maurice-Mastigouche', [3, 4, 4]],
    [30, 'Réserve Laurentides', [2, 3, 3]],
  ]),
  alertSensor('binary_sensor.risque_de_feu_gaspe_alerte', 'Gaspé', [[49, 'Gaspé', [null, null, null]]]),
];
const hass: HomeAssistant = {
  language: params.get('lang') ?? 'fr',
  config: { latitude: 48.43, longitude: -71.07 },
  states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
};

const scenarios: Array<{ label: string; config: Partial<RisqueDeFeuCarteConfig>; preview?: boolean }> = [
  { label: 'Modéré · Saguenay', config: { entity: 'binary_sensor.risque_de_feu_saguenay_alerte' } },
  { label: 'Élevé + interdiction', config: { entity: 'binary_sensor.risque_de_feu_megiscane_gouin_alerte' } },
  {
    label: 'English',
    config: { entity: 'binary_sensor.risque_de_feu_megiscane_gouin_alerte', language: 'en' },
  },
  { label: 'Très élevé · municipalité sur 3 zones', config: { entity: 'binary_sensor.risque_de_feu_la_tuque_alerte' } },
  { label: 'Hors saison', config: { entity: 'binary_sensor.risque_de_feu_gaspe_alerte' } },
  {
    label: 'Masquée sous le seuil (édition)',
    config: { entity: 'binary_sensor.risque_de_feu_saguenay_alerte', hide_below_threshold: true },
    preview: true,
  },
  {
    label: 'Compacte',
    config: {
      entity: 'binary_sensor.risque_de_feu_la_tuque_alerte',
      show_scale: false,
      show_links: false,
      title: 'Chalet',
    },
  },
  { label: 'Direct · domicile (réseau)', config: { location: 'home' } },
];

// README screenshots: ?shot shows French and English with a fire ban, without labels.
const shown = params.has('shot') ? [scenarios[1], scenarios[2]] : scenarios;
if (params.has('shot')) document.body.classList.add('shot');

const grid = document.getElementById('cards')!;
for (const s of shown) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.innerHTML = `<h3>${s.label}</h3>`;
  const card = document.createElement('risque-de-feu-carte') as RisqueDeFeuCarte;
  card.setConfig({ type: 'custom:risque-de-feu-carte', ...s.config });
  if (s.config.entity) card.now = NOW;
  card.preview = !!s.preview;
  card.hass = hass;
  cell.append(card);
  grid.append(cell);
}

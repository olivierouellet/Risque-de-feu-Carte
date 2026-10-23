import { LitElement, html, css, nothing, PropertyValues, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { DangerReport, FireData, HomeAssistant, Restriction, RisqueDeFeuCarteConfig } from './types';
import {
  CARD_TAG,
  CARD_VERSION,
  DARK_TEXT_LEVELS,
  DEFAULT_ICON,
  DEFAULT_INCLUDE_FIRE_BAN,
  DEFAULT_THRESHOLD,
  EDITOR_TAG,
  FIRE_BAN_TYPE,
  INFO_URL,
  LEVEL_COLORS,
  LEVELS,
  MAP_URL,
  QUEBEC_TZ,
  RESTRICTIONS_URL,
} from './const';
import {
  devicePosition,
  fetchDanger,
  fetchMunicipalities,
  fetchRestrictions,
  fromEntity,
  placeQuery,
} from './data/sopfeu';
import { DAY, alert, dayNumber, dayOffset, fireBan, inEffect, placeLevels, zoneLevels } from './danger';
import { Lang, intlLocale, localize, resolveLanguage } from './localize/localize';

console.info(
  `%c  RISQUE-DE-FEU-CARTE \n%c  Version ${CARD_VERSION}    `,
  'color: #c92127; font-weight: bold; background: #fdecea',
  'color: white; font-weight: bold; background: #c92127',
);

interface WindowWithCustomCards extends Window {
  customCards: Array<{ type: string; name: string; description: string; preview?: boolean; documentationURL?: string }>;
}
const w = window as unknown as WindowWithCustomCards;
w.customCards = w.customCards || [];
w.customCards.push({
  type: CARD_TAG,
  name: 'Risque-de-feu-Carte',
  description:
    'Danger d’incendie de forêt au Québec (SOPFEU) · Québec forest fire danger. Intégration Risque de feu ou SOPFEU. FR / EN.',
  preview: true,
  documentationURL: 'https://github.com/olivierouellet/Risque-de-feu-Carte',
});

const DEFAULTS = {
  hide_below_threshold: false,
  show_scale: true,
  show_forecast: true,
  show_restrictions: true,
  show_links: true,
  language: 'auto',
} as const;

type ResolvedConfig = RisqueDeFeuCarteConfig & Required<Pick<RisqueDeFeuCarteConfig, keyof typeof DEFAULTS>>;

/** Direct mode looks again this often; the browser cache answers in between. */
const REFRESH_MS = 30 * 60_000;
const SOURCES = ['entity', 'zone', 'municipality', 'location'] as const;

@customElement(CARD_TAG)
export class RisqueDeFeuCarte extends LitElement {
  public static async getConfigElement(): Promise<HTMLElement> {
    await import('./editor');
    return document.createElement(EDITOR_TAG);
  }

  /** Default config when the card is added from the picker: the integration's sensor, else the home location. */
  public static getStubConfig(hass: HomeAssistant): Partial<RisqueDeFeuCarteConfig> {
    const sensor = Object.values(hass.states).find((s) => Array.isArray(s.attributes.fire_zones));
    return sensor ? { entity: sensor.entity_id } : { location: 'home' };
  }

  @property({ attribute: false }) public preview = false;

  @state() private _config?: ResolvedConfig;
  @state() private _report?: DangerReport;
  @state() private _restrictions: Restriction[] = [];
  @state() private _place?: string;
  @state() private _error?: string;
  @state() private _locating = false;
  /** Set by the dev harness to try other dates. */
  @state() public now?: number;
  @state() private _tick = Date.now();

  private _hass?: HomeAssistant;
  private _fetchedAt = 0;
  private _timer?: number;

  public setConfig(config: RisqueDeFeuCarteConfig): void {
    if (!config) throw new Error('Invalid configuration');
    if (SOURCES.filter((key) => config[key] !== undefined && config[key] !== '').length > 1) {
      throw new Error(localize('card.many_sources', 'fr'));
    }
    const previous = this._config;
    this._config = { ...DEFAULTS, ...config } as ResolvedConfig;
    if (SOURCES.some((key) => previous?.[key] !== config[key])) {
      this._fetchedAt = 0;
      this._report = undefined;
      this._restrictions = [];
      this._error = undefined;
    }
    this._maybeFetch();
    this._updateHidden();
  }

  /** Set synchronously so Home Assistant sees `hidden` in the same update and collapses the card's space. */
  public get hass(): HomeAssistant | undefined {
    return this._hass;
  }
  public set hass(hass: HomeAssistant | undefined) {
    const old = this._hass;
    this._hass = hass;
    if (!old) this._maybeFetch();
    this._updateHidden();
    this.requestUpdate('hass', old);
  }

  public getCardSize(): number {
    return 4;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: 'auto' as const };
  }

  public connectedCallback(): void {
    super.connectedCallback();
    // "Today" moves at midnight; a minute is plenty.
    this._timer = window.setInterval(() => {
      this._tick = Date.now();
      this._maybeFetch();
      this._updateHidden();
    }, 60_000);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this._timer);
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('preview') || changed.has('now') || changed.has('_report')) this._updateHidden();
  }

  private _now(): number {
    return this.now ?? this._tick;
  }

  private _direct(): boolean {
    const cfg = this._config;
    return !!cfg && !cfg.entity && (cfg.zone !== undefined || !!cfg.municipality || !!cfg.location);
  }

  private _maybeFetch(): void {
    if (!this._direct() || !this._hass) return;
    if (Date.now() - this._fetchedAt < REFRESH_MS) return;
    this._fetchedAt = Date.now();
    this._fetch().catch((err) => {
      console.warn('Risque-de-feu-Carte:', err);
      this._fetchedAt = Date.now() - REFRESH_MS + 300_000; // retry in 5 minutes
      if (!this._report) this._error = this._locating ? 'card.location_failed' : 'card.fetch_failed';
      this._locating = false;
    });
  }

  private async _fetch(): Promise<void> {
    const cfg = this._config!;
    let query: string;
    let place: string | undefined;
    if (cfg.municipality) {
      // A code, or a name typed in the YAML.
      const wanted = String(cfg.municipality).trim();
      const municipality = /^\d+$/.test(wanted)
        ? { code: wanted, name: undefined }
        : (await fetchMunicipalities()).find((m) => m.name.localeCompare(wanted, 'fr', { sensitivity: 'base' }) === 0);
      if (!municipality) throw new Error(`Unknown municipality: ${wanted}`);
      query = placeQuery({ municipality: municipality.code });
      place = municipality.name ?? (await fetchMunicipalities()).find((m) => m.code === municipality.code)?.name;
    } else if (cfg.zone !== undefined) {
      query = placeQuery({ zone: Number(cfg.zone) });
    } else if (cfg.location === 'device') {
      this._locating = true;
      query = placeQuery(await devicePosition());
      this._locating = false;
    } else {
      query = placeQuery({ latitude: this._hass?.config?.latitude, longitude: this._hass?.config?.longitude });
    }
    const [report, restrictions] = await Promise.all([fetchDanger(query), fetchRestrictions(query)]);
    this._report = report;
    this._restrictions = restrictions;
    this._place = place;
    this._error = undefined;
  }

  /** The levels, zones and measures to show, from the sensor or from the direct download. */
  private _data(): FireData | null {
    const cfg = this._config;
    if (!cfg) return null;
    if (cfg.entity) {
      const stateObj = this._hass?.states[cfg.entity];
      return stateObj ? fromEntity(stateObj) : null;
    }
    if (!this._report) return null;
    const now = this._now();
    const offset = dayOffset(this._report, now);
    const zones = this._report.zones.map((z) => ({ ...z, levels: zoneLevels(z, offset) }));
    return {
      place: this._place ?? (zones.length === 1 ? zones[0].name : undefined),
      levels: placeLevels(this._report, now),
      zones,
      restrictions: inEffect(this._restrictions, now),
      fireBan: fireBan(this._restrictions, now),
      calculated: this._report.calculated,
      threshold: cfg.threshold ?? DEFAULT_THRESHOLD,
      includeFireBan: cfg.include_fire_ban ?? DEFAULT_INCLUDE_FIRE_BAN,
    };
  }

  private _belowThreshold(): boolean {
    const data = this._data();
    if (!data) return false;
    return !(data.alert ?? alert(data.levels[0], data.fireBan, data.threshold, data.includeFireBan));
  }

  /** `hide_below_threshold`: hidden on the dashboard, never while editing it. */
  private _updateHidden(): void {
    const hidden = !!this._config?.hide_below_threshold && !this.preview && this._belowThreshold();
    if (this.hidden !== hidden) {
      this.hidden = hidden;
      this.dispatchEvent(new Event('card-visibility-changed', { bubbles: true, composed: true }));
    }
  }

  protected render(): TemplateResult | typeof nothing {
    const cfg = this._config;
    if (!cfg || !this._hass || this.hidden) return nothing;
    const lang = resolveLanguage(cfg.language, this._hass);
    const t = (key: string, vars?: Record<string, string>) => localize(key, lang, vars);

    const data = this._data();
    let message: string | undefined;
    if (!cfg.entity && !this._direct()) message = t('card.no_source');
    else if (cfg.entity && !this._hass.states[cfg.entity]) message = t('card.entity_not_found', { entity: cfg.entity });
    else if (cfg.entity && !data) message = t('card.no_fire_data', { entity: cfg.entity });
    else if (this._error) message = t(this._error);

    return html`
      <ha-card>
        <div class="header">
          <ha-icon icon=${cfg.icon || DEFAULT_ICON}></ha-icon>
          <div class="title">${cfg.title || t('card.default_title')}</div>
          ${data?.place ? html`<div class="place">${data.place}</div>` : nothing}
        </div>
        ${
          message
            ? html`<div class="message">${message}</div>`
            : !data
              ? html`<div class="message muted">${t(this._locating ? 'card.locating' : 'card.loading')}</div>`
              : this._renderData(data, lang)
        }
        ${
          cfg.hide_below_threshold && this.preview && this._belowThreshold()
            ? html`<div class="note"><ha-icon icon="mdi:eye-off-outline"></ha-icon>${t('card.hidden_note')}</div>`
            : nothing
        }
        ${cfg.show_links ? this._renderLinks(data, lang) : nothing}
      </ha-card>
    `;
  }

  private _renderData(data: FireData, lang: Lang): TemplateResult {
    const cfg = this._config!;
    const t = (key: string, vars?: Record<string, string>) => localize(key, lang, vars);
    const today = data.levels[0] ?? null;
    return html`
      ${
        today === null
          ? html`<div class="message muted">${t('card.off_season')}</div>`
          : html`
              <div class="today" style=${this._levelStyle(today)}>
                <div class="tile"><ha-icon icon="mdi:fire"></ha-icon></div>
                <div class="today-text">
                  <div class="label">${t('card.danger_today')}</div>
                  <div class="level">${t(`card.level_${today}`)}</div>
                  ${
                    data.zones.length > 1
                      ? html`<div class="zones-note">${t('card.zones', { count: String(data.zones.length) })}</div>`
                      : nothing
                  }
                </div>
              </div>
              ${cfg.show_scale ? this._renderScale(today, data.threshold, lang) : nothing}
            `
      }
      ${cfg.show_forecast && data.levels.some((l) => l !== null) ? this._renderForecast(data, lang) : nothing}
      ${cfg.show_restrictions ? this._renderRestrictions(data, lang) : nothing}
    `;
  }

  /** CSS variables for one level: its colour, and a readable text colour on it. */
  private _levelStyle(level: number): string {
    return `--level-color:${LEVEL_COLORS[level]};--level-text:${DARK_TEXT_LEVELS.has(level) ? '#212121' : '#ffffff'}`;
  }

  /** The five levels side by side, today's one solid; a tick marks the alert threshold. */
  private _renderScale(today: number, threshold: number, lang: Lang): TemplateResult {
    return html`
      <div class="scale" role="img" aria-label=${localize(`card.level_${today}`, lang)}>
        ${LEVELS.map(
          (level) =>
            html`<div
              class="step ${level === today ? 'current' : ''} ${level === threshold ? 'threshold' : ''}"
              style=${this._levelStyle(level)}
              title=${localize(`card.level_${level}`, lang)}
            ></div>`,
        )}
      </div>
    `;
  }

  private _renderForecast(data: FireData, lang: Lang): TemplateResult {
    const now = this._now();
    // The Québec calendar day after tomorrow, named at noon UTC of that date.
    const weekday = new Intl.DateTimeFormat(intlLocale(lang), { timeZone: 'UTC', weekday: 'long' });
    const labels = [
      localize('card.today', lang),
      localize('card.tomorrow', lang),
      capitalize(weekday.format((dayNumber(now) + 2) * DAY + DAY / 2)),
    ];
    return html`
      <div class="forecast">
        ${data.levels.map(
          (level, i) => html`
            <div class="day">
              <div class="day-label">${labels[i]}</div>
              ${
                level === null
                  ? html`<div class="chip unknown">${localize('card.unknown', lang)}</div>`
                  : html`<div class="chip" style=${this._levelStyle(level)}>
                      ${localize(`card.level_${level}`, lang)}
                    </div>`
              }
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderRestrictions(data: FireData, lang: Lang): TemplateResult | typeof nothing {
    const t = (key: string, vars?: Record<string, string>) => localize(key, lang, vars);
    const date = new Intl.DateTimeFormat(intlLocale(lang), { timeZone: QUEBEC_TZ, day: 'numeric', month: 'long' });
    const when = (r: Restriction) =>
      r.end !== null
        ? t('card.until', { date: date.format(r.end) })
        : r.start !== null
          ? t('card.since', { date: date.format(r.start) })
          : '';
    const ban = data.restrictions.find((r) => r.type === FIRE_BAN_TYPE);
    const others = data.restrictions.filter((r) => r.type !== FIRE_BAN_TYPE);
    if (!data.fireBan && !others.length) return nothing;
    return html`
      ${
        data.fireBan
          ? html`<div class="ban">
              <ha-icon icon="mdi:campfire"></ha-icon>
              <div>
                <div class="ban-title">${t('card.fire_ban')}</div>
                <div class="ban-detail">
                  ${ban && when(ban) ? `${capitalize(when(ban))} · ` : ''}${t('card.fire_ban_detail')}
                </div>
              </div>
            </div>`
          : nothing
      }
      ${
        others.length
          ? html`<ul class="measures">
              ${others.map(
                (r) =>
                  html`<li>
                    <span>${lang === 'fr' ? r.descriptionFr : r.descriptionEn || r.descriptionFr}</span>
                    <span class="muted">${when(r)}</span>
                  </li>`,
              )}
            </ul>`
          : nothing
      }
    `;
  }

  private _renderLinks(data: FireData | null, lang: Lang): TemplateResult {
    const t = (key: string, vars?: Record<string, string>) => localize(key, lang, vars);
    const calculated = new Intl.DateTimeFormat(intlLocale(lang), {
      timeZone: QUEBEC_TZ,
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
    });
    const link = (href: string, icon: string, label: string) =>
      html`<a href=${href} target="_blank" rel="noopener noreferrer"><ha-icon icon=${icon}></ha-icon>${label}</a>`;
    return html`
      <div class="footer">
        ${
          data?.calculated
            ? html`<span class="muted">${t('card.calculated', { date: calculated.format(data.calculated) })}</span>`
            : nothing
        }
        <span class="links">
          ${link(INFO_URL[lang], 'mdi:open-in-new', t('card.link_info'))}
          ${link(MAP_URL[lang], 'mdi:map-outline', t('card.link_map'))}
          ${link(RESTRICTIONS_URL[lang], 'mdi:clipboard-alert-outline', t('card.link_restrictions'))}
        </span>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    :host([hidden]) {
      display: none;
    }
    ha-card {
      padding: 12px 16px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .header ha-icon {
      color: var(--error-color, #db4437);
    }
    .title {
      font-size: 1.15em;
      font-weight: 500;
    }
    .place {
      margin-left: auto;
      color: var(--secondary-text-color);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .today {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .tile {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: var(--level-color);
      color: var(--level-text);
      --mdc-icon-size: 30px;
    }
    .today-text {
      flex: 1;
      min-width: 0;
    }
    .label {
      font-size: 0.85em;
      color: var(--secondary-text-color);
    }
    .level {
      font-size: 1.6em;
      font-weight: 500;
      line-height: 1.2;
    }
    .zones-note {
      font-size: 0.85em;
      color: var(--secondary-text-color);
    }
    .scale {
      display: flex;
      gap: 4px;
      margin-top: 12px;
    }
    .step {
      position: relative;
      flex: 1;
      height: 8px;
      border-radius: 4px;
      background: var(--level-color);
      opacity: 0.3;
    }
    .step.current {
      opacity: 1;
      height: 12px;
      margin-top: -2px;
      box-shadow:
        0 0 0 2px var(--card-background-color, #fff),
        0 0 0 3px var(--primary-text-color);
    }
    /* The alert threshold: a small tick at the left of its level. */
    .step.threshold::before {
      content: '';
      position: absolute;
      left: -3px;
      top: -5px;
      bottom: -5px;
      width: 2px;
      border-radius: 1px;
      background: var(--secondary-text-color);
    }
    .forecast {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 16px;
    }
    .day {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }
    .day-label {
      font-size: 0.85em;
      color: var(--secondary-text-color);
    }
    .chip {
      max-width: 100%;
      box-sizing: border-box;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.9em;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      background: var(--level-color);
      color: var(--level-text);
    }
    .chip.unknown {
      background: var(--secondary-background-color, rgba(127, 127, 127, 0.15));
      color: var(--secondary-text-color);
    }
    .ban {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
      padding: 8px 12px;
      border-radius: 12px;
      background: color-mix(in srgb, #c92127 14%, transparent);
      --mdc-icon-size: 28px;
    }
    .ban ha-icon {
      color: #c92127;
      flex-shrink: 0;
    }
    .ban-title {
      font-weight: 500;
    }
    .ban-detail {
      font-size: 0.85em;
      color: var(--secondary-text-color);
    }
    .measures {
      margin: 12px 0 0;
      padding: 0 0 0 18px;
      font-size: 0.9em;
    }
    .measures li + li {
      margin-top: 4px;
    }
    .measures .muted {
      margin-left: 4px;
    }
    .message {
      padding: 8px 0;
    }
    .muted {
      color: var(--secondary-text-color);
    }
    .note {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 12px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      --mdc-icon-size: 18px;
    }
    .footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 4px 16px;
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid var(--divider-color);
      font-size: 0.85em;
    }
    .links {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px 12px;
    }
    .links a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--primary-color);
      text-decoration: none;
      --mdc-icon-size: 16px;
    }
    .links a:hover {
      text-decoration: underline;
    }
  `;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

declare global {
  interface HTMLElementTagNameMap {
    'risque-de-feu-carte': RisqueDeFeuCarte;
  }
}

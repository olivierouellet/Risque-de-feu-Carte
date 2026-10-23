import { LitElement, html, css, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { HomeAssistant, Municipality, RisqueDeFeuCarteConfig } from './types';
import {
  DEFAULT_ICON,
  DEFAULT_INCLUDE_FIRE_BAN,
  DEFAULT_THRESHOLD,
  EDITOR_TAG,
  INTEGRATION_DOMAIN,
  LEVELS,
} from './const';
import { fetchMunicipalities, fetchZones } from './data/sopfeu';
import { Lang, localize, resolveLanguage } from './localize/localize';

type Source = 'sensor' | 'zone' | 'municipality' | 'home' | 'device';
const SOURCES: Source[] = ['sensor', 'zone', 'municipality', 'home', 'device'];

/** Values the editor shows when the config does not set them (same as the card's defaults). */
const FORM_DEFAULTS: Partial<RisqueDeFeuCarteConfig> = {
  hide_below_threshold: false,
  show_scale: true,
  show_forecast: true,
  show_restrictions: true,
  show_links: true,
  language: 'auto',
};

interface FormSchema {
  name: string;
  type?: string;
  title?: string;
  flatten?: boolean;
  expanded?: boolean;
  selector?: Record<string, unknown>;
  schema?: FormSchema[];
}

function sourceOf(config: RisqueDeFeuCarteConfig): Source | undefined {
  if (config.entity) return 'sensor';
  if (config.zone !== undefined) return 'zone';
  if (config.municipality) return 'municipality';
  return config.location;
}

@customElement(EDITOR_TAG)
export class RisqueDeFeuCarteEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config?: RisqueDeFeuCarteConfig;
  @state() private _zones?: { number: number; name: string }[];
  @state() private _municipalities?: Municipality[];
  @state() private _listFailed = false;

  public setConfig(config: RisqueDeFeuCarteConfig): void {
    this._config = config;
  }

  private get _lang(): Lang {
    return resolveLanguage(this._config?.language, this.hass);
  }

  private _t(key: string): string {
    return localize(key, this._lang);
  }

  /** The integration's Alert sensors (the ones carrying `fire_zones`). */
  private _alertSensors(): string[] {
    return Object.values(this.hass.states)
      .filter((s) => Array.isArray(s.attributes.fire_zones))
      .map((s) => s.entity_id);
  }

  private _currentSource(): Source {
    return sourceOf(this._config!) ?? (this._alertSensors().length ? 'sensor' : 'home');
  }

  /** The SOPFEU lists, loaded once when the editor first needs them. */
  private _loadLists(source: Source): void {
    const failed = (err: unknown) => {
      console.warn('Risque-de-feu-Carte:', err);
      this._listFailed = true;
    };
    if (source === 'zone' && !this._zones) {
      this._zones = [];
      fetchZones()
        .then((zones) => (this._zones = zones))
        .catch(failed);
    }
    if (source === 'municipality' && !this._municipalities) {
      this._municipalities = [];
      fetchMunicipalities()
        .then((municipalities) => (this._municipalities = municipalities))
        .catch(failed);
    }
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) return nothing;
    const source = this._currentSource();
    this._loadLists(source);

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${{ source }}
        .schema=${[
          {
            name: 'source',
            selector: {
              select: {
                mode: 'list',
                options: SOURCES.map((s) => ({ value: s, label: this._t(`editor.source_${s}`) })),
              },
            },
          },
        ]}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._sourceChanged}
      ></ha-form>

      <div class="source">${this._renderSource(source)}</div>

      ${
        source === 'sensor'
          ? nothing
          : html`<ha-form
              .hass=${this.hass}
              .data=${{
                threshold: String(this._config.threshold ?? DEFAULT_THRESHOLD),
                include_fire_ban: this._config.include_fire_ban ?? DEFAULT_INCLUDE_FIRE_BAN,
              }}
              .schema=${[
                {
                  name: 'threshold',
                  selector: {
                    select: {
                      mode: 'dropdown',
                      options: LEVELS.filter((l) => l > 1).map((l) => ({
                        value: String(l),
                        label: localize(`card.level_${l}`, this._lang),
                      })),
                    },
                  },
                },
                { name: 'include_fire_ban', selector: { boolean: {} } },
              ]}
              .computeLabel=${this._computeLabel}
              @value-changed=${this._alertChanged}
            ></ha-form>`
      }

      <ha-form
        .hass=${this.hass}
        .data=${{ ...FORM_DEFAULTS, ...this._config }}
        .schema=${this._optionsSchema()}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._optionsChanged}
      ></ha-form>
    `;
  }

  private _renderSource(source: Source): TemplateResult | typeof nothing {
    if (source === 'sensor') {
      const sensors = this._alertSensors();
      if (!sensors.length) return html`<div class="note">${this._t('editor.no_sensor')}</div>`;
      return html`
        <ha-form
          .hass=${this.hass}
          .data=${{ entity: this._config!.entity }}
          .schema=${[{ name: 'entity', selector: { entity: { include_entities: sensors } } }]}
          .computeLabel=${this._computeLabel}
          @value-changed=${this._entityChanged}
        ></ha-form>
        <a class="link" href="/config/integrations/integration/${INTEGRATION_DOMAIN}" target="_blank" rel="noopener">
          <ha-icon icon="mdi:cog-outline"></ha-icon>${this._t('editor.change_settings')}
        </a>
      `;
    }
    if (this._listFailed && (source === 'zone' || source === 'municipality')) {
      return html`<div class="note">${this._t('editor.list_failed')}</div>`;
    }
    if (source === 'zone') {
      return html`<ha-form
        .hass=${this.hass}
        .data=${{ zone: this._config!.zone !== undefined ? String(this._config!.zone) : undefined }}
        .schema=${[
          {
            name: 'zone',
            selector: {
              select: {
                mode: 'dropdown',
                options: (this._zones ?? []).map((z) => ({
                  value: String(z.number),
                  label: `${z.number} · ${z.name}`,
                })),
              },
            },
          },
        ]}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._placeChanged}
      ></ha-form>`;
    }
    if (source === 'municipality') {
      return html`<ha-form
        .hass=${this.hass}
        .data=${{ municipality: this._config!.municipality }}
        .schema=${[
          {
            name: 'municipality',
            selector: {
              select: {
                mode: 'dropdown',
                // A searchable list: there are more than 1,300.
                custom_value: true,
                options: (this._municipalities ?? []).map((m) => ({
                  value: m.code,
                  label: m.region ? `${m.name} · ${m.region}` : m.name,
                })),
              },
            },
          },
        ]}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._placeChanged}
      ></ha-form>`;
    }
    if (source === 'device') return html`<div class="note">${this._t('editor.device_helper')}</div>`;
    return nothing;
  }

  private _optionsSchema(): FormSchema[] {
    return [
      { name: 'title', selector: { text: {} } },
      { name: 'icon', selector: { icon: { placeholder: DEFAULT_ICON } } },
      {
        name: 'language',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'auto', label: this._t('editor.lang_auto') },
              { value: 'fr', label: this._t('editor.lang_fr') },
              { value: 'en', label: this._t('editor.lang_en') },
            ],
          },
        },
      },
      {
        name: '',
        type: 'expandable',
        flatten: true,
        expanded: true,
        title: this._t('editor.section_display'),
        schema: [
          { name: 'hide_below_threshold', selector: { boolean: {} } },
          { name: 'show_scale', selector: { boolean: {} } },
          { name: 'show_forecast', selector: { boolean: {} } },
          { name: 'show_restrictions', selector: { boolean: {} } },
          { name: 'show_links', selector: { boolean: {} } },
        ],
      },
    ];
  }

  private _computeLabel = (schema: FormSchema): string => this._t(`editor.${schema.name}`);

  private _computeHelper = (schema: FormSchema): string | undefined => {
    if (schema.name === 'title') return this._t('editor.title_helper');
    if (schema.name === 'hide_below_threshold') return this._t('editor.hide_helper');
    if (schema.name === 'municipality') return this._t('editor.municipality_helper');
    return undefined;
  };

  /** The config without any source, to set a new one. */
  private _withoutSource(): RisqueDeFeuCarteConfig {
    const config = { ...this._config! };
    delete config.entity;
    delete config.zone;
    delete config.municipality;
    delete config.location;
    return config;
  }

  private _sourceChanged(ev: CustomEvent): void {
    const source = ev.detail.value.source as Source;
    if (source === this._currentSource()) return;
    const config = this._withoutSource();
    if (source === 'sensor') {
      delete config.threshold;
      delete config.include_fire_ban;
      const sensors = this._alertSensors();
      if (sensors.length) config.entity = sensors[0];
    } else if (source === 'zone') {
      config.zone = this._zones?.[0]?.number ?? 1;
    } else if (source === 'municipality') {
      config.municipality = '';
    } else {
      config.location = source;
    }
    this._update(config);
  }

  private _entityChanged(ev: CustomEvent): void {
    this._update({ ...this._config!, entity: ev.detail.value.entity });
  }

  private _placeChanged(ev: CustomEvent): void {
    const value = ev.detail.value;
    if (value.zone !== undefined) this._update({ ...this._config!, zone: Number(value.zone) });
    else if (value.municipality !== undefined) this._update({ ...this._config!, municipality: value.municipality });
  }

  private _alertChanged(ev: CustomEvent): void {
    const value = ev.detail.value;
    const config: RisqueDeFeuCarteConfig = { ...this._config!, threshold: Number(value.threshold) };
    config.include_fire_ban = value.include_fire_ban;
    // Keep the YAML short: drop values equal to the defaults.
    if (config.threshold === DEFAULT_THRESHOLD) delete config.threshold;
    if (config.include_fire_ban === DEFAULT_INCLUDE_FIRE_BAN) delete config.include_fire_ban;
    this._update(config);
  }

  private _optionsChanged(ev: CustomEvent): void {
    const value = { ...ev.detail.value };
    // Keep the YAML short: drop values equal to the defaults and empty titles.
    for (const [key, def] of Object.entries(FORM_DEFAULTS)) if (value[key] === def) delete value[key];
    if (!value.title) delete value.title;
    if (!value.icon) delete value.icon;
    this._update(value as RisqueDeFeuCarteConfig);
  }

  private _update(config: RisqueDeFeuCarteConfig): void {
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  static styles = css`
    .source {
      margin: 8px 0 16px;
    }
    .note {
      color: var(--secondary-text-color);
      padding: 8px 0;
    }
    .link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      color: var(--primary-color);
      text-decoration: none;
      --mdc-icon-size: 18px;
    }
  `;
}

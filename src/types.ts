/** The parts of Home Assistant's `hass` object this card uses. */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_updated: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  language?: string;
  locale?: { language: string };
  config?: { latitude: number; longitude: number };
}

export type Language = 'auto' | 'fr' | 'en';

/** Direct mode by location: Home Assistant's home, or this device's position. */
export type Location = 'home' | 'device';

export interface RisqueDeFeuCarteConfig {
  type: string;
  entity?: string;
  zone?: number;
  municipality?: string;
  location?: Location;
  threshold?: number;
  include_fire_ban?: boolean;
  title?: string;
  icon?: string;
  hide_below_threshold?: boolean;
  show_scale?: boolean;
  show_forecast?: boolean;
  show_restrictions?: boolean;
  show_links?: boolean;
  language?: Language;
}

/** One fire danger zone; `levels` are SOPFEU's days 1 to 3 as published (null when not given). */
export interface FireZone {
  number: number;
  name: string;
  levels: (number | null)[];
}

export interface DangerReport {
  zones: FireZone[];
  calculated: number | null; // epoch ms
}

export interface Restriction {
  type: number;
  rtfType: number | null;
  descriptionFr: string;
  descriptionEn: string;
  start: number | null; // epoch ms
  end: number | null;
}

/** One model for both data sources (the integration's Alert sensor, or SOPFEU directly). */
export interface FireData {
  place?: string;
  /** Today, tomorrow and the day after for the place: the highest of its zones. */
  levels: (number | null)[];
  zones: FireZone[];
  restrictions: Restriction[];
  fireBan: boolean;
  calculated: number | null;
  threshold: number;
  includeFireBan: boolean;
  /** The integration's own verdict; computed by the card in direct mode. */
  alert?: boolean;
}

export interface Municipality {
  code: string;
  name: string;
  region: string;
}

declare global {
  interface HASSDomEvents {
    'config-changed': { config: RisqueDeFeuCarteConfig };
  }
}

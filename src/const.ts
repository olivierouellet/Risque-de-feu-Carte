export const CARD_VERSION = '0.1.0';
export const CARD_TAG = 'risque-de-feu-carte';
export const EDITOR_TAG = 'risque-de-feu-carte-editor';

/** Integration domain of the companion Home Assistant integration. */
export const INTEGRATION_DOMAIN = 'risque_de_feu';

/** SOPFEU's dates and times are Québec local time. */
export const QUEBEC_TZ = 'America/Toronto';

export const DEFAULT_ICON = 'mdi:fire';

/** SOPFEU's five levels, low to extreme, with the colours of its map. */
export const LEVELS = [1, 2, 3, 4, 5] as const;
export const LEVEL_KEYS: Record<number, string> = {
  1: 'low',
  2: 'moderate',
  3: 'high',
  4: 'very_high',
  5: 'extreme',
};
export const LEVEL_COLORS: Record<number, string> = {
  1: '#28398a',
  2: '#37a048',
  3: '#f4ed1f',
  4: '#ee7c22',
  5: '#c92127',
};
/** Dark text where white would not read: on yellow and orange. */
export const DARK_TEXT_LEVELS = new Set([3, 4]);
export const DEFAULT_THRESHOLD = 3;
export const DEFAULT_INCLUDE_FIRE_BAN = true;

/** "Interdiction de faire des feux à ciel ouvert en forêt ou à proximité". */
export const FIRE_BAN_TYPE = 1;

export const API_URL = 'https://geofeux.sopfeu.qc.ca/sopfeu-api/public';
/** Every measure type is excluded unless asked for. */
export const RESTRICTION_FILTERS =
  'ifco=true&rtf12_20=true&rtf24=true&rtf8_20=true&prohibitionAcces=true&fermeture=true&interdictionVol=true&zoneRisque=true';

export const INFO_URL: Record<string, string> = {
  fr: 'https://www.sopfeu.qc.ca/prevention/danger-incendie/',
  en: 'https://www.sopfeu.qc.ca/en/prevention/fire-danger-index/',
};
export const MAP_URL: Record<string, string> = {
  fr: 'https://www.sopfeu.qc.ca/carte/?showFireDanger=true',
  en: 'https://www.sopfeu.qc.ca/en/map/?showFireDanger=true',
};
export const RESTRICTIONS_URL: Record<string, string> = {
  fr: 'https://www.sopfeu.qc.ca/prevention/mesures-preventives-et-restrictions/',
  en: 'https://www.sopfeu.qc.ca/en/prevention/preventive-measures-and-restrictions/',
};

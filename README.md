<p align="center">
  <img src="https://raw.githubusercontent.com/olivierouellet/Risque-de-feu/main/assets/icon.svg" alt="Logo de Risque de feu" width="128" height="128">
</p>

<h1 align="center">Risque-de-feu-Carte</h1>

<p align="center"><b><a href="#français">Français</a> · <a href="#english">English</a></b></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/olivierouellet/Risque-de-feu-Carte/main/images/screenshot-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/olivierouellet/Risque-de-feu-Carte/main/images/screenshot-light.png">
    <img src="https://raw.githubusercontent.com/olivierouellet/Risque-de-feu-Carte/main/images/screenshot-light.png" alt="Risque-de-feu-Carte en français et en anglais : danger élevé, très élevé demain, interdiction de feux en vigueur · Risque-de-feu-Carte in French and English: high danger, very high tomorrow, fire ban in effect" width="760">
  </picture>
</p>

---

## Français

Une carte de tableau de bord Home Assistant pour le **danger d’incendie de forêt au Québec**, tel que publié par la [SOPFEU](https://www.sopfeu.qc.ca/).

- Le **niveau du jour** (bas, modéré, élevé, très élevé, extrême) dans les couleurs de la SOPFEU, sur l’**échelle des cinq niveaux** avec un repère au seuil d’alerte.
- **Demain et après-demain**.
- L’**interdiction de faire des feux à ciel ouvert** quand elle s’applique, et les autres mesures en vigueur (restrictions de travaux en forêt, fermetures, etc.) avec leurs dates.
- Peut se **masquer d’elle-même sous le seuil d’alerte**, et rester visible pendant la modification du tableau de bord.
- Hors saison, la carte l’indique au lieu d’afficher un niveau périmé.
- Un éditeur visuel. **En français et en anglais**, selon la langue de Home Assistant ou au choix pour chaque carte.
- Respecte votre thème, clair ou sombre.

### D’où viennent les données

1. **Avec l’intégration [Risque de feu](https://github.com/olivierouellet/Risque-de-feu) (recommandé).** Choisissez son capteur *Alerte*. L’endroit et le seuil se règlent dans l’intégration, et vous obtenez aussi des capteurs pour vos automatisations et la visibilité de n’importe quelle carte.
2. **Directement de la SOPFEU**, sans intégration, selon l’une de ces sources :
   - une **zone** de la SOPFEU (64 zones);
   - une **municipalité** (tapez pour chercher; une grande municipalité montre le danger le plus élevé de ses zones);
   - l’**emplacement du domicile** dans Home Assistant;
   - la **position de l’appareil** (géolocalisation) : chaque téléphone ou tablette montre le danger là où il se trouve. Le navigateur demande la permission, et le tableau de bord doit être en HTTPS.

   Chaque tableau de bord ouvert interroge la SOPFEU (quelques kilo-octets, gardés 30 minutes).

### Installation

**Avec HACS (recommandé)**

[![Ouvrir votre instance Home Assistant et ce dépôt dans HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=olivierouellet&repository=Risque-de-feu-Carte&category=plugin)

1. Dans Home Assistant, ouvrez **HACS** → **⋮** (en haut à droite) → **Dépôts personnalisés**.
2. Dépôt : `https://github.com/olivierouellet/Risque-de-feu-Carte`, type : **Dashboard** (tableau de bord), puis **Ajouter**. (Le bouton ci-dessus fait les étapes 1 et 2 pour vous.)
3. Cherchez **Risque-de-feu-Carte**, ouvrez-la et cliquez sur **Télécharger**. HACS ajoute la ressource du tableau de bord pour vous.
4. Rechargez votre navigateur (ou redémarrez l’application Home Assistant).

**Manuellement**

1. Téléchargez `risque-de-feu-carte.js` de la dernière version (ou compilez-le : `yarn install && yarn build`, puis prenez `dist/risque-de-feu-carte.js`).
2. Copiez-le dans `config/www/`.
3. *Paramètres → Tableaux de bord → ⋮ → Ressources → Ajouter une ressource* : URL `/local/risque-de-feu-carte.js`, type **Module JavaScript**.

Ajoutez ensuite la carte depuis le sélecteur de cartes (cherchez « Risque de feu »).

### Options

| Option | Par défaut | Description |
|---|---|---|
| `entity` | — | Capteur *Alerte* de l’intégration Risque de feu. Utilisez une seule source : `entity`, `zone`, `municipality` **ou** `location`. |
| `zone` | — | Mode direct : numéro de zone de la SOPFEU, par exemple `31` (Saguenay). |
| `municipality` | — | Mode direct : code géographique, par exemple `"03005"` (Gaspé), ou le nom de la municipalité. |
| `location` | — | Mode direct : `home` (emplacement du domicile) ou `device` (position de l’appareil). |
| `threshold` | `3` | Mode direct : seuil d’alerte, de `2` (modéré) à `5` (extrême). (Avec `entity`, c’est l’intégration qui décide.) |
| `include_fire_ban` | `true` | Mode direct : une interdiction de feux compte comme une alerte. |
| `title` | Risque de feu | Titre de la carte. |
| `icon` | `mdi:fire` | Icône à gauche du titre. |
| `hide_below_threshold` | `false` | Masquer la carte sous le seuil d’alerte. Elle reste visible quand vous modifiez le tableau de bord, avec une note. |
| `show_scale` | `true` | Afficher l’échelle des cinq niveaux. |
| `show_forecast` | `true` | Afficher aujourd’hui, demain et après-demain. |
| `show_restrictions` | `true` | Afficher l’interdiction de feux et les autres mesures en vigueur. |
| `show_links` | `true` | Afficher la date du calcul et les liens vers la SOPFEU. |
| `language` | `auto` | `auto` (langue de Home Assistant; le français si ce n’est pas l’anglais), `fr` ou `en`. |

### Exemples

```yaml
type: custom:risque-de-feu-carte
entity: binary_sensor.risque_de_feu_saguenay_alerte
hide_below_threshold: true
```

```yaml
type: custom:risque-de-feu-carte
municipality: "03005"
threshold: 4
title: Chalet
```

```yaml
type: custom:risque-de-feu-carte
location: device
show_scale: false
language: fr
```

Pour masquer **une autre carte** sous le seuil, utilisez l’onglet *Visibilité* de cette carte avec le capteur *Alerte* de l’intégration (voir le [README de Risque de feu](https://github.com/olivierouellet/Risque-de-feu#afficher-une-carte-seulement-quand-le-risque-est-réel)).

### Développement

- `yarn install`, puis `yarn build` (lint, traductions, vérification des types, tests, bundle dans `dist/`).
- `yarn start` sert une page de test sur le port 5050 (pas 5000, que macOS réserve à AirPlay) : plusieurs niveaux et configurations, avec un faux Home Assistant. Options d’URL : `?dark&lang=en&width=320`.
- Ajoutez `http://<votre-ordinateur>:5050/risque-de-feu-carte.js` comme ressource d’un tableau de bord pour essayer la version en cours dans Home Assistant.
- Voir [CONTRIBUTING.md](CONTRIBUTING.md).

Données : [API publique de la SOPFEU](https://geofeux.sopfeu.qc.ca/sopfeu-api/swagger/index.html) (Société de protection des forêts contre le feu). La référence reste le site de la SOPFEU : [danger d’incendie](https://www.sopfeu.qc.ca/prevention/danger-incendie/) et [mesures préventives](https://www.sopfeu.qc.ca/prevention/mesures-preventives-et-restrictions/). Les municipalités peuvent aussi interdire les feux sur leur territoire : vérifiez auprès de la vôtre. Risque-de-feu-Carte n’est pas affiliée à la SOPFEU ni au gouvernement du Québec.

---

## English

A Home Assistant dashboard card for **Québec’s forest fire danger**, as published by [SOPFEU](https://www.sopfeu.qc.ca/en/), Québec’s forest fire protection agency.

- **Today’s level** (low, moderate, high, very high, extreme) in SOPFEU’s colours, on the **five-level scale** with a tick at the alert threshold.
- **Tomorrow and the day after**.
- The **ban on open fires** when it applies, and the other measures in effect (forestry restrictions, closures, and so on) with their dates.
- Can **hide itself below the alert threshold**, while staying visible when you edit the dashboard.
- Off season, the card says so instead of showing a stale level.
- A visual editor. **French and English**, following Home Assistant’s language or set per card.
- Follows your theme, light or dark.

### Where the data comes from

1. **From the [Risque de feu](https://github.com/olivierouellet/Risque-de-feu#english) integration (recommended).** Pick its *Alert* sensor. The place and threshold are set in the integration, and you also get sensors for automations and for the visibility of any card.
2. **Directly from SOPFEU**, with no integration, from one of these:
   - a SOPFEU **zone** (64 zones);
   - a **municipality** (type to search; a large municipality shows the highest danger of its zones);
   - Home Assistant’s **home location**;
   - **this device’s position** (geolocation): each phone or tablet shows the danger where it is. The browser asks for permission, and the dashboard must use HTTPS.

   Each open dashboard queries SOPFEU (a few kilobytes, kept for 30 minutes).

### Installation

**With HACS (recommended)**

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=olivierouellet&repository=Risque-de-feu-Carte&category=plugin)

1. In Home Assistant, open **HACS** → **⋮** (top right) → **Custom repositories**.
2. Repository: `https://github.com/olivierouellet/Risque-de-feu-Carte`, type: **Dashboard**, then **Add**. (The button above does steps 1 and 2 for you.)
3. Search for **Risque-de-feu-Carte**, open it and click **Download**. HACS adds the dashboard resource for you.
4. Reload your browser (or restart the Home Assistant app).

**Manual**

1. Download `risque-de-feu-carte.js` from the latest release (or build it: `yarn install && yarn build`, then use `dist/risque-de-feu-carte.js`).
2. Copy it to `config/www/`.
3. *Settings → Dashboards → ⋮ → Resources → Add resource*: URL `/local/risque-de-feu-carte.js`, type **JavaScript module**.

Then add the card from the card picker (search for “Risque de feu”).

### Options

| Option | Default | Description |
|---|---|---|
| `entity` | — | *Alert* sensor from the Risque de feu integration. Use a single source: `entity`, `zone`, `municipality` **or** `location`. |
| `zone` | — | Direct mode: SOPFEU zone number, for example `31` (Saguenay). |
| `municipality` | — | Direct mode: geographic code, for example `"03005"` (Gaspé), or the municipality’s name. |
| `location` | — | Direct mode: `home` (home location) or `device` (this device’s position). |
| `threshold` | `3` | Direct mode: alert threshold, from `2` (moderate) to `5` (extreme). (With `entity`, the integration decides.) |
| `include_fire_ban` | `true` | Direct mode: a fire ban counts as an alert. |
| `title` | Fire danger | Card title. |
| `icon` | `mdi:fire` | Icon left of the title. |
| `hide_below_threshold` | `false` | Hide the card below the alert threshold. It stays visible while you edit the dashboard, with a note. |
| `show_scale` | `true` | Show the five-level scale. |
| `show_forecast` | `true` | Show today, tomorrow and the day after. |
| `show_restrictions` | `true` | Show the fire ban and the other measures in effect. |
| `show_links` | `true` | Show when the danger was calculated, and links to SOPFEU. |
| `language` | `auto` | `auto` (Home Assistant’s language; French unless it is English), `fr` or `en`. |

### Examples

```yaml
type: custom:risque-de-feu-carte
entity: binary_sensor.risque_de_feu_saguenay_alert
hide_below_threshold: true
```

```yaml
type: custom:risque-de-feu-carte
municipality: "03005"
threshold: 4
title: Cottage
```

```yaml
type: custom:risque-de-feu-carte
location: device
show_scale: false
language: en
```

To hide **another card** below the threshold, use that card’s *Visibility* tab with the integration’s *Alert* sensor (see the [Risque de feu README](https://github.com/olivierouellet/Risque-de-feu#show-a-card-only-when-the-risk-is-real)).

### Development

- `yarn install`, then `yarn build` (lint, translations, type check, tests, bundle to `dist/`).
- `yarn start` serves a test page on port 5050 (not 5000, which macOS uses for AirPlay): several levels and configurations, with a mock Home Assistant. URL options: `?dark&lang=en&width=320`.
- Add `http://<your-computer>:5050/risque-de-feu-carte.js` as a dashboard resource to try the live build in Home Assistant.
- See [CONTRIBUTING.md](CONTRIBUTING.md).

Data: [SOPFEU public API](https://geofeux.sopfeu.qc.ca/sopfeu-api/swagger/index.html) (Société de protection des forêts contre le feu). The reference remains SOPFEU’s website: [fire danger](https://www.sopfeu.qc.ca/en/prevention/fire-danger-index/) and [preventive measures](https://www.sopfeu.qc.ca/en/prevention/preventive-measures-and-restrictions/). Municipalities can also ban fires on their territory: check with yours. Risque-de-feu-Carte is not affiliated with SOPFEU or the Government of Québec.

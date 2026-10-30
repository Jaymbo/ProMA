# ProMA – Problem Melde App

Anonyme PWA zum Melden städtischer Probleme (z. B. „Zufahrt zum Kindergarten zugeparkt").
Foto machen, beschreiben, öffentlich abstimmen – **ohne Account, ohne personenbezogene Daten**.

## Features

- **Melden:** Foto (mit automatischem Gesichts-Blur + manuellem Blur-Werkzeug), Titel, Beschreibung, Gebiet, GPS-Koordinaten
- **Client-KI-Prüfung:** Text wird im Browser auf Unangemessenes/Personenbezogenes geprüft (Transformers.js + Regex-Fallback serverseitig); Ablehnung immer mit Begründung (HTTP 422)
- **Abstimmen:** Up-/Downvotes, Score = `(Up − Down) × 2 − Alter_in_Tagen × 0.5` (min. 0)
- **Vote-Sperre:** Client-ID (localStorage) + täglich rotierender IP-Hash (SHA-256, Roh-IP wird nie gespeichert) + Rate-Limit
- **Erledigt-Melden:** Erledigt-Foto hochladen → 3 Community-Bestätigungen → Status „erledigt" → **Auto-Löschung nach 30 Tagen**
- **Karte + Liste:** OpenStreetMap (Leaflet), Filter (Gebiet, nur offene) und Sortierung (Wichtigkeit, Neueste, Votes)
- **Melden/Flaggen:** 3 Flags → Meldung wird ausgeblendet
- **Mehrsprachig:** Deutsch + Englisch (`src/lib/i18n`)
- **PWA:** installierbar, offline-fähig (Service Worker)

## Tech-Stack

- **SvelteKit 3** (Svelte 5 Runes) + TypeScript
- **`node:sqlite`** (eingebautes SQLite von Node 22) – kein nativer Better-SQLite-Build nötig
- **@sveltejs/adapter-node** für Production
- Leaflet, @tensorflow/tfjs + @tensorflow-models/blazeface, @xenova/transformers

## Entwicklung

Node **22+** erforderlich (wegen `node:sqlite`).

```bash
npm install
npm run dev          # Dev-Server (z. B. Port 5174)
npm run check        # svelte-check
npm run build        # Production-Build nach build/
```

## Deployment (adapter-node)

```bash
npm run build
node build/index.js  # PORT=3000 HOST=0.0.0.0 optional
```

Statische Dateien und Uploads werden vom Node-Prozess selbst ausgeliefert.
Daten liegen in `data/proma.db`, hochgeladene Bilder in `uploads/` (beide relativ zum Arbeitsverzeichnis).

## Wichtige Hinweise (SvelteKit 3 Breaking Changes)

- `$lib` → `#lib` (Subpath-Imports via `imports`-Feld in `package.json`)
- `$app/environment` → `$app/env`
- `Handle`-Typ aus `@sveltejs/kit/hooks` (nicht `@sveltejs/kit`)
- Leaflet nur clientseitig laden (dynamischer Import in `onMount`), sonst SSR-Fehler

## Datenschutz-Design

- Keine Accounts, keine E-Mails, keine Namen
- IP-Adresse: nur als täglich rotierender SHA-256-Hash, nie dauerhaft gespeichert
- Bilder: automatischer Gesichts-Blur im Browser (BlazeFace) + manuelles Blur-Werkzeug, vor Upload wird ausdrücklich auf die Öffentlichkeit hingewiesen
- Erledigte Meldungen werden inkl. Bildern nach 30 Tagen automatisch gelöscht

## Projektstruktur

```
src/lib/server/     db.ts (Schema), reports.ts (Validierung/Score), cleanup.ts (30-Tage-Löschung)
src/routes/api/     reports (+vote, +resolve, +flag), uploads/[file]
src/routes/         Liste (+page), /report (Melden), /map (Karte)
src/lib/client/     identity.ts, image.ts (Blur), textcheck.ts (KI)
src/lib/i18n/       Übersetzungen DE/EN
src/hooks.server.ts Stündlicher Auto-Cleanup-Hook
scripts/make-icons.py  PWA-Icons generieren
```

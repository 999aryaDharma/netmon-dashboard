# NetMon Dashboard

Network monitoring dashboard (NOC/MRTG style) for generating weekly report screenshots.

## Features

- Login with local password authentication (SHA-256 hashed)
- Create/manage monitoring sites (latency or load/bandwidth type)
- MRTG/Cacti style stacked area chart renderer (custom SVG, no library)
- Random smooth data generator (noise-based, per-hour granularity)
- Flexible time range: presets (6H, 24H, 7D, 30D, 90D) + custom picker
- Per-site stats: last value, average, peak
- Export/import JSON backup
- All data stored in IndexedDB (browser) - survives page reload
- Zero backend, zero external API - static hosting ready

## Default Credentials

```
Password: admin123
```

Change this immediately after first login via Settings.

## Setup

```bash
npm install
npm run dev
```

## Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder. Deploy to GitHub Pages, Netlify, or Cloudflare Pages.

### GitHub Pages (with Vite)

Set `base` in `vite.config.ts` to your repo name:
```ts
base: '/your-repo-name/'
```

Then push `dist/` to the `gh-pages` branch.

### Netlify / Cloudflare Pages

Point build command to `npm run build`, publish directory to `dist/`.

## Tech Stack

- React 18 + TypeScript
- Vite 5
- Custom SVG chart renderer (no chart library)
- IndexedDB for data persistence
- localStorage / sessionStorage for auth

## Data Model

Each site stores hourly data points:
```json
{
  "id": "...",
  "name": "Core Router - WAN",
  "type": "load",
  "color": "#33cc66",
  "unit": "Mbps",
  "axis": { "min": 0, "max": 1000 },
  "data": [
    { "timestamp": 1700000000000, "value": 342.5 }
  ]
}
```

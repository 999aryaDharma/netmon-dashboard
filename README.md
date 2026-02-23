# NetMon Dashboard

Network monitoring dashboard (NOC/MRTG/Cacti style) for generating weekly report screenshots. Built with React + TypeScript + Vite.

## Features

### Core Features
- Login with local password authentication (SHA-256 hashed)
- Create/manage monitoring sites (Traffic/Load or Ping/Latency type)
- MRTG/Cacti style stacked area chart renderer (custom SVG, no external library)
- 3-Column Grid Layout - Display multiple sites simultaneously
- Graph Filter Tabs - Filter by All, Load, or Ping charts
- Search & Dropdown - Quick site search and selection
- Detail Chart Modal - Click any chart for full-screen detail view with legend
- Manual Data Input - Insert single data points for custom scenarios
- Auto-Regenerate Data - Refresh all data with current timeframe

### Chart Types

1. **Traffic/Load** - Bandwidth monitoring (IN/OUT stacked areas)
   - Colors: Green (#B6FF00, #00FF00, etc.) for IN, Purple (#CC77FF, #9933FF, etc.) for OUT
   - Y-Axis: Bits/sec (auto-formatted to Mbps/kbps/bps)

2. **Ping/Latency** - RTT and Packet Loss monitoring (overlay lines)
   - RTT: Silver line (#CECECE)
   - Loss: Red line (#FF0000)
   - Dual Y-Axis: RTT (ms) left, Loss (%) right

### Data Management
- Random smooth data generator - 3-wave composite algorithm for unique "DNA" per site
- Flexible time range: Presets (6H, 24H, 3D, 7D, 30D) + custom datetime picker
- Per-site stats: Current, Average, Maximum, Total (with MRTG-style legend)
- Export/Import JSON backup
- All data in IndexedDB - survives page reload
- No auto-wipe - Manual data persists until explicitly regenerated

### UI/UX
- Dark NOC Theme - Easy on eyes for 24/7 monitoring
  - Background: #2C3034
  - Header: #222629
  - Chart Background: #333333
  - Text: #9fb3c8
- Responsive Grid - 3 columns on desktop, 2 on tablet, 1 on mobile
- Font: JetBrains Mono (monospace for that authentic NOC feel)

## Quick Start

### Default Credentials
```
Password: admin123
```
Change this immediately after first login via Settings.

### Installation
```bash
npm install
npm run dev
```

Open http://localhost:5173

### Build for Production
```bash
npm run build
```
Output in `dist/` folder.

## Project Structure

```
src/
 ├── components/
 │    ├── common/          # Reusable UI components
 │    │    └── Settings.tsx
 │    ├── charts/          # Chart components
 │    │    ├── Chart.tsx          # Traffic/Load chart
 │    │    ├── PingChart.tsx      # RTT/Loss chart
 │    │    └── ChartUtils.ts      # Chart utilities & theme
 │    ├── editor/          # Site editor
 │    │    └── SiteEditor.tsx
 │    └── dashboard/       # Dashboard sub-components (future)
 ├── constants/
 │    └── defaults.ts      # Default site names, colors, presets
 ├── pages/
 │    ├── Login.tsx
 │    └── Dashboard.tsx    # Main dashboard container
 ├── store/
 │    └── AppContext.tsx   # Global state management
 ├── utils/
 │    ├── dataGen.ts       # Data generation algorithms
 │    ├── formatters.ts    # Display formatters (Mbps, ms, %)
 │    ├── siteHelpers.ts   # Site creation helpers
 │    └── auth.ts          # Authentication utilities
 ├── db/
 │    └── indexeddb.ts     # IndexedDB wrapper
 └── types.ts              # TypeScript interfaces
```

## Tech Stack

- React 18 + TypeScript
- Vite 5 (fast HMR, optimized builds)
- Custom SVG chart renderer (zero dependencies)
- IndexedDB for persistent data storage
- localStorage/sessionStorage for auth session

## Data Model

### Site Interface
```typescript
interface Site {
  id: string;
  name: string;           // e.g., "Internet backbone Data Center Polda Bali (Load)"
  type: "traffic" | "ping";
  unit: string;           // "bps", "ms", "%"
  axisMax: number;        // Y-axis maximum (auto-scaled by site type)
  interfaces: SiteInterface[];
}

interface SiteInterface {
  id: string;
  name: string;           // "eth0", "ping"
  colorIn: string;        // IN traffic color
  colorOut: string;       // OUT traffic color
  dataIn: DataPoint[];    // IN traffic data
  dataOut: DataPoint[];   // OUT traffic data
  dataRtt?: DataPoint[];  // RTT data (ping type)
  dataLoss?: DataPoint[]; // Loss data (ping type)
}

interface DataPoint {
  timestamp: number;
  value: number;
}
```

### Default Site Capacity (Auto-Detected from Name)
| Site Type | Keywords | Axis Max |
|-----------|----------|----------|
| Internet Backbone | backbone, polda | 1,000 Mbps |
| Integration Network | integration, atcs, pelabuhan, terminal, toll | 35 Mbps |
| CCTV | cctv | 5 Mbps |
| Default | - | 100 Mbps |

## Color Palettes

### Traffic (IN/OUT)
```typescript
[
  { in: "#B6FF00", out: "#CC77FF" }, // ether1
  { in: "#00FF00", out: "#9933FF" }, // ether2
  { in: "#00CC00", out: "#6600CC" }, // ether3
  { in: "#009900", out: "#330099" }, // ether4
  { in: "#005500", out: "#110055" }, // ether5
  { in: "#002200", out: "#000033" }, // LAN
]
```

### Latency (RTT/Loss)
```typescript
{
  in: "#CECECE",  // RTT - silver
  out: "#FF0000", // Loss - red
}
```

## Configuration

### Vite Config (for GitHub Pages)
```ts
// vite.config.ts
export default defineConfig({
  base: '/your-repo-name/',
  plugins: [react()],
})
```

### Deploy to GitHub Pages
```bash
npm run build
# Push dist/ to gh-pages branch
# Or use actions/checkout + actions/upload-pages-artifact
```

### Deploy to Netlify / Cloudflare Pages
- Build command: `npm run build`
- Publish directory: `dist/`

## Usage Guide

### 1. First Login
- Default password: `admin123`
- Change via Settings -> Change Password

### 2. Add New Site
1. Click + Add button
2. Enter site name
3. Select type: Traffic (bandwidth) or Ping (latency)
4. Go to Interfaces tab
5. Click Generate All Interfaces for random data
6. Or use Insert Single Data Point for manual entry
7. Click Save

### 3. Filter Charts
- All - Show both Load and Ping charts
- Load - Show only Traffic/Load charts
- Ping - Show only Latency charts

### 4. View Chart Detail
- Click any chart in grid
- Modal opens with full-size chart + detailed legend
- Change time range in modal (does not affect global range)
- Click outside or Close to dismiss

### 5. Manual Data Entry
1. Edit a site
2. Go to Interfaces tab
3. Scroll to Insert Single Data Point
4. Select datetime
5. Enter value (IN/OUT for Traffic, RTT/Loss for Ping)
6. Click + Add Manual Point
7. Save the site

### 6. Regenerate All Data
1. Open Settings
2. Click Regenerate Data (Current Time)
3. Confirms regeneration with current timeframe

## Security Notes

- Passwords are hashed with SHA-256 before storage
- Session stored in sessionStorage (cleared on browser close)
- No backend = no network attacks
- Suitable for internal NOC use behind firewall

## Known Limitations

- No real-time SNMP polling (manual data entry or random generation only)
- No alerting/notification system
- Single-user only (no user management)
- Data stored in browser (clear cache = lose data, use Export backup!)

## License

MIT License - Feel free to use for personal or commercial projects.

## Acknowledgments

Inspired by:
- MRTG (Multi Router Traffic Grapher)
- Cacti (PHP-based network graphing solution)
- RRDTool (Round Robin Database Tool)
- LibreNMS / Observium (modern monitoring tools)

---

Built for NOC teams who miss the classic MRTG aesthetic.

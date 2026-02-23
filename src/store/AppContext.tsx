import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import type { Site, SiteInterface, TimeRange } from "../types";
import {
  dbGetAllSites,
  dbPutSite,
  dbDeleteSite,
  dbClearAll,
} from "../db/indexeddb";
import { generateSmoothData, generatePingData } from "../utils/dataGen";

interface AppState {
  sites: Site[];
  timeRange: TimeRange;
  loading: boolean;
}

type Action =
  | { type: "SET_SITES"; payload: Site[] }
  | { type: "ADD_SITE"; payload: Site }
  | { type: "UPDATE_SITE"; payload: Site }
  | { type: "DELETE_SITE"; payload: string }
  | { type: "SET_TIME_RANGE"; payload: TimeRange }
  | { type: "SET_LOADING"; payload: boolean };

const defaultEnd = Date.now();
const defaultStart = defaultEnd - 24 * 3_600_000; // 24 jam default, bukan 7 hari

const initialState: AppState = {
  sites: [],
  timeRange: { start: defaultStart, end: defaultEnd, label: "Last 24 Hours" },
  loading: true,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_SITES":
      return { ...state, sites: action.payload, loading: false };
    case "ADD_SITE":
      return { ...state, sites: [...state.sites, action.payload] };
    case "UPDATE_SITE":
      return {
        ...state,
        sites: state.sites.map((s) =>
          s.id === action.payload.id ? action.payload : s,
        ),
      };
    case "DELETE_SITE":
      return {
        ...state,
        sites: state.sites.filter((s) => s.id !== action.payload),
      };
    case "SET_TIME_RANGE":
      return { ...state, timeRange: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  addSite: (site: Site) => Promise<void>;
  updateSite: (site: Site) => Promise<void>;
  deleteSite: (id: string) => Promise<void>;
  setTimeRange: (range: TimeRange) => void;
  clearAllData: () => Promise<void>;
  exportData: () => string;
  importData: (json: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// Default site names
const DEFAULT_SITE_NAMES = [
  "Internet backbone Data Center Polda Bali",
  "Integration network ATCS Denpasar",
  "Integration network ATCS Gianyar",
  "Integration network ATCS Tabanan",
  "Integration network Pelabuhan Padangbay",
  "Integration network Pelabuhan Sanur",
  "Integration network terminal Mengwi",
  "Integration network Toll Balimandara",
  "cctv simpang DIPONEGORO",
  "cctv PUPUTAN BADUNG",
  "cctv simpang PIDADA",
  "cctv simpang TRENGGULI",
  "cctv simpang NOJA",
  "cctv simpang KENYERI",
  "cctv simpang TOHPATI",
  "cctv simpang PADANG GALAK",
  "cctv simpang GBB SANUR",
  "cctv BUNDARAN RENON",
  "cctv KONJEN JEPANG",
  "cctv KANTOR GUBENUR",
  "cctv LAPANGAN RENON",
  "cctv PARKIR TIMUR RENON",
  "cctv BAJRASANDI RENON",
  "cctv simpang SUDIRMAN",
  "cctv KONJEN AUSTRALIA",
  "cctv PEREMPATAN JL DIPONEGORO-LV21",
  "cctv HASANUDIN DEPAN MASJID",
  "cctv KAMPUS UNUD SUDIRMAN",
  "cctv simpang GATSU DALUNG",
  "cctv simpang KEBO IWA",
  "cctv simpang BULUH INDAH",
  "cctv simpang COKRO UBUNG",
  "cctv simpang A YANI",
  "cctv simpang NANGKA",
  "cctv simpang TITI BANDA",
  "cctv simpang 6 TEUKU UMAR",
  "cctv simpang SIMPANG BUAGAN",
  "cctv kantor KPU PROVINSI BALI",
  "cctv PUJA MANDALA",
  "cctv simpang GLAEL",
  "cctv simpang SUNSET ROAD IMAM BONJOL",
  "cctv simpang NAKULA",
  "cctv simpang SPKUNTI",
];

// Warna palette untuk interface Traffic
const INTERFACE_COLORS = [
  { in: "#B6FF00", out: "#CC77FF" },
  { in: "#00FF00", out: "#9933FF" },
  { in: "#00CC00", out: "#6600CC" },
  { in: "#009900", out: "#330099" },
  { in: "#005500", out: "#110055" },
  { in: "#002200", out: "#000033" },
];

// Warna palette untuk Latency (RTT/Loss)
const LATENCY_COLORS = {
  in: "#CECECE", // RTT
  out: "#FF0000", // Loss
};

// Helper function untuk merge data tanpa duplikasi timestamp
function mergeData(
  existing: { timestamp: number; value: number }[],
  newData: { timestamp: number; value: number }[]
): { timestamp: number; value: number }[] {
  if (!existing || existing.length === 0) return newData;
  if (!newData || newData.length === 0) return existing;

  // Create map of existing timestamps for quick lookup
  const existingMap = new Map(existing.map(d => [d.timestamp, d]));

  // Add new data points that don't exist yet
  const merged = [...existing];
  newData.forEach(point => {
    if (!existingMap.has(point.timestamp)) {
      merged.push(point);
    }
  });

  // Sort by timestamp
  return merged.sort((a, b) => a.timestamp - b.timestamp);
}

function createDefaultSites(name: string, index: number, existingSites?: Site[]): { loadSite: Site; latencySite: Site } {
  // Generate data relatif terhadap waktu sekarang (bukan waktu fixed)
  // Ini memastikan data selalu dalam range saat aplikasi dibuka
  const now = Date.now();
  const dayAgo = now - 24 * 3_600_000; // 24 jam yang lalu dari sekarang
  const interval = 15 * 60 * 1000; // 15 menit per point
  const pingData = generatePingData(dayAgo, now, { baseRtt: 15, variance: 3, seed: index * 100 }, interval);

  // Tentukan axisMax berdasarkan tipe site (dari nama)
  const isBackbone = name.toLowerCase().includes("backbone") ||
                     name.toLowerCase().includes("polda");
  const isIntegration = name.toLowerCase().includes("integration") ||
                        name.toLowerCase().includes("atcs") ||
                        name.toLowerCase().includes("pelabuhan") ||
                        name.toLowerCase().includes("terminal") ||
                        name.toLowerCase().includes("toll");
  const isCCTV = name.toLowerCase().includes("cctv");

  let axisMaxLoad: number;
  if (isBackbone) {
    axisMaxLoad = 1_000_000_000; // 1000 Mbps - Internet Backbone
  } else if (isIntegration) {
    axisMaxLoad = 35_000_000; // 35 Mbps - Integration Network
  } else if (isCCTV) {
    axisMaxLoad = 5_000_000; // 5 Mbps - CCTV
  } else {
    axisMaxLoad = 100_000_000; // Default 100 Mbps
  }

  // Check if existing sites exist and preserve their data
  const existingLoadId = `load-${index}-${name.toLowerCase().replace(/\s+/g, "-")}`;
  const existingLatencyId = `latency-${index}-${name.toLowerCase().replace(/\s+/g, "-")}`;

  const existingLoad = existingSites?.find(s => s.id === existingLoadId);
  const existingLatency = existingSites?.find(s => s.id === existingLatencyId);

  // Site untuk Load monitoring (traffic)
  const loadSite: Site = {
    id: existingLoadId,
    name: `${name} (Load)`,
    type: "traffic",
    unit: "bps",
    axisMax: axisMaxLoad,
    interfaces: [
      {
        id: existingLoad?.interfaces[0]?.id || `iface-${index}-1`,
        name: "eth0",
        colorIn: INTERFACE_COLORS[index % INTERFACE_COLORS.length].in,
        colorOut: INTERFACE_COLORS[index % INTERFACE_COLORS.length].out,
        // MERGE data: existing data + new generated data (tanpa duplikasi)
        dataIn: mergeData(existingLoad?.interfaces[0]?.dataIn || [], generateSmoothData(dayAgo, now, axisMaxLoad * 0.1, axisMaxLoad * 0.4, index * 100, interval)),
        dataOut: mergeData(existingLoad?.interfaces[0]?.dataOut || [], generateSmoothData(dayAgo, now, axisMaxLoad * 0.05, axisMaxLoad * 0.2, index * 100 + 50, interval)),
      },
    ],
  };

  // Site untuk Latency monitoring (ping)
  const latencySite: Site = {
    id: existingLatencyId,
    name: `${name} (Latency)`,
    type: "ping",
    unit: "ms",
    axisMax: 100, // 100ms max untuk RTT
    interfaces: [
      {
        id: existingLatency?.interfaces[0]?.id || `latency-iface-${index}-1`,
        name: "ping",
        colorIn: LATENCY_COLORS.in,
        colorOut: LATENCY_COLORS.out,
        dataIn: [],
        dataOut: [],
        // MERGE data: existing data + new generated data (tanpa duplikasi)
        dataRtt: mergeData(existingLatency?.interfaces[0]?.dataRtt || [], pingData.rtt),
        dataLoss: mergeData(existingLatency?.interfaces[0]?.dataLoss || [], pingData.loss),
      },
    ],
  };

  return { loadSite, latencySite };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadSites = useCallback(async () => {
    try {
      let sites = await dbGetAllSites();

      // Jika tidak ada site, initialize dengan default sites
      if (sites.length === 0) {
        const defaultSites: Site[] = [];
        DEFAULT_SITE_NAMES.forEach((name, index) => {
          try {
            const { loadSite, latencySite } = createDefaultSites(name, index);
            defaultSites.push(loadSite);
            defaultSites.push(latencySite);
          } catch (err) {
            console.error(`Error creating site "${name}":`, err);
          }
        });

        // Save ke DB
        for (const site of defaultSites) {
          try {
            await dbPutSite(site);
          } catch (err) {
            console.error(`Error saving site "${site.name}":`, err);
          }
        }

        sites = defaultSites;
      }
      // NOTE: Auto-regenerate feature DISABLED untuk reporting purposes.
      // Data tidak akan dihapus otomatis, user harus manual regenerate jika mau update data.
      // Ini mencegah hilangnya data manual yang sudah di-input untuk laporan.

      dispatch({ type: "SET_SITES", payload: sites });
    } catch (err) {
      console.error('Error loading sites:', err);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const addSite = useCallback(async (s: Site) => {
    await dbPutSite(s);
    dispatch({ type: "ADD_SITE", payload: s });
  }, []);
  const updateSite = useCallback(async (s: Site) => {
    await dbPutSite(s);
    dispatch({ type: "UPDATE_SITE", payload: s });
  }, []);
  const deleteSite = useCallback(async (id: string) => {
    await dbDeleteSite(id);
    dispatch({ type: "DELETE_SITE", payload: id });
  }, []);
  const setTimeRange = useCallback(
    (r: TimeRange) => dispatch({ type: "SET_TIME_RANGE", payload: r }),
    [],
  );
  const clearAllData = useCallback(async () => {
    await dbClearAll();
    dispatch({ type: "SET_SITES", payload: [] });
  }, []);
  const exportData = useCallback(
    (): string =>
      JSON.stringify({ sites: state.sites, exportedAt: Date.now() }, null, 2),
    [state.sites],
  );
  const importData = useCallback(
    async (json: string) => {
      const parsed = JSON.parse(json);
      for (const site of parsed.sites || []) await dbPutSite(site);
      loadSites();
    },
    [loadSites],
  );

  return (
    <AppContext.Provider
      value={{
        state,
        addSite,
        updateSite,
        deleteSite,
        setTimeRange,
        clearAllData,
        exportData,
        importData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import type { Site, TimeRange } from "../types";
import {
  dbGetAllSites,
  dbPutSite,
  dbDeleteSite,
  dbClearAll,
} from "../db/indexeddb";
import { DEFAULT_SITE_NAMES } from "../constants/defaults";
import { createDefaultSites } from "../utils/siteHelpers";

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
  regenerateAllData: () => Promise<boolean>;
  regenerateAllDataFullYear: () => Promise<boolean>;
  exportData: () => string;
  importData: (json: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadSites = useCallback(async () => {
    try {
      let sites = await dbGetAllSites();
      console.log(`[AppContext] Loaded ${sites.length} sites from DB`);

      // Jika tidak ada site, initialize dengan default sites
      if (sites.length === 0) {
        console.log(`[AppContext] No sites found, initializing ${DEFAULT_SITE_NAMES.length} default sites...`);
        const defaultSites: Site[] = [];
        DEFAULT_SITE_NAMES.forEach((name, index) => {
          try {
            const { loadSite, latencySite } = createDefaultSites(name, index);
            defaultSites.push(loadSite);
            defaultSites.push(latencySite);
            console.log(`[AppContext] Created site: ${name}`);
          } catch (err) {
            console.error(`Error creating site "${name}":`, err);
          }
        });

        console.log(`[AppContext] Created ${defaultSites.length} sites total`);

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

      console.log(`[AppContext] Final site count: ${sites.length}`);
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

  // Regenerate semua data dengan timeframe waktu sekarang (lokal)
  const regenerateAllData = useCallback(async () => {
    try {
      const freshSites: Site[] = [];
      DEFAULT_SITE_NAMES.forEach((name, index) => {
        try {
          const { loadSite, latencySite } = createDefaultSites(name, index);
          freshSites.push(loadSite);
          freshSites.push(latencySite);
        } catch (err) {
          console.error(`Error regenerating site "${name}":`, err);
        }
      });

      // Clear old data and save new
      await dbClearAll();
      for (const site of freshSites) {
        try {
          await dbPutSite(site);
        } catch (err) {
          console.error(`Error saving regenerated site "${site.name}":`, err);
        }
      }

      dispatch({ type: "SET_SITES", payload: freshSites });
      return true;
    } catch (err) {
      console.error('Error regenerating data:', err);
      return false;
    }
  }, []);

  // Regenerate semua data dengan timeframe 1 tahun penuh (1 Januari - 31 Desember tahun ini)
  const regenerateAllDataFullYear = useCallback(async () => {
    try {
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1).getTime(); // 1 Januari
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999).getTime(); // 31 Desember 23:59:59
      
      const freshSites: Site[] = [];
      DEFAULT_SITE_NAMES.forEach((name, index) => {
        try {
          const { loadSite, latencySite } = createDefaultSites(name, index, undefined, startOfYear, endOfYear);
          freshSites.push(loadSite);
          freshSites.push(latencySite);
        } catch (err) {
          console.error(`Error regenerating full year site "${name}":`, err);
        }
      });

      // Clear old data and save new
      await dbClearAll();
      for (const site of freshSites) {
        try {
          await dbPutSite(site);
        } catch (err) {
          console.error(`Error saving full year regenerated site "${site.name}":`, err);
        }
      }

      dispatch({ type: "SET_SITES", payload: freshSites });
      return true;
    } catch (err) {
      console.error('Error regenerating full year data:', err);
      return false;
    }
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
        regenerateAllData,
        regenerateAllDataFullYear,
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

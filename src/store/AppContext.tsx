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
import {
  DEFAULT_SITE_NAMES,
  BANTEN_SITE_NAMES,
  ETLE_BALI_SITES,
} from "../constants/defaults";
import { createBaliSites } from "../utils/baliSiteHelpers";
import { createBantenSites } from "../utils/bantenSiteHelpers";
import { createETLEBaliSite } from "../utils/etleSiteHelpers";

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
const defaultStart = defaultEnd - 24 * 3_600_000;

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
  regenerateRegionData: (
    region: "bali" | "banten" | "etle" | "all",
  ) => Promise<boolean>;
  exportData: () => string;
  importData: (json: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Helper: build sites berdasarkan region ───────────────────────────────────

function buildSitesByRegion(
  region: "bali" | "banten" | "etle" | "all",
): Site[] {
  const sites: Site[] = [];

  if (region === "bali" || region === "all") {
    DEFAULT_SITE_NAMES.forEach((name, index) => {
      try {
        const { loadSite, latencySite } = createBaliSites(name, index);
        sites.push(loadSite, latencySite);
      } catch (err) {
        console.error(`[Bali] Error creating site "${name}":`, err);
      }
    });
  }

  if (region === "banten" || region === "all") {
    BANTEN_SITE_NAMES.forEach((name, index) => {
      try {
        const { loadSite, latencySite } = createBantenSites(name, index);
        sites.push(loadSite, latencySite);
      } catch (err) {
        console.error(`[Banten] Error creating site "${name}":`, err);
      }
    });
  }

  if (region === "etle" || region === "all") {
    ETLE_BALI_SITES.forEach((name, index) => {
      try {
        const { loadSite } = createETLEBaliSite(name, index);
        sites.push(loadSite);
      } catch (err) {
        console.error(`[ETLE] Error creating site "${name}":`, err);
      }
    });
  }

  return sites;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadSites = useCallback(async () => {
    try {
      let sites = await dbGetAllSites();

      if (sites.length === 0) {
        console.log("[AppContext] DB kosong, membangun default sites...");
        const defaultSites = buildSitesByRegion("all");
        for (const site of defaultSites) {
          try {
            await dbPutSite(site);
          } catch (err) {
            console.error(`Error saving site "${site.name}":`, err);
          }
        }
        sites = defaultSites;
      }

      console.log(`[AppContext] Loaded ${sites.length} sites`);
      dispatch({ type: "SET_SITES", payload: sites });
    } catch (err) {
      console.error("[AppContext] Error loading sites:", err);
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

  // Regenerate per region — region lain dipertahankan dari DB
  const regenerateRegionData = useCallback(
    async (region: "bali" | "banten" | "etle" | "all"): Promise<boolean> => {
      try {
        let finalSites: Site[];

        if (region === "all") {
          finalSites = buildSitesByRegion("all");
        } else {
          // Ambil sites region lain dari DB agar tidak hilang
          const existingSites = await dbGetAllSites();
          const otherSites = existingSites.filter((s) => s.region !== region);
          const newRegionSites = buildSitesByRegion(region);
          finalSites = [...otherSites, ...newRegionSites];
        }

        await dbClearAll();

        for (const site of finalSites) {
          try {
            await dbPutSite(site);
          } catch (err) {
            console.error(`Error saving site "${site.name}":`, err);
          }
        }

        dispatch({ type: "SET_SITES", payload: finalSites });
        console.log(
          `[AppContext] Regenerated ${region}: ${finalSites.length} total sites`,
        );
        return true;
      } catch (err) {
        console.error("[AppContext] Error regenerating region data:", err);
        return false;
      }
    },
    [],
  );

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
        regenerateRegionData,
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

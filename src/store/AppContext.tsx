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
import { DEFAULT_SITE_NAMES, BANTEN_SITE_NAMES } from "../constants/defaults";
import { createBaliSites } from "../utils/baliSiteHelpers";
import { createBantenSites } from "../utils/bantenSiteHelpers";

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
  regenerateAllData: () => Promise<boolean>;
  exportData: () => string;
  importData: (json: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Helper: buat semua site default (Bali + Banten) ─────────────────────────

function buildAllDefaultSites(): Site[] {
  const sites: Site[] = [];

  // Bali
  DEFAULT_SITE_NAMES.forEach((name, index) => {
    try {
      const { loadSite, latencySite } = createBaliSites(name, index);
      sites.push(loadSite, latencySite);
    } catch (err) {
      console.error(`Error creating Bali site "${name}":`, err);
    }
  });

  // Banten
  BANTEN_SITE_NAMES.forEach((name, index) => {
    try {
      const { loadSite, latencySite } = createBantenSites(name, index);
      sites.push(loadSite, latencySite);
    } catch (err) {
      console.error(`Error creating Banten site "${name}":`, err);
    }
  });

  return sites;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadSites = useCallback(async () => {
    try {
      let sites = await dbGetAllSites();

      if (sites.length === 0) {
        const defaultSites = buildAllDefaultSites();
        for (const site of defaultSites) {
          try {
            await dbPutSite(site);
          } catch (err) {
            console.error(`Error saving site "${site.name}":`, err);
          }
        }
        sites = defaultSites;
      }

      dispatch({ type: "SET_SITES", payload: sites });
    } catch (err) {
      console.error("Error loading sites:", err);
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

  const regenerateAllData = useCallback(async () => {
    try {
      const freshSites = buildAllDefaultSites();
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
      console.error("Error regenerating data:", err);
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

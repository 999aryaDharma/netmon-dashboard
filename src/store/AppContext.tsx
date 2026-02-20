import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { Site, TimeRange } from '../types';
import { dbGetAllSites, dbPutSite, dbDeleteSite, dbClearAll } from '../db/indexeddb';

interface AppState {
  sites: Site[];
  timeRange: TimeRange;
  loading: boolean;
}

type Action =
  | { type: 'SET_SITES'; payload: Site[] }
  | { type: 'ADD_SITE'; payload: Site }
  | { type: 'UPDATE_SITE'; payload: Site }
  | { type: 'DELETE_SITE'; payload: string }
  | { type: 'SET_TIME_RANGE'; payload: TimeRange }
  | { type: 'SET_LOADING'; payload: boolean };

const defaultEnd = Date.now();
const defaultStart = defaultEnd - 7 * 24 * 3_600_000;

const initialState: AppState = {
  sites: [],
  timeRange: { start: defaultStart, end: defaultEnd, label: 'Last 7 Days' },
  loading: true,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SITES':    return { ...state, sites: action.payload, loading: false };
    case 'ADD_SITE':     return { ...state, sites: [...state.sites, action.payload] };
    case 'UPDATE_SITE':  return { ...state, sites: state.sites.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_SITE':  return { ...state, sites: state.sites.filter(s => s.id !== action.payload) };
    case 'SET_TIME_RANGE': return { ...state, timeRange: action.payload };
    case 'SET_LOADING':  return { ...state, loading: action.payload };
    default:             return state;
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadSites = useCallback(async () => {
    try {
      const sites = await dbGetAllSites();
      dispatch({ type: 'SET_SITES', payload: sites });
    } catch {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  useEffect(() => { loadSites(); }, [loadSites]);

  const addSite    = useCallback(async (s: Site)  => { await dbPutSite(s); dispatch({ type: 'ADD_SITE', payload: s }); }, []);
  const updateSite = useCallback(async (s: Site)  => { await dbPutSite(s); dispatch({ type: 'UPDATE_SITE', payload: s }); }, []);
  const deleteSite = useCallback(async (id: string) => { await dbDeleteSite(id); dispatch({ type: 'DELETE_SITE', payload: id }); }, []);
  const setTimeRange = useCallback((r: TimeRange) => dispatch({ type: 'SET_TIME_RANGE', payload: r }), []);
  const clearAllData = useCallback(async () => { await dbClearAll(); dispatch({ type: 'SET_SITES', payload: [] }); }, []);
  const exportData   = useCallback((): string => JSON.stringify({ sites: state.sites, exportedAt: Date.now() }, null, 2), [state.sites]);
  const importData   = useCallback(async (json: string) => {
    const parsed = JSON.parse(json);
    for (const site of (parsed.sites || [])) await dbPutSite(site);
    loadSites();
  }, [loadSites]);

  return (
    <AppContext.Provider value={{ state, addSite, updateSite, deleteSite, setTimeRange, clearAllData, exportData, importData }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

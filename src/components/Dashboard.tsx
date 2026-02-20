import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { Chart } from './Chart';
import { SiteEditor } from './SiteEditor';
import { Settings } from './Settings';
import { clearSession } from '../utils/auth';
import type { Site, TimeRange } from '../types';

interface DashboardProps {
  onLogout: () => void;
}

const PRESETS = [
  { label: '6H',  hours: 6 },
  { label: '24H', hours: 24 },
  { label: '3D',  hours: 72 },
  { label: '7D',  hours: 168 },
  { label: '30D', hours: 720 },
];

export function Dashboard({ onLogout }: DashboardProps) {
  const { state, setTimeRange, deleteSite } = useApp();
  const [editSite, setEditSite]   = useState<Site | undefined>(undefined);
  const [showNew, setShowNew]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activePreset, setActivePreset] = useState('7D');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]   = useState('');

  const applyPreset = (p: { label: string; hours: number }) => {
    const end = Date.now();
    setTimeRange({ start: end - p.hours * 3_600_000, end, label: `Last ${p.label}` });
    setActivePreset(p.label);
  };

  const applyCustom = () => {
    const s = new Date(customStart).getTime();
    const e = new Date(customEnd).getTime();
    if (isNaN(s) || isNaN(e) || s >= e) { alert('Invalid range'); return; }
    setTimeRange({ start: s, end: e, label: 'Custom' });
    setActivePreset('');
  };

  const { sites, timeRange, loading } = state;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a1a', fontFamily: 'JetBrains Mono, monospace', color: '#ccc', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px',
        background: '#111', borderBottom: '1px solid #2a2a2a', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '12px', color: '#33cc00', letterSpacing: '3px', marginRight: '8px', whiteSpace: 'nowrap' }}>
          NETMON
        </span>

        {/* Presets */}
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p)} style={{
            padding: '5px 10px', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px', borderRadius: '2px',
            background: activePreset === p.label ? '#0a2a1a' : 'none',
            border: activePreset === p.label ? '1px solid #33cc00' : '1px solid #333',
            color: activePreset === p.label ? '#33cc00' : '#555',
          }}>{p.label}</button>
        ))}

        {/* Custom range */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <input type="datetime-local" value={customStart} onChange={e => setCustomStart(e.target.value)}
            style={miniInput} />
          <span style={{ color: '#333', fontSize: '11px' }}>—</span>
          <input type="datetime-local" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
            style={miniInput} />
          <button onClick={applyCustom} style={{
            padding: '5px 10px', background: 'none', border: '1px solid #333', borderRadius: '2px',
            color: '#555', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', cursor: 'pointer',
          }}>Apply</button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button onClick={() => setShowNew(true)} style={topBtn('#33cc00', '#0a1a0a')}>+ Add</button>
          <button onClick={() => setShowSettings(true)} style={topBtn('#555', 'none')}>Settings</button>
          <button onClick={() => { clearSession(); onLogout(); }} style={topBtn('#444', 'none')}>Logout</button>
        </div>
      </div>

      {/* Chart list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading && (
          <div style={{ textAlign: 'center', marginTop: '80px', color: '#333', fontSize: '12px' }}>Loading...</div>
        )}

        {!loading && sites.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '80px', color: '#333', fontSize: '12px' }}>
            <div style={{ marginBottom: '16px' }}>No sites. Click <span style={{ color: '#33cc00' }}>+ Add</span> to create one.</div>
          </div>
        )}

        {!loading && sites.map(site => (
          <SiteCard
            key={site.id}
            site={site}
            timeRange={timeRange}
            onEdit={() => setEditSite(site)}
          />
        ))}
      </div>

      {showNew && <SiteEditor onClose={() => setShowNew(false)} />}
      {editSite && <SiteEditor site={editSite} onClose={() => setEditSite(undefined)} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function SiteCard({ site, timeRange, onEdit }: { site: Site; timeRange: TimeRange; onEdit: () => void }) {
  const rangeIn  = site.dataIn.filter(d => d.timestamp >= timeRange.start && d.timestamp <= timeRange.end);
  const rangeOut = site.dataOut.filter(d => d.timestamp >= timeRange.start && d.timestamp <= timeRange.end);

  const stats = (pts: typeof rangeIn) => {
    if (!pts.length) return { cur: null, avg: null, max: null };
    const vals = pts.map(d => d.value);
    return {
      cur: vals[vals.length - 1],
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      max: Math.max(...vals),
    };
  };

  const si = stats(rangeIn);
  const so = stats(rangeOut);

  const fmt = (v: number | null, u: string) => {
    if (v === null) return '-nan';
    if (u === 'Mbps' || u === 'bps') {
      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
      if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
      return `${v.toFixed(1)}`;
    }
    return v.toFixed(2);
  };

  return (
    <div style={{ background: '#111', border: '1px solid #252525', borderRadius: '3px', overflow: 'hidden' }}>
      {/* Card header — minimal, like MRTG */}
      <div style={{
        padding: '7px 12px', borderBottom: '1px solid #1e1e1e',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#0d0d0d',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%', background: site.colorIn,
            display: 'inline-block', boxShadow: `0 0 6px ${site.colorIn}`,
          }} />
          <span style={{ fontSize: '13px', color: '#ddd', letterSpacing: '0.5px' }}>{site.name}</span>
          <span style={{ fontSize: '10px', color: '#444', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {site.unit}
          </span>
        </div>

        {/* Stats row — identical to MRTG legend */}
        <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
          <StatTable
            inLabel="In" outLabel="Out"
            labels={['Current', 'Average', 'Maximum']}
            inVals={[fmt(si.cur, site.unit), fmt(si.avg, site.unit), fmt(si.max, site.unit)]}
            outVals={site.type === 'traffic' ? [fmt(so.cur, site.unit), fmt(so.avg, site.unit), fmt(so.max, site.unit)] : null}
            colorIn={site.colorIn}
            colorOut={site.colorOut}
            unit={site.unit}
          />
          <button onClick={onEdit} style={{
            background: 'none', border: '1px solid #2a2a2a', borderRadius: '2px',
            color: '#444', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
            padding: '4px 9px', cursor: 'pointer', letterSpacing: '1px',
          }}>EDIT</button>
        </div>
      </div>

      {/* Chart — responsive */}
      <ResponsiveChart site={site} timeRange={timeRange} />
    </div>
  );
}

function StatTable({
  labels, inVals, outVals, colorIn, colorOut, unit, inLabel, outLabel,
}: {
  labels: string[];
  inVals: string[];
  outVals: string[] | null;
  colorIn: string;
  colorOut: string;
  unit: string;
  inLabel: string;
  outLabel: string;
}) {
  return (
    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        <div style={{ color: '#333', width: '50px' }} />
        {labels.map(l => (
          <div key={l} style={{ color: '#444', width: '70px', textAlign: 'right' }}>{l}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
        <div style={{ color: colorIn, width: '50px' }}>{inLabel}</div>
        {inVals.map((v, i) => (
          <div key={i} style={{ color: colorIn, width: '70px', textAlign: 'right' }}>{v} {unit}</div>
        ))}
      </div>
      {outVals && (
        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
          <div style={{ color: colorOut, width: '50px' }}>{outLabel}</div>
          {outVals.map((v, i) => (
            <div key={i} style={{ color: colorOut, width: '70px', textAlign: 'right' }}>{v} {unit}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResponsiveChart({ site, timeRange }: { site: Site; timeRange: TimeRange }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <Chart site={site} startTs={timeRange.start} endTs={timeRange.end} width={width} height={220} />
    </div>
  );
}

const miniInput: React.CSSProperties = {
  background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: '2px',
  color: '#666', fontFamily: 'JetBrains Mono, monospace',
  fontSize: '10px', padding: '5px 7px', outline: 'none',
};

function topBtn(color: string, bg: string): React.CSSProperties {
  return {
    padding: '5px 12px', background: bg, border: `1px solid ${color}`,
    borderRadius: '2px', color, fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10px', cursor: 'pointer', letterSpacing: '1px',
  };
}

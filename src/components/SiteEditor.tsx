import React, { useState } from 'react';
import type { Site, SiteType } from '../types';
import { useApp } from '../store/AppContext';
import { generateSmoothData } from '../utils/dataGen';

interface SiteEditorProps {
  site?: Site;
  onClose: () => void;
}

function newSite(): Site {
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    name: 'New Interface',
    type: 'traffic',
    colorIn: '#33cc00',
    colorOut: '#cc44cc',
    unit: 'Mbps',
    axisMax: 20,
    dataIn: [],
    dataOut: [],
  };
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#1a1a1a', border: '1px solid #333', borderRadius: '2px',
  color: '#ccc', fontFamily: 'JetBrains Mono, monospace',
  fontSize: '12px', padding: '7px 10px', outline: 'none',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: '10px', color: '#666',
  letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '5px',
};
const primaryBtn: React.CSSProperties = {
  background: '#0a2a1a', border: '1px solid #33cc00', borderRadius: '2px',
  color: '#33cc00', fontFamily: 'JetBrains Mono, monospace',
  fontSize: '11px', padding: '8px 16px', cursor: 'pointer', letterSpacing: '1px',
};
const ghostBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #333', borderRadius: '2px',
  color: '#666', fontFamily: 'JetBrains Mono, monospace',
  fontSize: '11px', padding: '7px 12px', cursor: 'pointer',
};

export function SiteEditor({ site, onClose }: SiteEditorProps) {
  const { addSite, updateSite, deleteSite } = useApp();
  const isNew = !site;
  const [form, setForm] = useState<Site>(site ?? newSite());
  const [tab, setTab] = useState<'config' | 'data'>('config');

  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [genStart, setGenStart] = useState(weekAgo.toISOString().slice(0, 16));
  const [genEnd, setGenEnd] = useState(now.toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Site, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { alert('Site name required.'); return; }
    setSaving(true);
    isNew ? await addSite(form) : await updateSite(form);
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!site) return;
    if (!confirm(`Delete "${site.name}"?`)) return;
    await deleteSite(site.id);
    onClose();
  };

  const generate = (series: 'in' | 'out') => {
    const s = new Date(genStart).getTime();
    const e = new Date(genEnd).getTime();
    if (isNaN(s) || isNaN(e) || s >= e) { alert('Invalid date range'); return; }
    const min = form.axisMax * 0.05;
    const max = form.axisMax * 0.95;
    const data = generateSmoothData(s, e, min, max);
    setForm(f => ({ ...f, [series === 'in' ? 'dataIn' : 'dataOut']: data }));
  };

  const generateBoth = () => {
    const s = new Date(genStart).getTime();
    const e = new Date(genEnd).getTime();
    if (isNaN(s) || isNaN(e) || s >= e) { alert('Invalid date range'); return; }
    const inData = generateSmoothData(s, e, form.axisMax * 0.3, form.axisMax * 0.95);
    const outData = generateSmoothData(s, e, form.axisMax * 0.05, form.axisMax * 0.5);
    setForm(f => ({ ...f, dataIn: inData, dataOut: outData }));
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      <div style={{
        width: '480px', maxHeight: '88vh', overflowY: 'auto',
        background: '#141414', border: '1px solid #2a2a2a', borderRadius: '3px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.9)',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#33cc00', letterSpacing: '2px', textTransform: 'uppercase' }}>
            {isNew ? 'Add Site' : 'Edit Site'}
          </span>
          <button onClick={onClose} style={{ ...ghostBtn, padding: '2px 8px', fontSize: '13px' }}>x</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
          {(['config', 'data'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '9px', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid #33cc00' : '2px solid transparent',
              color: tab === t ? '#33cc00' : '#555',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
              letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer',
            }}>{t === 'config' ? 'Configuration' : 'Data'}</button>
          ))}
        </div>

        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tab === 'config' && <>
            <div>
              <span style={label}>Name</span>
              <input value={form.name} onChange={e => set('name', e.target.value)} style={inp} />
            </div>

            <div>
              <span style={label}>Type</span>
              <select value={form.type} onChange={e => set('type', e.target.value as SiteType)} style={inp}>
                <option value="traffic">Traffic (Bidirectional — In/Out)</option>
                <option value="latency">Latency (Single line)</option>
              </select>
            </div>

            <div>
              <span style={label}>Unit</span>
              <select value={form.unit} onChange={e => set('unit', e.target.value)} style={inp}>
                <option value="Mbps">Mbps</option>
                <option value="bps">bps</option>
                <option value="ms">ms (milliseconds)</option>
                <option value="%">% (percent)</option>
                <option value="pkt/s">pkt/s</option>
              </select>
            </div>

            <div>
              <span style={label}>Y Axis Max ({form.unit})</span>
              <input type="number" value={form.axisMax} onChange={e => set('axisMax', +e.target.value)} style={inp} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={label}>Color IN</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="color" value={form.colorIn} onChange={e => set('colorIn', e.target.value)}
                    style={{ width: '36px', height: '32px', border: 'none', background: 'none', cursor: 'pointer' }} />
                  <span style={{ fontSize: '11px', color: form.colorIn }}>{form.colorIn}</span>
                </div>
              </div>
              {form.type === 'traffic' && (
                <div>
                  <span style={label}>Color OUT</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" value={form.colorOut} onChange={e => set('colorOut', e.target.value)}
                      style={{ width: '36px', height: '32px', border: 'none', background: 'none', cursor: 'pointer' }} />
                    <span style={{ fontSize: '11px', color: form.colorOut }}>{form.colorOut}</span>
                  </div>
                </div>
              )}
            </div>
          </>}

          {tab === 'data' && <>
            {/* Stats */}
            <div style={{ padding: '10px 12px', background: '#0e0e0e', border: '1px solid #222', borderRadius: '2px', fontSize: '11px', color: '#555' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>IN points: <span style={{ color: form.colorIn }}>{form.dataIn.length.toLocaleString()}</span></span>
                {form.type === 'traffic' && <span>OUT points: <span style={{ color: form.colorOut }}>{form.dataOut.length.toLocaleString()}</span></span>}
              </div>
            </div>

            {/* Date range picker */}
            <div>
              <span style={label}>Generate Range</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input type="datetime-local" value={genStart} onChange={e => setGenStart(e.target.value)} style={inp} />
                <input type="datetime-local" value={genEnd} onChange={e => setGenEnd(e.target.value)} style={inp} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {form.type === 'traffic' ? (
                <>
                  <button onClick={generateBoth} style={primaryBtn}>Generate Both (In + Out)</button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button onClick={() => generate('in')} style={{ ...ghostBtn, color: form.colorIn, borderColor: form.colorIn + '66' }}>
                      Regen IN only
                    </button>
                    <button onClick={() => generate('out')} style={{ ...ghostBtn, color: form.colorOut, borderColor: form.colorOut + '66' }}>
                      Regen OUT only
                    </button>
                  </div>
                </>
              ) : (
                <button onClick={() => generate('in')} style={primaryBtn}>Generate Data</button>
              )}

              {(form.dataIn.length > 0 || form.dataOut.length > 0) && (
                <button
                  onClick={() => { if (confirm('Clear all data?')) setForm(f => ({ ...f, dataIn: [], dataOut: [] })); }}
                  style={{ ...ghostBtn, color: '#aa3333', borderColor: '#331111' }}
                >
                  Clear All Data
                </button>
              )}
            </div>
          </>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>{!isNew && <button onClick={handleDelete} style={{ ...ghostBtn, color: '#aa3333' }}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={ghostBtn}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={primaryBtn}>
              {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { changePassword } from '../utils/auth';
import { useApp } from '../store/AppContext';

export function Settings({ onClose }: { onClose: () => void }) {
  const { clearAllData, exportData, importData } = useApp();
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const changePw = async () => {
    setMsg(''); setErr('');
    if (newPw.length < 6) { setErr('Min 6 characters.'); return; }
    if (newPw !== confirmPw) { setErr('Passwords do not match.'); return; }
    await changePassword(newPw);
    setNewPw(''); setConfirmPw('');
    setMsg('Password updated.');
  };

  const doExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `netmon-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { await importData(await f.text()); alert('Imported.'); }
    catch { alert('Invalid file.'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: '2px',
    color: '#ccc', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
    padding: '7px 10px', outline: 'none',
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, fontFamily: 'JetBrains Mono, monospace',
    }}>
      <div style={{ width: '400px', background: '#141414', border: '1px solid #2a2a2a', borderRadius: '3px' }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#33cc00', letterSpacing: '2px', textTransform: 'uppercase' }}>Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' }}>x</button>
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <section>
            <div style={sectionLabel}>Change Password</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input type="password" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inp} />
              <input type="password" placeholder="Confirm password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={inp} />
              {msg && <div style={{ fontSize: '11px', color: '#33cc00' }}>{msg}</div>}
              {err && <div style={{ fontSize: '11px', color: '#cc3333' }}>{err}</div>}
              <button onClick={changePw} style={actionBtn}>Update Password</button>
            </div>
          </section>

          <div style={{ height: '1px', background: '#1e1e1e' }} />

          <section>
            <div style={sectionLabel}>Backup / Restore</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={doExport} style={actionBtn}>Export JSON</button>
              <button onClick={() => fileRef.current?.click()} style={{ ...actionBtn, background: 'none', borderColor: '#333', color: '#666' }}>
                Import JSON
              </button>
              <input ref={fileRef} type="file" accept=".json" onChange={doImport} style={{ display: 'none' }} />
            </div>
          </section>

          <div style={{ height: '1px', background: '#1e1e1e' }} />

          <section>
            <div style={{ ...sectionLabel, color: '#773333' }}>Danger Zone</div>
            <button onClick={async () => { if (confirm('Delete ALL data?')) await clearAllData(); }} style={{ ...actionBtn, borderColor: '#441111', color: '#aa3333', background: 'none' }}>
              Reset All Data
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10px', color: '#555', letterSpacing: '2px',
  textTransform: 'uppercase', marginBottom: '10px',
};
const actionBtn: React.CSSProperties = {
  padding: '7px 14px', background: '#0a2a1a', border: '1px solid #33cc00',
  borderRadius: '2px', color: '#33cc00', fontFamily: 'JetBrains Mono, monospace',
  fontSize: '11px', cursor: 'pointer',
};

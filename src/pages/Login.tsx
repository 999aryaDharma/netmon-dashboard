import React, { useState, useEffect } from 'react';
import { verifyPassword, initAuth, createSession } from '../utils/auth';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { initAuth(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true); setError('');
    const valid = await verifyPassword(password);
    setLoading(false);
    if (valid) { createSession(); onLogin(); }
    else setError('Wrong password. Default: admin123');
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0d0d0d',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      <div style={{
        width: '320px', padding: '36px', background: '#111',
        border: '1px solid #1e1e1e', borderRadius: '3px',
        boxShadow: '0 0 60px rgba(50, 200, 50, 0.05)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '22px', color: '#33cc00', fontWeight: 700, letterSpacing: '2px' }}>NETMON</div>
          <div style={{ fontSize: '10px', color: '#2a4a2a', letterSpacing: '4px', marginTop: '4px' }}>NOC DASHBOARD</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="password" autoFocus
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0a0a0a', border: '1px solid #222', borderRadius: '2px',
              color: '#33cc00', fontFamily: 'JetBrains Mono, monospace',
              fontSize: '14px', padding: '10px 12px', outline: 'none', letterSpacing: '2px',
            }}
          />
          {error && <div style={{ fontSize: '11px', color: '#cc4444', padding: '6px 8px', background: '#1a0a0a', border: '1px solid #2a1111', borderRadius: '2px' }}>{error}</div>}
          <button type="submit" disabled={loading || !password} style={{
            padding: '10px', background: '#0a1e0a', border: '1px solid #33cc00',
            borderRadius: '2px', color: '#33cc00', fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px', letterSpacing: '3px', cursor: 'pointer', opacity: password ? 1 : 0.4,
          }}>
            {loading ? 'CHECKING...' : 'LOGIN'}
          </button>
        </form>
      </div>
    </div>
  );
}

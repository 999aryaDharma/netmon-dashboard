import React, { Component, ErrorInfo, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0b0f14',
          color: '#ff4444',
          padding: '40px',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>⚠️ Application Error</h1>
          <pre style={{
            background: '#1a1a1a',
            padding: '20px',
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '12px',
            color: '#ccc',
          }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => {
              localStorage.clear();
              indexedDB.deleteDatabase('netmon');
              window.location.reload();
            }}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#33cc00',
              border: 'none',
              borderRadius: '4px',
              color: '#000',
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer',
            }}
          >
            Reset App Data & Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; width: 100%; }
  body {
    background: #1a1a1a;
    color: #ccc;
    font-family: 'JetBrains Mono', monospace;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
  input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(0.3); }
  select option { background: #141414; color: #ccc; }
  button:hover { opacity: 0.85; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

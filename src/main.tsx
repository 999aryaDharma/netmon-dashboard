import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'

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
  <React.StrictMode><App /></React.StrictMode>
);

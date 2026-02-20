import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { AppProvider } from './store/AppContext';
import { isSessionValid } from './utils/auth';

export function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if session exists on load
    setAuthenticated(isSessionValid());
    setChecking(false);
  }, []);

  if (checking) return null;

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <AppProvider>
      <Dashboard onLogout={() => setAuthenticated(false)} />
    </AppProvider>
  );
}

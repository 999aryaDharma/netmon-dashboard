const AUTH_KEY = 'netmon_auth';
const SESSION_KEY = 'netmon_session';
const DEFAULT_PASSWORD = 'admin123';

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function initAuth(): Promise<void> {
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) {
    const hash = await sha256(DEFAULT_PASSWORD);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ passwordHash: hash }));
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) return false;
  const { passwordHash } = JSON.parse(stored);
  const hash = await sha256(password);
  return hash === passwordHash;
}

export async function changePassword(newPassword: string): Promise<void> {
  const hash = await sha256(newPassword);
  localStorage.setItem(AUTH_KEY, JSON.stringify({ passwordHash: hash }));
}

export function createSession(): void {
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  sessionStorage.setItem(SESSION_KEY, token);
}

export function isSessionValid(): boolean {
  return !!sessionStorage.getItem(SESSION_KEY);
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

import type { DataPoint } from '../types';

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function generateSmoothData(
  startTs: number,
  endTs: number,
  min: number,
  max: number
): DataPoint[] {
  const hourMs = 3_600_000;
  const range = max - min;
  const controlInterval = 6 * hourMs;
  const controlCount = Math.ceil((endTs - startTs) / controlInterval) + 2;
  const controls: number[] = [];

  let last = min + Math.random() * range * 0.6 + range * 0.2;
  for (let i = 0; i < controlCount; i++) {
    const delta = (Math.random() - 0.5) * range * 0.35;
    last = Math.max(min, Math.min(max, last + delta));
    controls.push(last);
  }

  const points: DataPoint[] = [];
  let ts = startTs;
  while (ts <= endTs) {
    const elapsed = ts - startTs;
    const ci = elapsed / controlInterval;
    const idx = Math.floor(ci);
    const frac = smoothstep(ci - idx);
    const v0 = controls[Math.min(idx, controls.length - 1)];
    const v1 = controls[Math.min(idx + 1, controls.length - 1)];
    const base = v0 + (v1 - v0) * frac;
    const jitter = (Math.random() - 0.5) * range * 0.04;
    const value = Math.max(min, Math.min(max, base + jitter));
    points.push({ timestamp: ts, value: Math.round(value * 100) / 100 });
    ts += hourMs;
  }
  return points;
}

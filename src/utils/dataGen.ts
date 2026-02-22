// Generator trafik realistis dengan pola jam sibuk

export function generateTraffic({
  hours,
  base = 8,
  variance = 2,
  peakBoost = 4,
  seed = 1,
}: {
  hours: number;
  base?: number;
  variance?: number;
  peakBoost?: number;
  seed?: number;
}): number[] {
  let s = seed;

  function rand() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  }

  const data: number[] = [];

  for (let i = 0; i < hours; i++) {
    const hourOfDay = i % 24;

    // Jam sibuk 09-18
    const peak =
      hourOfDay >= 9 && hourOfDay <= 18
        ? peakBoost * Math.sin((hourOfDay - 9) / 9 * Math.PI)
        : 0;

    const noise = (rand() - 0.5) * variance;

    data.push(Math.max(0, base + peak + noise));
  }

  return data;
}

// Generate data dengan timestamp untuk Chart component
export function generateSmoothData(
  startTs: number,
  endTs: number,
  min: number,
  max: number,
  seed?: number,
  interval: number = 15 * 60 * 1000 // Default 15 menit
): { timestamp: number; value: number }[] {
  const points: { timestamp: number; value: number }[] = [];
  const range = max - min;
  const base = min;

  let s = seed || Math.floor(Math.random() * 10000);

  function rand() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  }

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const date = new Date(ts);
    const hour = date.getHours();

    // Pola harian: lebih tinggi di jam kerja
    let timeFactor = 0.3;
    if (hour >= 9 && hour <= 18) {
      timeFactor = 0.7 + 0.3 * Math.sin((hour - 9) / 9 * Math.PI);
    } else if (hour >= 19 && hour <= 23) {
      timeFactor = 0.5;
    }

    // Noise kecil untuk realisme
    const noise = (rand() - 0.5) * 0.15 * range;

    const value = Math.max(0, base + range * timeFactor + noise);

    points.push({ timestamp: ts, value });
  }

  return points;
}

// Generate data RTT realistis untuk ping monitoring
export function generatePingData(
  startTs: number,
  endTs: number,
  options?: {
    baseRtt?: number; // Base RTT dalam ms
    variance?: number; // Variance RTT
    spikeChance?: number; // Kemungkinan spike (0-1)
    lossChance?: number; // Kemungkinan packet loss (0-1)
    seed?: number;
  },
  interval: number = 15 * 60 * 1000 // Default 15 menit
): { rtt: { timestamp: number; value: number }[]; loss: { timestamp: number; value: number }[] } {
  const rtt: { timestamp: number; value: number }[] = [];
  const loss: { timestamp: number; value: number }[] = [];

  const baseRtt = options?.baseRtt ?? 20; // ms
  const variance = options?.variance ?? 10;
  const spikeChance = options?.spikeChance ?? 0.05;
  const lossChance = options?.lossChance ?? 0.02;

  let s = options?.seed || Math.floor(Math.random() * 10000);

  function rand() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  }

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const date = new Date(ts);
    const hour = date.getHours();

    // Pola harian: RTT lebih tinggi di jam sibuk
    let timeFactor = 1;
    if (hour >= 9 && hour <= 21) {
      timeFactor = 1.2 + 0.3 * Math.sin((hour - 9) / 12 * Math.PI);
    }

    // Random noise
    const noise = (rand() - 0.5) * variance;

    // Spike occasional
    let spike = 0;
    if (rand() < spikeChance) {
      spike = rand() * 100 + 50; // Spike 50-150ms
    }

    // Packet loss event
    let lossValue = 0;
    if (rand() < lossChance) {
      lossValue = Math.min(100, rand() * 50 + 10); // Loss 10-60%
    }

    const rttValue = Math.max(5, baseRtt * timeFactor + noise + spike);

    rtt.push({ timestamp: ts, value: rttValue });
    loss.push({ timestamp: ts, value: lossValue });
  }

  return { rtt, loss };
}

// Generator pseudo-random berbasis seed agar pola selalu konsisten tiap di-refresh
function seededRandom(seed: number) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateSmoothData(
  startTs: number,
  endTs: number,
  min: number,
  max: number,
  seed: number = Math.random() * 10000,
  interval: number = 60 * 60 * 1000,
  isCCTV: boolean = false,
): { timestamp: number; value: number }[] {
  const points: { timestamp: number; value: number }[] = [];
  const range = max - min;
  const rand = seededRandom(seed);

  const phaseShift = rand() * Math.PI * 2;
  const peakHourShift = (rand() - 0.5) * 8;
  const volumeMultiplier = 0.5 + rand() * 0.5;

  let outageRemaining = 0;

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const date = new Date(ts);
    const originalHour = date.getHours() + date.getMinutes() / 60;

    if (outageRemaining > 0) {
      outageRemaining--;
      points.push({
        timestamp: ts,
        value: min * 0.05 + rand() * (range * 0.02),
      });
      continue;
    }

    if (rand() < 0.008) {
      outageRemaining = Math.floor(rand() * 6) + 1;
      points.push({
        timestamp: ts,
        value: min * 0.05 + rand() * (range * 0.02),
      });
      continue;
    }

    let value: number;

    if (isCCTV) {
      // CCTV Jitter Kasar (Fluktuasi sangat tinggi)
      const baseTraffic = min + range * 0.7;
      const jitter = (rand() - 0.5) * (range * 0.5);
      value = baseTraffic + jitter;
    } else {
      const shiftedHour = (originalHour + peakHourShift + 24) % 24;
      let dailyWave = Math.sin(((shiftedHour - 8) / 12) * Math.PI);
      dailyWave = Math.max(0.1, dailyWave) * volumeMultiplier;

      const midWave = Math.sin(ts / (1000 * 60 * 60 * 6) + phaseShift) * 0.15;
      const noise = (rand() - 0.5) * 0.25;
      let spike = rand() < 0.02 ? rand() * 0.4 : 0;

      let finalMultiplier = dailyWave * 0.7 + midWave + noise + spike;
      finalMultiplier = Math.max(0.05, Math.min(1.1, finalMultiplier));
      value = min + range * finalMultiplier;
    }

    points.push({ timestamp: ts, value: Math.floor(Math.max(0, value)) });
  }

  return points;
}

export function generatePingData(
  startTs: number,
  endTs: number,
  options?: { baseRtt?: number; variance?: number; seed?: number },
  interval: number = 60 * 60 * 1000,
): {
  rtt: { timestamp: number; value: number }[];
  loss: { timestamp: number; value: number }[];
} {
  const rtt: { timestamp: number; value: number }[] = [];
  const loss: { timestamp: number; value: number }[] = [];

  const baseRtt = options?.baseRtt ?? 15;
  const variance = options?.variance ?? 3;
  const rand = seededRandom(options?.seed || 1234);

  let outageRemaining = 0;

  for (let ts = startTs; ts <= endTs; ts += interval) {
    if (outageRemaining > 0) {
      outageRemaining--;
      rtt.push({ timestamp: ts, value: 0 });
      loss.push({ timestamp: ts, value: 100 });
      continue;
    }

    if (rand() < 0.008) {
      outageRemaining = Math.floor(rand() * 6) + 1;
      rtt.push({ timestamp: ts, value: 0 });
      loss.push({ timestamp: ts, value: 100 });
      continue;
    }

    const date = new Date(ts);
    const hour = date.getHours();

    let rttValue = baseRtt + (rand() - 0.5) * variance;
    let lossValue = 0;
    const eventRoll = rand();

    if (eventRoll < 0.01) {
      rttValue = baseRtt * (3 + rand() * 5);
      lossValue = rand() * 15 + 5;
    } else if (eventRoll < 0.04) {
      rttValue = baseRtt * (1.5 + rand() * 1.5);
      lossValue = rand() * 2;
    } else {
      lossValue = rand() < 0.02 ? rand() * 0.5 : 0;
      if (hour >= 9 && hour <= 18) rttValue *= 1.05 + rand() * 0.1;
    }

    rtt.push({ timestamp: ts, value: Math.max(0, rttValue) });
    loss.push({ timestamp: ts, value: lossValue });
  }

  return { rtt, loss };
}

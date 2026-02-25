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
  interval: number = 60 * 60 * 1000, // Default 1 Jam
): { timestamp: number; value: number }[] {
  const points: { timestamp: number; value: number }[] = [];
  const range = max - min;
  const rand = seededRandom(seed);

  const phase2 = rand() * Math.PI * 2;
  const phase3 = rand() * Math.PI * 2;

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const date = new Date(ts);
    const hour = date.getHours() + date.getMinutes() / 60;
    const dayOfWeek = date.getDay(); // 0 = Minggu, 6 = Sabtu

    // 1. Siklus Harian (Sibuk jam kerja, sepi malam hari)
    let dailyWave = Math.sin(((hour - 8) / 12) * Math.PI);
    dailyWave = Math.max(0.1, dailyWave);

    // 2. Efek Akhir Pekan (Trafik turun 30-40% di Sabtu/Minggu)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendMultiplier = isWeekend ? 0.6 + rand() * 0.1 : 1.0;

    // 3. Gelombang Menengah & Cepat (Fluktuasi natural)
    const midWave = Math.sin(ts / (1000 * 60 * 60 * 4) + phase2) * 0.15;
    const fastWave = Math.sin(ts / (1000 * 60 * 45) + phase3) * 0.05;

    let combined = (dailyWave * 0.7 + midWave + fastWave) * weekendMultiplier;
    combined = Math.max(0, Math.min(1, combined));

    // 4. Noise Natural
    const noise = (rand() - 0.5) * 0.08;

    // 5. ANOMALI JARINGAN (GANGGUAN REALISTIS)
    let anomalyMultiplier = 1;
    const eventRoll = rand();

    if (eventRoll < 0.002) {
      // 0.2% Peluang: Outage / Link Down (Trafik drop hampir 0)
      anomalyMultiplier = rand() * 0.05;
    } else if (eventRoll < 0.005) {
      // 0.3% Peluang: Gangguan Medium (Trafik drop tiba-tiba)
      anomalyMultiplier = 0.2 + rand() * 0.3;
    } else if (eventRoll < 0.015) {
      // 1% Peluang: Lonjakan Ekstrem (Misal DDOS, Backup terjadwal, Event khusus)
      anomalyMultiplier = 1.4 + rand() * 0.6;
    }

    const finalMultiplier = Math.max(
      0,
      Math.min(1.2, (combined + noise) * anomalyMultiplier),
    );
    let value = min + range * finalMultiplier;

    // Pastikan tidak ada nilai negatif
    points.push({ timestamp: ts, value: Math.max(0, value) });
  }

  return points;
}

export function generatePingData(
  startTs: number,
  endTs: number,
  options?: { baseRtt?: number; variance?: number; seed?: number },
  interval: number = 60 * 60 * 1000, // Default 1 Jam
): {
  rtt: { timestamp: number; value: number }[];
  loss: { timestamp: number; value: number }[];
} {
  const rtt: { timestamp: number; value: number }[] = [];
  const loss: { timestamp: number; value: number }[] = [];

  const baseRtt = options?.baseRtt ?? 15;
  const variance = options?.variance ?? 3;
  const rand = seededRandom(options?.seed || 1234);

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const date = new Date(ts);
    const hour = date.getHours();

    let rttValue = baseRtt + (rand() - 0.5) * variance;
    let lossValue = 0;
    const eventRoll = rand();

    // ANOMALI PING (GANGGUAN)
    if (eventRoll < 0.002) {
      // 0.2% Peluang: RTO / Link Mati Total
      rttValue = 0;
      lossValue = 100;
    } else if (eventRoll < 0.01) {
      // 0.8% Peluang: Kongesti Berat (Ping bengkak 3x-8x lipat, Loss 5-20%)
      rttValue = baseRtt * (3 + rand() * 5);
      lossValue = rand() * 15 + 5;
    } else if (eventRoll < 0.04) {
      // 3% Peluang: Jitter Ringan (Ping naik sedikit, Loss 1-2%)
      rttValue = baseRtt * (1.5 + rand() * 1.5);
      lossValue = rand() * 2;
    } else {
      // Kondisi Normal: Kadang ada loss background sangat kecil (0 - 0.5%)
      lossValue = rand() < 0.02 ? rand() * 0.5 : 0;
      // Sedikit kenaikan ping di jam sibuk kerja
      if (hour >= 9 && hour <= 18) rttValue *= 1.05 + rand() * 0.1;
    }

    rtt.push({ timestamp: ts, value: Math.max(0, rttValue) });
    loss.push({ timestamp: ts, value: lossValue });
  }

  return { rtt, loss };
}

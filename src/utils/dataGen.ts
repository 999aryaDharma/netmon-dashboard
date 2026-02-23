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
// Menggunakan algoritma komposit 3 gelombang sine untuk "DNA unik" per site
export function generateSmoothData(
  startTs: number,
  endTs: number,
  min: number,
  max: number,
  seed: number = Math.random() * 10000,
  interval: number = 15 * 60 * 1000 // Default 15 menit
): { timestamp: number; value: number }[] {
  const points: { timestamp: number; value: number }[] = [];
  const range = max - min;

  // Kita buat 3 komponen "DNA" gelombang berbeda berdasarkan seed site.
  // Ini memastikan lekukan grafik Site A tidak akan pernah sama dengan Site B.
  const phase1 = seed * 0.13; // Pergeseran fase harian
  const phase2 = seed * 0.71; // Pergeseran fase menengah
  const phase3 = seed * 1.93; // Pergeseran fase cepat

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const date = new Date(ts);
    const hour = date.getHours() + date.getMinutes() / 60;

    // 1. Gelombang Harian Utama (Naik di siang hari, turun malam hari)
    // Offset phase1 membuat puncak kesibukan tiap site bisa meleset sedikit (misal Site A sibuk jam 10, Site B jam 12)
    let dailyWave = Math.sin(((hour - 8 + phase1 % 4) / 12) * Math.PI);
    dailyWave = Math.max(0.1, dailyWave); // Jangan sampai 0 agar terlihat ada traffic idle

    // 2. Gelombang Menengah (Fluktuasi membulat setiap ~4 jam)
    const midWave = Math.sin(ts / (1000 * 60 * 60 * 4) + phase2) * 0.25;

    // 3. Gelombang Cepat (Fluktuasi minor setiap ~45 menit agar terlihat natural)
    const fastWave = Math.sin(ts / (1000 * 60 * 45) + phase3) * 0.1;

    // Gabungkan ketiga gelombang
    let combined = dailyWave * 0.6 + midWave + fastWave;

    // Normalisasi agar grafik tidak tertembus ke luar batas 0.0 - 1.0
    combined = Math.max(0, Math.min(1, combined));

    // Tambahkan noise mikro (2-3%) agar garis tidak murni seperti vektor matematika
    const pseudoRandom = (Math.abs(Math.sin(ts * seed)) - 0.5) * 0.05;

    const finalMultiplier = Math.max(0, Math.min(1, combined + pseudoRandom));
    const value = min + range * finalMultiplier;

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

  const baseRtt = options?.baseRtt ?? 15; // ms - lebih rendah untuk stabilitas
  const variance = options?.variance ?? 3; // Variance KECIL untuk stabilitas
  const spikeChance = options?.spikeChance ?? 0.02; // Sangat jarang spike
  const lossChance = options?.lossChance ?? 0.01; // Sangat jarang loss

  let s = options?.seed || Math.floor(Math.random() * 10000);

  function rand() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  }

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const date = new Date(ts);
    const hour = date.getHours();

    // Pola harian: variasi SANGAT KECIL untuk stabilitas
    let timeFactor = 1;
    if (hour >= 9 && hour <= 21) {
      // Hanya 10-15% variasi di jam sibuk
      timeFactor = 1.05 + 0.05 * Math.sin((hour - 9) / 12 * Math.PI);
    }

    // Random noise - SANGAT KECIL untuk stabilitas
    const noise = (rand() - 0.5) * variance; // +/- 1.5ms max

    // Spike - SANGAT JARANG dan kecil
    let spike = 0;
    if (rand() < spikeChance) {
      spike = rand() * 20 + 10; // Spike kecil 10-30ms saja
    }

    // Packet loss event - NILAI SANGAT KECIL (network stabil)
    let lossValue = 0;
    if (rand() < lossChance) {
      // Loss values: mostly 0.01-0.5%, very rarely up to 2%
      const lossRand = rand();
      if (lossRand < 0.8) {
        // 80% chance: 0.01% - 0.5% (hampir tidak terlihat)
        lossValue = rand() * 0.49 + 0.01;
      } else if (lossRand < 0.95) {
        // 15% chance: 0.5% - 1.5% (masih stabil)
        lossValue = rand() * 1 + 0.5;
      } else {
        // 5% chance: 1.5% - 3% (spike sangat jarang)
        lossValue = rand() * 1.5 + 1.5;
      }
    }

    // RTT value - STABIL di sekitar baseRtt
    const rttValue = Math.max(8, baseRtt + noise + spike);

    rtt.push({ timestamp: ts, value: rttValue });
    loss.push({ timestamp: ts, value: lossValue });
  }

  return { rtt, loss };
}

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
  interval: number = 5 * 60 * 1000, 
  isCCTV: boolean = false
): { timestamp: number; value: number }[] {
  const points: { timestamp: number; value: number }[] = [];
  const range = max - min;
  const rand = seededRandom(seed);

  // --- PERSONALITY TRAITS (Unik per site/interface) ---
  // Setiap site punya karakteristik berbeda yang ditentukan seed
  const volatility = 0.6 + rand() * 0.4;           // 0.6 - 1.0 (SEMUA LIAR!)
  const jitterAmp = 0.3 + rand() * 0.5;            // 0.3 - 0.8 (noise besar)
  const spikeChance = 0.08 + rand() * 0.12;        // 8% - 20% (SERING spike!)
  const spikeMag = 0.8 + rand() * 1.5;             // 0.8x - 2.3x (spike EKSTREM)
  const outageChance = 0.005 + rand() * 0.02;      // 0.5% - 2.5% (outage sering)
  const outageDur = 1 + Math.floor(rand() * 12);   // 1-12 intervals (outage panjang)
  const baselineRatio = 0.05 + rand() * 0.7;       // 0.05 - 0.75 (baseline bervariasi)
  const peakHour = 7 + Math.floor(rand() * 8);     // 07:00 - 15:00 (jam puncak acak)
  const diurnalStrength = 0.1 + rand() * 0.7;      // 0.1 - 0.8 (pola harian bervariasi)
  const weekendDrop = 0.2 + rand() * 0.6;          // 0.2 - 0.8 (penurunan weekend)
  const burstiness = 0.3 + rand() * 0.5;           // 30% - 80% (SERING burst!)
  
  let currentWalk = baselineRatio;
  let trendDirection = rand() > 0.5 ? 1 : -1;
  let burstCounter = 0;
  let burstMultiplier = 1.0;

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const date = new Date(ts);
    const hour = date.getHours() + date.getMinutes() / 60;
    const dayOfWeek = date.getDay(); // 0 = Minggu

    // --- 1. OUTAGE / DOWNTIME (Lebih sering dan lebih lama) ---
    if (rand() < outageChance) {
      const dur = Math.floor(rand() * outageDur) + 1;
      for (let i = 0; i < dur && ts <= endTs; i++) {
        points.push({ timestamp: ts, value: 0 });
        ts += interval;
      }
      continue;
    }

    // --- 2. BURST PERIODS (Kadang ada periode traffic tinggi berturut-turut) ---
    if (burstCounter <= 0 && rand() < burstiness) {
      burstCounter = Math.floor(rand() * 6) + 2; // 2-7 intervals dalam burst
      burstMultiplier = 1.3 + rand() * 0.7;      // 1.3x - 2.0x selama burst
    }
    if (burstCounter > 0) {
      burstCounter--;
      if (burstCounter === 0) burstMultiplier = 1.0;
    }

    // --- 3. DIURNAL CYCLE (Unik per site, TIDAK TERPREDIKSI) ---
    const hourAngle = ((hour - peakHour) / 12) * Math.PI;
    // Tambahkan noise ke diurnal pattern agar tidak smooth
    const diurnalNoise = (rand() - 0.5) * 0.3;
    const diurnalFactor = Math.max(0.1, (1 - diurnalStrength) + diurnalStrength * Math.cos(hourAngle) + diurnalNoise);
    
    // Weekend reduction (unik per site)
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const weekendMod = isWeekend ? weekendDrop : 1.0;

    // --- 4. RANDOM WALK DENGAN MOMENTUM (SANGAT LIAR) ---
    // 25% chance berubah arah tiba-tiba (tidak smooth)
    if (rand() < 0.25) trendDirection *= -1;
    
    // Perubahan besar dan tiba-tiba
    const walkChange = (rand() - 0.5) * volatility * 0.8;
    currentWalk += walkChange * trendDirection;
    
    // Kadang "stuck" di trend yang sama untuk beberapa interval
    if (rand() < 0.3) {
      currentWalk += walkChange * trendDirection * 0.5; // Continue the trend
    }
    
    currentWalk = Math.max(0.02, Math.min(0.98, currentWalk));

    // --- 5. JITTER & NOISE (SANGAT KASAR) ---
    const jitter = (rand() - 0.5) * jitterAmp;
    
    // Micro-bursts (sering dan kasar)
    const microBurst = (rand() < 0.15) ? (rand() - 0.5) * jitterAmp * 0.8 : 0;
    
    // Sharp spikes (very frequent)
    const sharpSpike = (rand() < 0.12) ? (rand() > 0.5 ? 1 : -1) * jitterAmp * 0.6 : 0;

    // --- 6. MAJOR SPIKE (Ekstrem, sering terjadi) ---
    let spike = 0;
    if (rand() < spikeChance) {
      spike = rand() * spikeMag;
      // Kadang spike bertahan beberapa interval
      if (rand() < 0.3) {
        spike = spike * (1 + rand() * 0.5);
      }
    }

    // --- 7. SUDDEN DROPS (Penurunan drastis tiba-tiba) ---
    let suddenDrop = 1.0;
    if (rand() < 0.04) { // 4% chance
      suddenDrop = 0.2 + rand() * 0.3; // Drop 70-80%
    }

    // --- 8. GABUNGKAN SEMUA FAKTOR (KOMPLEKS) ---
    let finalValue = min + range * (
      currentWalk * diurnalFactor * weekendMod * burstMultiplier * suddenDrop + 
      jitter + 
      microBurst + 
      sharpSpike +
      spike
    );

    // --- 9. KHUSUS CCTV (Tetap stabil dengan noise) ---
    if (isCCTV) {
      const cctvBaseline = 0.65 + rand() * 0.3;      // 65-95% max
      const cctvJitter = (rand() - 0.5) * 0.25;      // Jitter lebih besar
      const motionSpike = (rand() < 0.05) ? rand() * 0.3 : 0; // Motion detection lebih sering
      finalValue = min + range * (cctvBaseline + cctvJitter + motionSpike);
    }

    // --- 10. CLAMPING ---
    finalValue = Math.max(min * 0.01, Math.min(max * 0.99, finalValue));

    points.push({ 
      timestamp: ts, 
      value: Math.floor(finalValue) 
    });
  }
  return points;
}

export function generatePingData(
  startTs: number,
  endTs: number,
  options?: { baseRtt?: number; variance?: number; seed?: number },
  interval: number = 5 * 60 * 1000,
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
    // RTO / Outage
    if (outageRemaining > 0) {
      outageRemaining--;
      rtt.push({ timestamp: ts, value: 0 });
      loss.push({ timestamp: ts, value: 100 });
      continue;
    }

    if (rand() < 0.002) {
      outageRemaining = Math.floor(rand() * 4) + 1;
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
      // 1% Kongesti Berat
      rttValue = baseRtt * (3 + rand() * 5);
      lossValue = rand() * 15 + 5;
    } else if (eventRoll < 0.04) {
      // 3% Jitter Ringan
      rttValue = baseRtt * (1.5 + rand() * 1.5);
      lossValue = rand() * 2;
    } else {
      // Normal
      lossValue = rand() < 0.02 ? rand() * 0.5 : 0;
      if (hour >= 9 && hour <= 18) rttValue *= 1.05 + rand() * 0.1;
    }

    rtt.push({ timestamp: ts, value: Math.max(0, rttValue) });
    loss.push({ timestamp: ts, value: lossValue });
  }

  return { rtt, loss };
}

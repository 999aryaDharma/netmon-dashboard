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
  isCCTV: boolean = false,
): { timestamp: number; value: number }[] {
  const points: { timestamp: number; value: number }[] = [];
  const range = max - min;
  const rand = seededRandom(seed);

  // --- PERSONALITY TRAITS (Unik per site/interface) ---
  // Setiap site punya karakteristik berbeda yang ditentukan seed
  // CCTV: tetap pakai semua traits, tapi dengan parameter yang lebih kalem
  const baseVolatility = isCCTV ? 0.3 : 0.6;
  const baseJitterAmp = isCCTV ? 0.2 : 0.3;
  const baseSpikeChance = isCCTV ? 0.15 : 0.08; // CCTV justru lebih sering spike (motion detection)
  const baseSpikeMag = isCCTV ? 1.2 : 0.8; // CCTV spike lebih kecil
  const baseBurstiness = isCCTV ? 0.4 : 0.3; // CCTV juga bisa burst

  const volatility = baseVolatility + rand() * (isCCTV ? 0.3 : 0.4); // CCTV: 0.3-0.6, Non-CCTV: 0.6-1.0
  const jitterAmp = baseJitterAmp + rand() * (isCCTV ? 0.3 : 0.5); // CCTV: 0.2-0.5, Non-CCTV: 0.3-0.8
  const spikeChance = baseSpikeChance + rand() * (isCCTV ? 0.15 : 0.12); // CCTV: 15-30%, Non-CCTV: 8-20%
  const spikeMag = baseSpikeMag + rand() * (isCCTV ? 0.8 : 1.5); // CCTV: 1.2-2.0x, Non-CCTV: 0.8-2.3x
  const outageChance = 0.005 + rand() * 0.02; // 0.5% - 2.5% (outage sering)
  const outageDur = 1 + Math.floor(rand() * 12); // 1-12 intervals (outage panjang)
  const baselineRatio = isCCTV ? 0.4 + rand() * 0.3 : 0.05 + rand() * 0.7; // CCTV baseline lebih tinggi (40-70%)
  const peakHour = 7 + Math.floor(rand() * 8); // 07:00 - 15:00 (jam puncak acak)
  const diurnalStrength = isCCTV ? 0.05 + rand() * 0.25 : 0.1 + rand() * 0.7; // CCTV diurnal lebih lemah
  const weekendDrop = 0.2 + rand() * 0.6; // 0.2 - 0.8 (penurunan weekend)
  const burstiness = baseBurstiness + rand() * (isCCTV ? 0.4 : 0.5); // CCTV: 0.4-0.8, Non-CCTV: 0.3-0.8

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
      burstMultiplier = 1.3 + rand() * 0.7; // 1.3x - 2.0x selama burst
    }
    if (burstCounter > 0) {
      burstCounter--;
      if (burstCounter === 0) burstMultiplier = 1.0;
    }

    // --- 3. DIURNAL CYCLE (Unik per site, TIDAK TERPREDIKSI) ---
    const hourAngle = ((hour - peakHour) / 12) * Math.PI;
    // Tambahkan noise ke diurnal pattern agar tidak smooth dan tidak predictable
    const diurnalNoise = (rand() - 0.5) * 0.3;
    // Kadang "break" pola diurnal dengan fluktuasi acak (20% chance)
    const diurnalBreak = rand() < 0.2 ? (rand() - 0.5) * 0.5 : 0;
    const diurnalFactor = Math.max(
      0.1,
      1 -
        diurnalStrength +
        diurnalStrength * Math.cos(hourAngle) +
        diurnalNoise +
        diurnalBreak,
    );

    // Weekend reduction (unik per site)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
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
    const microBurst = rand() < 0.15 ? (rand() - 0.5) * jitterAmp * 0.8 : 0;

    // Sharp spikes (very frequent)
    const sharpSpike =
      rand() < 0.12 ? (rand() > 0.5 ? 1 : -1) * jitterAmp * 0.6 : 0;

    // --- 6. MAJOR SPIKE (Ekstrem, sering terjadi) ---
    let spike = 0;
    if (rand() < spikeChance) {
      spike = rand() * spikeMag * 0.3; // Kurangi spike agar tidak terlalu liar
    }

    // --- 7. SUDDEN DROPS ---
    // Diproses langsung di step 8 (GABUNGKAN SEMUA FAKTOR)

    // --- 8. GABUNGKAN SEMUA FAKTOR (KOMPLEKS) ---
    // Hitung base value dari walk component
    let rawValue = currentWalk * diurnalFactor * weekendMod * burstMultiplier;

    // Apply sudden drop ke seluruh rawValue (bukan cuma currentWalk)
    if (rand() < 0.04) {
      // 4% chance
      rawValue *= 0.1 + rand() * 0.2; // Drop 80-90% - lebih dramatis dan bersih
    }

    // Batas semua komponen jitter/spike
    const jitterClamped = Math.max(
      -0.3,
      Math.min(0.3, jitter + microBurst + sharpSpike),
    );
    const spikeClamped = Math.max(-0.2, Math.min(0.2, spike));

    // Hitung final value dengan semua komponen
    let finalValue =
      min +
      range * Math.max(0, Math.min(1, rawValue + jitterClamped + spikeClamped));

    // --- 9. CLAMPING (AGGRESSIVE) ---
    // Clamp ke range min-max dengan margin yang cukup untuk menghindari overflow
    // Gunakan 0.1 sampai 0.9 dari range untuk keeping data dalam batas yang aman
    const minBound = min + range * 0.05; // 5% dari bawah
    const maxBound = min + range * 0.95; // 95% dari atas
    finalValue = Math.max(minBound, Math.min(maxBound, finalValue));

    points.push({
      timestamp: ts,
      value: Math.floor(finalValue),
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
/**
 * Generate data khusus untuk site Bali (MRTG Style)
 * Karakteristik:
 * - 6 interfaces dengan traffic pattern berbeda
 * - Bidirectional (IN atas, OUT bawah)
 * - Volatility tinggi dengan sering ada spike/burst
 * - Outage lebih jarang
 */
export function generateBaliInterfaceData(
  profile: {
    inMinRatio: number;
    inMaxRatio: number;
    outMinRatio?: number;
    outMaxRatio?: number;
  },
  startTs: number,
  endTs: number,
  seed: number,
  interval: number,
  axisMax: number,
): {
  dataIn: { timestamp: number; value: number }[];
  dataOut: { timestamp: number; value: number }[];
} {
  // Bali: lebih volatile, sering burst
  const volatilityFactor = 1.2; // Tingkatkan volatility 20% dibanding default
  const burstinessFactor = 1.5; // Burst lebih sering

  const dataIn = generateSmoothData(
    startTs,
    endTs,
    profile.inMinRatio * axisMax,
    profile.inMaxRatio * axisMax,
    seed,
    interval,
    false, // Bukan CCTV
  );

  const dataOut =
    profile.outMinRatio !== undefined && profile.outMaxRatio !== undefined
      ? generateSmoothData(
          startTs,
          endTs,
          profile.outMinRatio * axisMax,
          profile.outMaxRatio * axisMax,
          seed + 997,
          interval,
          false, // Bukan CCTV
        )
      : [];

  return { dataIn, dataOut };
}

/**
 * Generate data yang sangat smooth dan kalem untuk Banten IN (Download traffic)
 * Karakteristik:
 * - Volatility sangat rendah (0.15-0.3)
 * - Spike sangat minimal
 * - Jitter kecil
 * - Pattern stabil dengan diurnal effect
 */
function generateCalmFluctuatingData(
  startTs: number,
  endTs: number,
  min: number,
  max: number,
  seed: number,
  interval: number = 5 * 60 * 1000,
): { timestamp: number; value: number }[] {
  const points: { timestamp: number; value: number }[] = [];
  const range = max - min;
  const rand = seededRandom(seed);

  // Karakteristik SANGAT smooth dan kalem
  const volatility = 0.15 + rand() * 0.15; // 0.15-0.3 (sangat rendah)
  const jitterAmp = 0.05 + rand() * 0.1; // 0.05-0.15 (minimal)
  const spikeChance = 0.02 + rand() * 0.03; // 2-5% (very rare)
  const spikeMag = 0.3 + rand() * 0.3; // 0.3-0.6x (very small)
  const baselineRatio = 0.3 + rand() * 0.4; // 30-70% baseline
  const peakHour = 8 + Math.floor(rand() * 12); // 08:00-20:00
  const diurnalStrength = 0.3 + rand() * 0.4; // 30-70% (strong pattern untuk tenang)
  const weekendDrop = 0.1 + rand() * 0.3;

  let currentWalk = baselineRatio;
  let trendDirection = rand() > 0.5 ? 1 : -1;

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const date = new Date(ts);
    const hour = date.getHours() + date.getMinutes() / 60;
    const dayOfWeek = date.getDay();

    // Trend change very rare (5% instead of 25%)
    if (rand() < 0.05) {
      trendDirection *= -1;
    }

    // Very gentle walk change
    const walkChange = (rand() - 0.5) * volatility * 0.5;
    currentWalk += walkChange * trendDirection;
    currentWalk = Math.max(0.05, Math.min(0.95, currentWalk));

    // Diurnal cycle (strong untuk pattern yang konsisten dan tenang)
    const hourAngle = ((hour - peakHour) / 12) * Math.PI;
    const diurnalNoise = (rand() - 0.5) * 0.1; // Minimal noise
    const diurnalFactor = Math.max(
      0.2,
      1 -
        diurnalStrength +
        diurnalStrength * Math.cos(hourAngle) +
        diurnalNoise,
    );

    // Weekend
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendMod = isWeekend ? weekendDrop : 1.0;

    // Very gentle jitter
    const jitter = (rand() - 0.5) * jitterAmp * 0.5;

    // Very rare spike
    let spike = 0;
    if (rand() < spikeChance) {
      spike = rand() * spikeMag * 0.2;
    }

    // Calm final value
    let rawValue = currentWalk * diurnalFactor * weekendMod;
    let finalValue =
      min + range * Math.max(0, Math.min(1, rawValue + jitter + spike));

    // Aggressive clamping untuk mencegah outlier
    const minBound = min + range * 0.05;
    const maxBound = min + range * 0.95;
    finalValue = Math.max(minBound, Math.min(maxBound, finalValue));

    points.push({
      timestamp: ts,
      value: Math.floor(finalValue),
    });
  }

  return points;
}

/**
 * Karakteristik:
 * - 1 interface dengan 2 garis (IN fluktuatif + OUT semi-stabil)
 * - Setiap site memiliki karakteristik OUT yang berbeda berdasarkan seed
 * - IN smooth, OUT dengan natural variation di range sempit
 */
export function generateBantenInterfaceData(
  profile: {
    inMinRatio: number;
    inMaxRatio: number;
    outMinRatio?: number;
    outMaxRatio?: number;
  },
  startTs: number,
  endTs: number,
  seed: number,
  interval: number,
  axisMax: number,
): {
  dataIn: { timestamp: number; value: number }[];
  dataOut: { timestamp: number; value: number }[];
} {
  // Generate data IN (Area fluktuatif tapi SANGAT smooth dan kalem - Download traffic)
  // Gunakan function khusus generateCalmFluctuatingData untuk volatility minimal
  const dataIn = generateCalmFluctuatingData(
    startTs,
    endTs,
    profile.inMinRatio * axisMax,
    profile.inMaxRatio * axisMax,
    seed,
    interval,
  );

  // Generate data OUT (CCTV Upload dengan range yang bervariasi per site)
  // Setiap site punya karakteristik OUT berbeda, tidak selalu sama
  let dataOut: { timestamp: number; value: number }[] = [];
  if (profile.outMinRatio !== undefined && profile.outMaxRatio !== undefined) {
    // Hitung range OUT yang unik per seed/site
    const rand = seededRandom(seed * 1234);
    const outVariation = rand() * 0.35; // 0 - 0.35 variasi

    // Range OUT yang bervariasi dari 0.25 sampai 0.6 tergantung seed
    const dynamicOutMin = Math.min(0.25 + outVariation, 0.55);
    const dynamicOutMax = dynamicOutMin + 0.08; // Range tetap sempit (0.08) untuk tetap stabil
    const dynamicOutMaxClamped = Math.min(dynamicOutMax, 0.95); // Jangan melebihi chart

    dataOut = generateSmoothData(
      startTs,
      endTs,
      dynamicOutMin * axisMax,
      dynamicOutMaxClamped * axisMax,
      seed + 999,
      interval,
      false, // isCCTV = false untuk memberikan natural variation pada CCTV upload
    );
  }

  return { dataIn, dataOut };
}

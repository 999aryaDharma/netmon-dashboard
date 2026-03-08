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
  siteName?: string,
): {
  dataIn: { timestamp: number; value: number }[];
  dataOut: { timestamp: number; value: number }[];
} {
  // Gunakan Diurnal Data 6 Layers dengan PERSONALITY untuk IN
  // Setiap site akan punya bentuk unik berdasarkan seed
  const dataIn = generateDiurnalData6Layers(
    startTs,
    endTs,
    profile.inMinRatio * axisMax,
    profile.inMaxRatio * axisMax,
    seed * 7919, // Multiplier besar agar seed tiap site jauh berbeda
    interval,
  );

  // Gunakan Diurnal Data 6 Layers dengan PERSONALITY untuk OUT
  let dataOut: { timestamp: number; value: number }[] = [];
  if (profile.outMinRatio !== undefined && profile.outMaxRatio !== undefined) {
    dataOut = generateDiurnalData6Layers(
      startTs,
      endTs,
      profile.outMinRatio * axisMax,
      profile.outMaxRatio * axisMax,
      (seed * 7919) + 997, // Seed berbeda untuk OUT
      interval,
    );
  }

  return { dataIn, dataOut };
}

/**
 * Generate data yang smooth tapi benar-benar acak untuk CCTV/Banten
 * Karakteristik:
 * - Smooth (volatility rendah) - cocok untuk traffic CCTV
 * - TIDAK ADA pola diurnal/harian yang predictable
 * - TIDAK ADA pattern weekend yang konsisten
 * - Random walk murni dengan jitter
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

  // Karakteristik sangat smooth dan kalem - minimal fluktuasi
  const volatility = 0.05 + rand() * 0.08; // 0.05-0.13 (sangat rendah untuk sangat smooth)
  const jitterAmp = 0.03 + rand() * 0.05; // 0.03-0.08 (jitter sangat halus)
  const spikeChance = 0.02 + rand() * 0.03; // 2-5% (spike sangat jarang)
  const spikeMag = 0.1 + rand() * 0.15; // 0.1-0.25x (spike sangat kecil)
  // Baseline ratio tinggi dengan variasi acak
  const baselineRatio = 0.8 + rand() * 0.15; // 80-95% baseline

  let currentWalk = baselineRatio;

  for (let ts = startTs; ts <= endTs; ts += interval) {
    // --- 1. RANDOM WALK MURNI (perubahan sangat halus) ---
    // Setiap titik berubah sangat sedikit, smooth tanpa bukit lembah yang liar
    const walkChange = (rand() - 0.5) * volatility * 0.4;
    currentWalk += walkChange;
    currentWalk = Math.max(0.5, Math.min(0.98, currentWalk));

    // --- 2. JITTER SANGAT HALUS (hampir tidak terasa) ---
    const jitter = (rand() - 0.5) * jitterAmp * 0.4;

    // --- 3. SPIKE SANGAT JARANG dan KECIL ---
    let spike = 0;
    if (rand() < spikeChance) {
      spike = (rand() - 0.5) * spikeMag * 0.3; // Sangat kecil
    }

    // --- 4. HITUNG FINAL VALUE (tanpa diurnal, tanpa weekend pattern) ---
    let finalValue =
      min + range * Math.max(0, Math.min(1, currentWalk + jitter + spike));

    // Clamping agar tetap dalam range aman
    const minBound = min + range * 0.02;
    const maxBound = min + range * 0.98;
    finalValue = Math.max(minBound, Math.min(maxBound, finalValue));

    points.push({
      timestamp: ts,
      value: Math.floor(finalValue),
    });
  }

  return points;
}

/**
 * Generate data bergaya Zabbix (Plateau / Blocky)
 * Karakteristik:
 * - Naik, stabil di atas (bukit), turun, stabil di bawah (lembah).
 * - Tidak ada paku/spike tajam yang langsung turun.
 */
function generateZabbixStyleData(
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

  let isHighTraffic = false;
  let ticksRemaining = 0;
  let currentTarget = min;

  for (let ts = startTs; ts <= endTs; ts += interval) {
    // Jika durasi stabil sudah habis, tentukan state berikutnya (naik atau turun)
    if (ticksRemaining <= 0) {
      // 30% kemungkinan naik (Bukit), 70% kemungkinan turun (Lembah)
      isHighTraffic = rand() < 0.3;

      if (isHighTraffic) {
        // BUKIT (High Traffic)
        // Stabil di atas selama 4 sampai 12 interval (jam)
        ticksRemaining = Math.floor(4 + rand() * 9);
        // Tinggi bukit: 40% sampai 80% dari range maksimum (dikurangi dari 85% agar ada margin)
        currentTarget = min + range * (0.4 + rand() * 0.4);
      } else {
        // LEMBAH (Low Traffic)
        // Stabil di bawah selama 6 sampai 24 interval (jam)
        ticksRemaining = Math.floor(6 + rand() * 19);
        // Dasar lembah: 5% sampai 15% dari range maksimum
        currentTarget = min + range * (0.05 + rand() * 0.1);
      }
    }

    ticksRemaining--;

    // Noise/Jitter yang SANGAT HALUS (hanya 3% fluktuasi)
    // Agar garis atasnya tidak lurus kaku seperti penggaris, tapi tetap rata
    const jitter = (rand() - 0.5) * range * 0.03;

    let finalValue = currentTarget + jitter;

    // Clamping ketat agar tidak melebihi max bound (95% dari max)
    const maxBound = min + range * 0.95;
    const minBound = min + range * 0.02;
    finalValue = Math.max(minBound, Math.min(maxBound, finalValue));

    points.push({
      timestamp: ts,
      value: Math.floor(finalValue),
    });
  }

  return points;
}

/**
 * Data Generator khusus untuk Bali (Classic MRTG Style)
 * Mengembalikan karakteristik asli: padat, aktif, baseline tinggi, 
 * dengan jitter rapat dan drop tajam sesekali.
 */
function generateClassicMRTGData(
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

  // Karakteristik yang bikin grafiknya "padat" dan liar
  const volatility = 0.4 + rand() * 0.4; // 0.4-0.8 (lebih liar)
  const jitterAmp = 0.35 + rand() * 0.25; // 0.35-0.60 (jitter tinggi agar rapat)
  const dropChance = 0.05; // 5% kemungkinan drop drastis (lembah tajam)

  // Mulai dari baseline yang cukup tinggi (50% - 95% dari kapasitas)
  let currentWalk = 0.5 + rand() * 0.45;

  for (let ts = startTs; ts <= endTs; ts += interval) {
    // Random walk dasar - lebih liar
    currentWalk += (rand() - 0.5) * volatility * 0.6;
    // Jaga agar base tetap cenderung di atas (plateau padat)
    currentWalk = Math.max(0.4, Math.min(0.95, currentWalk));

    let rawValue = currentWalk;

    // Simulasi "Lembah/Drop" mendadak khas jaringan (turun ke 5-25%)
    if (rand() < dropChance) {
      rawValue *= (0.05 + rand() * 0.2); 
    }

    // Tambahkan jitter/noise kasar agar grafiknya terlihat padat layaknya rumput
    const jitter = (rand() - 0.5) * jitterAmp;

    // Hitung final value
    let finalValue = min + range * Math.max(0, Math.min(1, rawValue + jitter));

    // Clamping longgar - biarkan lebih liar tapi tetap dalam batas
    const hardMax = min + range * 0.95;
    const hardMin = min + range * 0.01;
    finalValue = Math.max(hardMin, Math.min(hardMax, finalValue));

    points.push({
      timestamp: ts,
      value: Math.floor(finalValue),
    });
  }
  return points;
}

/**
 * Data Generator STACKED (6 Layer) dengan PERSONALITY
 * Setiap site akan memiliki bentuk, ketebalan, dan jam sibuk yang berbeda-beda
 * berdasarkan "seed" (identitas unik)-nya.
 */
function generateDiurnalData6Layers(
  startTs: number,
  endTs: number,
  min: number,
  max: number,
  seed: number,
  interval: number,
): { timestamp: number; value: number }[] {
  const points: { timestamp: number; value: number }[] = [];
  const range = max - min;
  const rand = seededRandom(seed);
  
  // Shared random untuk bikin semua 6 layer mengalami "RTO/Drop" di detik yang persis sama
  const sharedDropRand = seededRandom(12345 + Math.floor(startTs / 86400000) + seed); 

  // --- SITE PERSONALITY TRAITS (Bikin tiap site beda bentuk) ---
  // rand() menghasilkan angka unik yang selalu sama untuk site yang sama
  const baseLoad = 0.20 + rand() * 0.75; // Ketebalan grafik (20% - 95% dari kapasitas)
  const peakShift = (rand() - 0.5) * 10;  // Geser jam sibuk (Bisa maju/mundur hingga 5 jam)
  const diurnalStrength = 0.3 + rand() * 0.7; // Seberapa drastis drop di malam hari (30-100%)
  const volatility = 0.5 + rand() * 1.0; // Kekasaran rumput/noise (50-150%)
  const hasLunchDip = rand() > 0.4; // 60% site punya pola turun saat jam istirahat siang
  const weekendDropFactor = 0.2 + rand() * 0.5; // Weekend drop 20-70%

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const date = new Date(ts);
    const hour = date.getHours() + date.getMinutes() / 60;
    const dayOfWeek = date.getDay();

    // 1. Pola Waktu yang digeser berdasarkan "Kepribadian" site
    let shiftedHour = hour + peakShift;
    if (shiftedHour < 0) shiftedHour += 24;
    if (shiftedHour >= 24) shiftedHour -= 24;

    let hourFactor = (shiftedHour - 4) / 24; 
    if (hourFactor < 0) hourFactor += 1;
    
    // 2. Bentuk Kurva Dasar - variasi lebih ekstrem
    let diurnal = (Math.sin((hourFactor - 0.25) * 2 * Math.PI) + 1) / 2;
    diurnal = Math.pow(diurnal, 0.8 + rand() * 1.0); // Variasi kelandaian (0.8-1.8)

    // 3. Simulasi Jam Istirahat Siang (Drop jam 12:00 - 13:30)
    if (hasLunchDip && hour >= 11.5 && hour <= 14) {
      diurnal *= 0.5 + (rand() * 0.3); // Drop 50-80%
    }

    // 4. Terapkan kekuatan Siang/Malam (Ada site yang stabil terus 24 jam)
    diurnal = (1 - diurnalStrength) + (diurnal * diurnalStrength);

    // 5. Akhir pekan sepi (Penurunannya beda-beda tiap site)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      diurnal *= weekendDropFactor;
    }

    // Hitung level dasar
    let baseLevel = diurnal * baseLoad;
    baseLevel = Math.max(0.02, baseLevel); 

    // 6. Jitter / Rumput yang kekasarannya beda-beda
    const jitter = (rand() - 0.5) * 0.4 * baseLevel * volatility;
    let rawValue = baseLevel + jitter;
    
    // 7. LOGIKA LAYER TIPIS / PAKU (ether4, ether5, LAN)
    if (min === 0) {
      if (rand() < 0.15 * volatility) {
        rawValue = rand() * 0.9 * baseLoad; // Muncul paku sesekali
      } else {
        rawValue = rand() * 0.02 * baseLoad; // Sisanya rata/nyaris 0
      }
    }

    // 8. Global Drop (Simulasi link kedip / RTO sejenak)
    if (sharedDropRand() < 0.02) {
      rawValue *= 0.02 + (rand() * 0.15); 
    }

    // Eksekusi nilai final
    let finalValue = min + range * Math.max(0, Math.min(1, rawValue));
    points.push({ timestamp: ts, value: Math.floor(finalValue) });
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
  const dataIn = generateCalmFluctuatingData(
    startTs,
    endTs,
    profile.inMinRatio * axisMax,
    profile.inMaxRatio * axisMax,
    seed,
    interval,
  );

  // Generate data OUT menggunakan fungsi Zabbix Blocky yang baru
  let dataOut: { timestamp: number; value: number }[] = [];
  if (profile.outMinRatio !== undefined && profile.outMaxRatio !== undefined) {
    const outMinValue = profile.outMinRatio * axisMax;
    const outMaxValue = profile.outMaxRatio * axisMax;

    dataOut = generateZabbixStyleData(
      startTs,
      endTs,
      outMinValue,
      outMaxValue,
      seed + 999,
      interval,
    );
  }

  return { dataIn, dataOut };
}

import type { Site, SiteInterface } from "../types";
import { generateSmoothData, generatePingData } from "../utils/dataGen";
import { INTERFACE_COLORS, LATENCY_COLORS } from "../constants/defaults";

// Helper function untuk merge data tanpa duplikasi timestamp
export function mergeData(
  existing: { timestamp: number; value: number }[],
  newData: { timestamp: number; value: number }[],
): { timestamp: number; value: number }[] {
  if (!existing || existing.length === 0) return newData;
  if (!newData || newData.length === 0) return existing;

  // Create map of existing timestamps for quick lookup
  const existingMap = new Map(existing.map((d) => [d.timestamp, d]));

  // Add new data points that don't exist yet
  const merged = [...existing];
  newData.forEach((point) => {
    if (!existingMap.has(point.timestamp)) {
      merged.push(point);
    }
  });

  // Sort by timestamp
  return merged.sort((a, b) => a.timestamp - b.timestamp);
}

export function createDefaultSites(
  name: string,
  index: number,
  existingSites?: Site[],
  customStartTs?: number,
  customEndTs?: number,
): { loadSite: Site; latencySite: Site } {
  const now = customEndTs ?? Date.now();
  // UBAH DI SINI: Tarik data mundur 1 Tahun Full (365 Hari)
  const startTs = customStartTs ?? now - 365 * 24 * 3_600_000;

  // UBAH DI SINI: Interval 1 Jam agar performa browser tetap aman
  const interval = 60 * 60 * 1000;

  const pingData = generatePingData(
    startTs,
    now,
    { baseRtt: 15, variance: 3, seed: index * 100 },
    interval,
  );

  // DETEKSI KAPASITAS BERDASARKAN NAMA SITE (SESUAI DOKUMEN LAPORAN)
  const isBackbone = name.toLowerCase().includes("backbone");
  const isIntegration =
    name.toLowerCase().includes("integration") ||
    name.toLowerCase().includes("atcs") ||
    name.toLowerCase().includes("pelabuhan") ||
    name.toLowerCase().includes("terminal") ||
    name.toLowerCase().includes("toll");
  const isCCTV = name.toLowerCase().includes("cctv");

  let axisMaxLoad: number;
  let inMax: number, inMin: number, outMax: number, outMin: number;

  if (isBackbone) {
    axisMaxLoad = 1_000_000_000; // 1000 Mbps
    inMax = 850_000_000; // Peak 850 Mbps
    inMin = 250_000_000; // Low 250 Mbps
    outMax = 150_000_000;
    outMin = 40_000_000;
  } else if (isIntegration) {
    axisMaxLoad = 35_000_000; // 35 Mbps
    inMax = 32_000_000; // Hampir penuh di jam sibuk
    inMin = 8_000_000;
    outMax = 8_000_000;
    outMin = 1_000_000;
  } else if (isCCTV) {
    axisMaxLoad = 5_000_000; // 5 Mbps
    // CCTV sifatnya CBR (Constant Bit Rate) - Trafik stabil tinggi terus menerus
    inMax = 4_800_000; // Stabil di 4.8 Mbps (Kamera HD)
    inMin = 3_800_000; // Paling turun hanya ke 3.8 Mbps
    outMax = 500_000; // Out kecil hanya untuk request RTSP
    outMin = 100_000;
  } else {
    axisMaxLoad = 100_000_000; // Default 100 Mbps
    inMax = 80_000_000;
    inMin = 20_000_000;
    outMax = 20_000_000;
    outMin = 5_000_000;
  }

  // Check existing sites
  const existingLoadId = `load-${index}-${name.toLowerCase().replace(/\s+/g, "-")}`;
  const existingLatencyId = `latency-${index}-${name.toLowerCase().replace(/\s+/g, "-")}`;

  const existingLoad = existingSites?.find((s) => s.id === existingLoadId);
  const existingLatency = existingSites?.find(
    (s) => s.id === existingLatencyId,
  );

  const loadSite: Site = {
    id: existingLoadId,
    name: `${name} (Load)`,
    type: "traffic",
    unit: "bps",
    axisMax: axisMaxLoad,
    // HANYA GENERATE ETHER 1 (index 0), ETHER 3 (index 2), ETHER 5 (index 4), dan LAN (index 5)
    interfaces: [0, 2, 4, 5].map((i, arrayIndex) => {
      let ifaceName = `ether${i + 1}`;
      if (i === 5) ifaceName = "LAN";

      let currentInMax = 0, currentInMin = 0;
      let currentOutMax = 0, currentOutMin = 0;

      // KLONING KARAKTERISTIK MRTG ORIGINAL (Hanya untuk 4 interface aktif):
      if (i === 0) { 
        // ether1: Dominan IN, OUT sangat kecil
        currentInMax = inMax;          currentInMin = inMin;
        currentOutMax = outMax * 0.05; currentOutMin = outMin * 0.05;
      } else if (i === 2) { 
        // ether3: Trafik Kecil
        currentInMax = inMax * 0.01;   currentInMin = inMin * 0.001;
        currentOutMax = outMax * 0.01; currentOutMin = outMin * 0.001;
      } else if (i === 4) { 
        // ether5: DEAD PORT (-nan bps)
        currentInMax = 0; currentInMin = 0;
        currentOutMax = 0; currentOutMin = 0;
      } else if (i === 5) { 
        // LAN: OUT Sangat besar, IN sedang
        currentInMax = inMax * 0.1;    currentInMin = inMin * 0.05;
        currentOutMax = outMax * 0.8;  currentOutMin = outMin * 0.4;
      }

      return {
        // Gunakan arrayIndex agar ID tidak bentrok saat memperbarui data lama
        id: existingLoad?.interfaces[arrayIndex]?.id || `iface-${index}-${i}`,
        name: ifaceName,
        // Ambil warna sesuai urutannya dari defaults.ts
        colorIn: INTERFACE_COLORS[i].in,
        colorOut: INTERFACE_COLORS[i].out,
        // Generate data dengan variasi unik per site + efek outage/random
        dataIn: generateSmoothData(
          startTs,
          now,
          currentInMin,
          currentInMax,
          index * 100 + i,
          interval,
          isCCTV,
        ),
        dataOut: generateSmoothData(
          startTs,
          now,
          currentOutMin,
          currentOutMax,
          index * 200 + i,
          interval,
          isCCTV,
        ),
      };
    }),
  };

  const latencySite: Site = {
    id: existingLatencyId,
    name: `${name} (Latency)`,
    type: "ping",
    unit: "ms",
    axisMax: 100,
    interfaces: [
      {
        id: existingLatency?.interfaces[0]?.id || `latency-iface-${index}-1`,
        name: "ping",
        colorIn: LATENCY_COLORS.in,
        colorOut: LATENCY_COLORS.out,
        dataIn: [],
        dataOut: [],
        dataRtt: mergeData(
          existingLatency?.interfaces[0]?.dataRtt || [],
          pingData.rtt,
        ),
        dataLoss: mergeData(
          existingLatency?.interfaces[0]?.dataLoss || [],
          pingData.loss,
        ),
      },
    ],
  };

  return { loadSite, latencySite };
}

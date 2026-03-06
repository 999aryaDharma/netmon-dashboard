import type { Site, SiteInterface, SiteRegion } from "../types";
import { generateSmoothData, generatePingData } from "../utils/dataGen";
import { INTERFACE_COLORS, LATENCY_COLORS } from "../constants/defaults";

// Warna khusus untuk Banten Load graph (2 interface, 1 arah)
const BANTEN_COLORS = [
  { in: "#4baeac", out: "#329795" },
  { in: "#329795", out: "#4baeac" },
];

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
  region: SiteRegion = "bali",
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

  // Helper: Parse kecepatan dari nama site (format: "Nama Site - Available XXX Mbps/Gbps")
  const parseSpeed = (siteName: string): { value: number; unit: string } | null => {
    const match = siteName.match(/Available\s+([\d.]+)\s*(Gbps|Mbps)/i);
    if (match) {
      return { value: parseFloat(match[1]), unit: match[2].toLowerCase() };
    }
    return null;
  };

  // DETEKSI KAPASITAS BERDASARKAN NAMA SITE (SESUAI DOKUMEN LAPORAN)
  const isBackbone = name.toLowerCase().includes("backbone");
  const isIntegration =
    name.toLowerCase().includes("integration") ||
    name.toLowerCase().includes("atcs") ||
    name.toLowerCase().includes("pelabuhan") ||
    name.toLowerCase().includes("terminal") ||
    name.toLowerCase().includes("toll");
  const isCCTV = name.toLowerCase().includes("cctv");
  const isETLE = name.toLowerCase().includes("etle");
  
  // Coba parse kecepatan dari nama site terlebih dahulu
  const parsedSpeed = parseSpeed(name);

  let axisMaxLoad: number;
  let inMax: number, inMin: number, outMax: number, outMin: number;

  if (parsedSpeed) {
    // Gunakan kecepatan dari nama site
    if (parsedSpeed.unit === "gbps") {
      axisMaxLoad = parsedSpeed.value * 1_000_000_000;
    } else {
      axisMaxLoad = parsedSpeed.value * 1_000_000;
    }
    // Set traffic bounds berdasarkan axisMax
    inMax = axisMaxLoad * 0.4;
    inMin = axisMaxLoad * 0.1;
    outMax = axisMaxLoad * 0.2;
    outMin = axisMaxLoad * 0.05;
  } else if (isBackbone) {
    // Internet Backbone: 1.0 G (Label: 0, 200 M, 400 M, 600 M, 800 M, 1000 M)
    axisMaxLoad = 1_000_000_000;
    inMax = 400_000_000; // Turun ke 400M (40% dari max) - agar tidak penuh
    inMin = 100_000_000; // Turun ke 100M
    outMax = 150_000_000;
    outMin = 40_000_000;
  } else if (isETLE) {
    // VPN / Metro ETLE: 250 Mbps
    axisMaxLoad = 250_000_000;
    inMax = 100_000_000;
    inMin = 25_000_000;
    outMax = 50_000_000;
    outMin = 10_000_000;
  } else if (isIntegration) {
    // Integration Network: 40 M (Label: 0, 8 M, 16 M, 24 M, 32 M, 40 M)
    axisMaxLoad = 40_000_000;
    inMax = 16_000_000; // Turun ke 16M (40% dari max)
    inMin = 4_000_000; // Turun ke 4M
    outMax = 9_000_000;
    outMin = 1_000_000;
  } else if (isCCTV) {
    // CCTV: 6 M (Label: 0, 1.2 M, 2.4 M, 3.6 M, 4.8 M, 6 M)
    axisMaxLoad = 6_000_000;
    inMax = 1_800_000; // Turun ke 1.8M (30% dari max) - agar tidak penuh
    inMin = 900_000; // Turun ke 900k
    outMax = 600_000; // Turun ke 600k
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

  // Generate interfaces based on region
  const interfaces: SiteInterface[] = [];
  
  if (region === "banten") {
    // Banten: 2 interface Load graph (1 arah, hanya IN)
    interfaces.push(
      {
        id: existingLoad?.interfaces[0]?.id || `iface-${index}-0`,
        name: "eth0",
        colorIn: BANTEN_COLORS[0].in,
        colorOut: BANTEN_COLORS[0].out,
        dataIn: mergeData(
          existingLoad?.interfaces[0]?.dataIn || [],
          generateSmoothData(startTs, now, axisMaxLoad * 0.1, axisMaxLoad * 0.4, index * 100, interval),
        ),
        dataOut: [],
      },
      {
        id: existingLoad?.interfaces[1]?.id || `iface-${index}-1`,
        name: "eth1",
        colorIn: BANTEN_COLORS[1].in,
        colorOut: BANTEN_COLORS[1].out,
        dataIn: mergeData(
          existingLoad?.interfaces[1]?.dataIn || [],
          generateSmoothData(startTs, now, axisMaxLoad * 0.08, axisMaxLoad * 0.35, index * 100 + 25, interval),
        ),
        dataOut: [],
      },
    );
  } else {
    // Bali/default: 6 interface dengan pola asimetris khas NOC/MRTG
    for (let i = 0; i < 6; i++) {
      let ifaceName = `ether${i + 1}`;
      if (i === 5) ifaceName = "LAN";

      let currentInMax = 0,
        currentInMin = 0;
      let currentOutMax = 0,
        currentOutMin = 0;

      // KLONING POLA TRAFIK DARI SCREENSHOT REFERENSI MRTG:
      if (i === 0) {
        // ether1: Trafik kecil
        currentInMax = 200_000;
        currentInMin = 50_000; // 50-200 kbps
        currentOutMax = outMax * 2.5;
        currentOutMin = outMax * 1;
      } else if (i === 1) {
        // ether2: Trafik kecil
        currentInMax = 150_000;
        currentInMin = 40_000;
        currentOutMax = 250_000;
        currentOutMin = 60_000; // 60-250 kbps
      } else if (i === 2) {
        // ether3 (UTAMA): OUT DAN IN PALING TEBAL!
        currentInMax = 150_000;
        currentInMin = 40_000;
        currentOutMax = outMax * 1.4;
        currentOutMin = outMax * 1;
      } else if (i === 3) {
        // ether4: Trafik sedang - PERLEBAR RANGE agar tidak terlalu sempit
        currentInMax = inMax * 0.8; // Turun dari 1.5x ke 0.8x
        currentInMin = inMax * 0.3; // Naik dari 1.0x ke 0.3x (range lebih lebar: 30-80% dari max)
        currentOutMax = 600_000;
        currentOutMin = 150_000;
      } else if (i === 4) {
        // ether5 (Dead Port): Kabel dicabut. Limit 0 agar grafiknya kosong sempurna.
        currentInMax = 0;
        currentInMin = 0;
        currentOutMax = 0;
        currentOutMin = 0;
      } else if (i === 5) {
        // LAN: Trafik sedang - PERLEBAR RANGE
        currentInMax = inMax * 0.9; // Turun dari 1.0x ke 0.9x
        currentInMin = inMax * 0.2; // Naik dari 0.3x ke 0.2x (range lebih lebar: 20-90% dari max)
        currentOutMax = outMax * 0.3;
        currentOutMin = outMax * 0.1;
      }

      // Gunakan base seed yang unik untuk tiap interface agar karakteristiknya berbeda total
      // Setiap site akan punya personality traits yang unik
      const inSeed = index * 7919 + i * 1337; // Prime numbers untuk distribusi unik
      const outSeed = index * 7919 + i * 1337 + 997; // Offset prime untuk OUT yang berbeda

      interfaces.push({
        id: existingLoad?.interfaces[i]?.id || `iface-${index}-${i}`,
        name: ifaceName,
        colorIn: INTERFACE_COLORS[i].in,
        colorOut: INTERFACE_COLORS[i].out,
        // Traffic In - seed unik
        dataIn: generateSmoothData(
          startTs,
          now,
          currentInMin,
          currentInMax,
          inSeed,
          interval,
          isCCTV,
        ),
        // Traffic Out - seed berbeda total agar tidak correlated
        dataOut: generateSmoothData(
          startTs,
          now,
          currentOutMin,
          currentOutMax,
          outSeed,
          interval,
          isCCTV,
        ),
      });
    }
  }

  const loadSite: Site = {
    id: existingLoadId,
    name: `${name}`,
    type: "traffic",
    unit: "bps",
    axisMax: axisMaxLoad,
    region,
    graphType: region === "banten" ? "load" : "traffic",
    interfaces,
  };

  const latencySite: Site = {
    id: existingLatencyId,
    name: `${name}`,
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

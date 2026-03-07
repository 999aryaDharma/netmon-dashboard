import type { Site, SiteInterface, SiteRegion } from "../types";
import { generateSmoothData, generatePingData } from "../utils/dataGen";
import { INTERFACE_COLORS, LATENCY_COLORS } from "../constants/defaults";
import { getRenderer } from "../renderers/RendererFactory";

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

  // Gunakan renderer untuk generate interfaces berdasarkan region
  const renderer = getRenderer(region);
  const colorPalette = renderer.getColorPalette();
  const interfaceProfiles = renderer.getInterfaceProfiles(axisMaxLoad);

  const interfaces: SiteInterface[] = interfaceProfiles.map((profile, i) => {
    const inSeed = index * 7919 + i * 1337;
    const outSeed = index * 7919 + i * 1337 + 997;

    return {
      id: existingLoad?.interfaces[i]?.id || `iface-${index}-${i}`,
      name: profile.name,
      colorIn: colorPalette.interfaces[i]?.in || "#BCE249",
      colorOut: colorPalette.interfaces[i]?.out || "#CA89CB",
      dataIn: mergeData(
        existingLoad?.interfaces[i]?.dataIn || [],
        generateSmoothData(
          startTs,
          now,
          profile.inMinRatio * axisMaxLoad,
          profile.inMaxRatio * axisMaxLoad,
          inSeed,
          interval,
          isCCTV,
        ),
      ),
      dataOut: profile.outMinRatio !== undefined && profile.outMaxRatio !== undefined
        ? mergeData(
            existingLoad?.interfaces[i]?.dataOut || [],
            generateSmoothData(
              startTs,
              now,
              profile.outMinRatio * axisMaxLoad,
              profile.outMaxRatio * axisMaxLoad,
              outSeed,
              interval,
              isCCTV,
            ),
          )
        : [],
    };
  });

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

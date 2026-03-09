import type { Site, SiteInterface } from "../types";
import { generatePingData } from "../utils/dataGen";
import { LATENCY_COLORS } from "../constants/defaults";
import { getRenderer } from "../renderers/RendererFactory";
import { mergeData } from "./siteHelpers";

export function createBantenSites(
  name: string,
  index: number,
  existingSites?: Site[],
  customStartTs?: number,
  customEndTs?: number,
): { loadSite: Site; latencySite: Site } {
  const region = "banten";
  const now = customEndTs ?? Date.now();
  // UBAH DI SINI: Tarik data mundur 1 Tahun Full (365 Hari)
  const startTs = customStartTs ?? now - 365 * 24 * 3_600_000;

  // UBAH DI SINI: Interval 1 Jam agar performa browser tetap aman
  const interval = 60 * 60 * 1000;

  // COMMENTED OUT - Ping data sementara tidak digunakan
  // const pingData = generatePingData(
  //   startTs,
  //   now,
  //   { baseRtt: 15, variance: 3, seed: index * 100 },
  //   interval,
  // );

  // Helper: Parse kecepatan dari nama site (format: "Nama Site - Available XXX Mbps/Gbps")
  const parseSpeed = (
    siteName: string,
  ): { value: number; unit: string } | null => {
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
    // Set traffic bounds untuk 80-90% utilization
    inMax = axisMaxLoad * 0.85;
    inMin = axisMaxLoad * 0.65;
    outMax = axisMaxLoad * 0.85;
    outMin = axisMaxLoad * 0.5;
  } else if (isBackbone) {
    // Internet Backbone: 1.0 G - target 85-90% utilization
    axisMaxLoad = 1_000_000_000;
    inMax = 850_000_000; // 85%
    inMin = 700_000_000; // 70%
    outMax = 850_000_000; // 85%
    outMin = 600_000_000; // 60%
  } else if (isETLE) {
    // VPN / Metro ETLE: 250 Mbps - target 80-90% utilization
    axisMaxLoad = 250_000_000;
    inMax = 200_000_000; // 80%
    inMin = 150_000_000; // 60%
    outMax = 200_000_000; // 80%
    outMin = 100_000_000; // 40%
  } else if (isIntegration) {
    // Integration Network: 40 M - target 80-90% utilization
    axisMaxLoad = 40_000_000;
    inMax = 32_000_000; // 80%
    inMin = 24_000_000; // 60%
    outMax = 32_000_000; // 80%
    outMin = 16_000_000; // 40%
  } else if (isCCTV) {
    // CCTV: 6 M - target 80-90% utilization
    axisMaxLoad = 6_000_000;
    inMax = 4_800_000; // 80%
    inMin = 3_600_000; // 60%
    outMax = 4_800_000; // 80%
    outMin = 2_400_000; // 40%
  } else {
    // Default 100 Mbps - target 85-90% utilization (Command Center high traffic)
    axisMaxLoad = 100_000_000;
    inMax = 85_000_000; // 85%
    inMin = 70_000_000; // 70%
    outMax = 85_000_000; // 85%
    outMin = 55_000_000; // 55%
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
  const interfaceProfiles = renderer.getInterfaceProfiles(axisMaxLoad, name);

  const interfaces: SiteInterface[] = interfaceProfiles.map((profile, i) => {
    // Seed unik untuk setiap site dan interface - gunakan hash dari name untuk variasi lebih
    const nameHash = name.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0) >>> 0;
    const inSeed = (index * 7919) + (i * 1337) + nameHash;

    // Gunakan renderer.generateInterfaceData() untuk generate data yang sesuai region
    const generatedData = renderer.generateInterfaceData(
      profile,
      startTs,
      now,
      inSeed,
      interval,
      axisMaxLoad,
      name,
    );

    return {
      id: existingLoad?.interfaces[i]?.id || `iface-${index}-${i}`,
      name: profile.name,
      colorIn: colorPalette.interfaces[i]?.in || "#BCE249",
      colorOut: colorPalette.interfaces[i]?.out || "#CA89CB",
      dataIn: mergeData(
        existingLoad?.interfaces[i]?.dataIn || [],
        generatedData.dataIn,
      ),
      dataOut: mergeData(
        existingLoad?.interfaces[i]?.dataOut || [],
        generatedData.dataOut,
      ),
    };
  });

  const loadSite: Site = {
    id: existingLoadId,
    name: `${name}`,
    type: "traffic",
    unit: "bps",
    axisMax: axisMaxLoad,
    region,
    graphType: "load",
    interfaces,
  };

  // COMMENTED OUT - Ping chart sementara tidak digunakan
  // const latencySite: Site = {
  //   id: existingLatencyId,
  //   name: `${name}`,
  //   type: "ping",
  //   unit: "ms",
  //   axisMax: 100,
  //   interfaces: [
  //     {
  //       id: existingLatency?.interfaces[0]?.id || `latency-iface-${index}-1`,
  //       name: "ping",
  //       colorIn: LATENCY_COLORS.in,
  //       colorOut: LATENCY_COLORS.out,
  //       dataIn: [],
  //       dataOut: [],
  //       dataRtt: mergeData(
  //         existingLatency?.interfaces[0]?.dataRtt || [],
  //         pingData.rtt,
  //       ),
  //       dataLoss: mergeData(
  //         existingLatency?.interfaces[0]?.dataLoss || [],
  //         pingData.loss,
  //       ),
  //     },
  //   ],
  // };

  // Return loadSite saja, latencySite kosong untuk sementara
  const latencySite: Site = {
    id: existingLatencyId,
    name: `${name}`,
    type: "ping",
    unit: "ms",
    axisMax: 100,
    region,
    interfaces: [],
  };

  return { loadSite, latencySite };
}

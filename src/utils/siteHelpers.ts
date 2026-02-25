import type { Site, SiteInterface } from "../types";
import { generateSmoothData, generatePingData, generateRealisticTrafficData } from "../utils/dataGen";
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
  const startTs = customStartTs ?? (now - 365 * 24 * 3_600_000);

  // UBAH DI SINI: Interval 1 Jam agar performa browser tetap aman
  const interval = 60 * 60 * 1000;

  const pingData = generatePingData(
    startTs,
    now,
    { baseRtt: 15, variance: 3, seed: index * 100 },
    interval,
  );

  // Tentukan axisMax berdasarkan tipe site
  const isBackbone =
    name.toLowerCase().includes("backbone") ||
    name.toLowerCase().includes("polda");
  const isIntegration =
    name.toLowerCase().includes("integration") ||
    name.toLowerCase().includes("atcs") ||
    name.toLowerCase().includes("pelabuhan") ||
    name.toLowerCase().includes("terminal") ||
    name.toLowerCase().includes("toll");
  const isCCTV = name.toLowerCase().includes("cctv");

  let axisMaxLoad: number;
  if (isBackbone) {
    axisMaxLoad = 1_000_000_000; // 1000 Mbps
  } else if (isIntegration) {
    axisMaxLoad = 35_000_000; // 35 Mbps
  } else if (isCCTV) {
    axisMaxLoad = 5_000_000; // 5 Mbps
  } else {
    axisMaxLoad = 100_000_000; // Default 100 Mbps
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
    // ... properti loadSite lainnya (id, name, type, dll)
    interfaces: [0, 1, 2, 3, 4, 5].map((i) => {
      // Tentukan nama: ether1 s/d ether5, index 5 jadi LAN
      let ifaceName = `ether${i + 1}`;
      if (i === 5) ifaceName = "LAN";

      // Variasi pembagian bandwidth agar tidak kembar (eth1 paling besar)
      const inMax = 50_000_000 / (i + 1);
      const inMin = inMax * 0.4;
      const outMax = inMax * 0.5;
      const outMin = outMax * 0.2;

      return {
        id: existingLoad?.interfaces[i]?.id || `iface-${index}-${i}`,
        name: ifaceName,
        // Ambil warna sesuai urutannya dari defaults.ts
        colorIn: INTERFACE_COLORS[i].in,
        colorOut: INTERFACE_COLORS[i].out,
        // Menggunakan Algoritma Trafik Realistis!
        dataIn: generateRealisticTrafficData(
          startTs,
          now,
          inMin,
          inMax,
          index * 100 + i,
          interval,
        ),
        dataOut: generateRealisticTrafficData(
          startTs,
          now,
          outMin,
          outMax,
          index * 200 + i,
          interval,
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

import type { Site, SiteInterface } from "../types";
import { generateSmoothData, generatePingData } from "../utils/dataGen";
import { INTERFACE_COLORS, LATENCY_COLORS } from "../constants/defaults";

// Helper function untuk merge data tanpa duplikasi timestamp
export function mergeData(
  existing: { timestamp: number; value: number }[],
  newData: { timestamp: number; value: number }[]
): { timestamp: number; value: number }[] {
  if (!existing || existing.length === 0) return newData;
  if (!newData || newData.length === 0) return existing;

  // Create map of existing timestamps for quick lookup
  const existingMap = new Map(existing.map(d => [d.timestamp, d]));
  
  // Add new data points that don't exist yet
  const merged = [...existing];
  newData.forEach(point => {
    if (!existingMap.has(point.timestamp)) {
      merged.push(point);
    }
  });
  
  // Sort by timestamp
  return merged.sort((a, b) => a.timestamp - b.timestamp);
}

export function createDefaultSites(name: string, index: number, existingSites?: Site[]): { loadSite: Site; latencySite: Site } {
  const now = Date.now();
  const dayAgo = now - 24 * 3_600_000;
  const interval = 15 * 60 * 1000;
  const pingData = generatePingData(dayAgo, now, { baseRtt: 15, variance: 3, seed: index * 100 }, interval);

  // Tentukan axisMax berdasarkan tipe site
  const isBackbone = name.toLowerCase().includes("backbone") || name.toLowerCase().includes("polda");
  const isIntegration = name.toLowerCase().includes("integration") || 
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
  
  const existingLoad = existingSites?.find(s => s.id === existingLoadId);
  const existingLatency = existingSites?.find(s => s.id === existingLatencyId);

  const loadSite: Site = {
    id: existingLoadId,
    name: `${name} (Load)`,
    type: "traffic",
    unit: "bps",
    axisMax: axisMaxLoad,
    interfaces: [
      {
        id: existingLoad?.interfaces[0]?.id || `iface-${index}-1`,
        name: "eth0",
        colorIn: INTERFACE_COLORS[index % INTERFACE_COLORS.length].in,
        colorOut: INTERFACE_COLORS[index % INTERFACE_COLORS.length].out,
        dataIn: mergeData(existingLoad?.interfaces[0]?.dataIn || [], generateSmoothData(dayAgo, now, axisMaxLoad * 0.1, axisMaxLoad * 0.4, index * 100, interval)),
        dataOut: mergeData(existingLoad?.interfaces[0]?.dataOut || [], generateSmoothData(dayAgo, now, axisMaxLoad * 0.05, axisMaxLoad * 0.2, index * 100 + 50, interval)),
      },
    ],
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
        dataRtt: mergeData(existingLatency?.interfaces[0]?.dataRtt || [], pingData.rtt),
        dataLoss: mergeData(existingLatency?.interfaces[0]?.dataLoss || [], pingData.loss),
      },
    ],
  };

  return { loadSite, latencySite };
}

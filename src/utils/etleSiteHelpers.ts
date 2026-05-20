import type { Site, SiteInterface } from "../types";
import { generateSmoothData } from "./dataGen";
import { mergeData } from "./siteHelpers";

const ETLE_COLORS = [
  "#EACC00", // 1 Minute - Yellow (layer bawah)
  "#EA8F00", // 5 Minute - Orange (layer tengah)
  "#FF0000", // 15 Minute - Red (layer atas)
];

export function createETLEBaliSite(
  name: string,
  index: number,
  existingSites?: Site[],
  customStartTs?: number,
  customEndTs?: number,
): { loadSite: Site } {
  const now = customEndTs ?? Date.now();
  const startTs = customStartTs ?? now - 365 * 24 * 3_600_000;
  const interval = 60 * 60 * 1000; // 1 jam
  const axisMax = 8.0;

  const existingLoadId = `load-etle-${index}-${name
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
  const existingLoad = existingSites?.find((s) => s.id === existingLoadId);

  const nameHash =
    name.split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0) >>> 0;

  // Nilai dirancang agar total stacked TIDAK melebihi axisMax=8
  // Max total: 2.5 + 2.0 + 1.5 = 6.0 — aman di bawah 8
  const layerConfigs = [
    { name: "1 Minute Average", min: 0.5, max: 2.5 },
    { name: "5 Minute Average", min: 0.3, max: 2.0 },
    { name: "15 Minute Average", min: 0.2, max: 1.5 },
  ];

  const interfaces: SiteInterface[] = layerConfigs.map((cfg, i) => {
    const seed = index * 7919 + i * 1337 + nameHash;

    const dataIn = generateSmoothData(
      startTs,
      now,
      cfg.min,
      cfg.max,
      seed,
      interval,
      false,
    );

    return {
      id: existingLoad?.interfaces[i]?.id || `iface-etle-${index}-${i}`,
      name: cfg.name,
      colorIn: ETLE_COLORS[i],
      colorOut: ETLE_COLORS[i],
      dataIn: mergeData(existingLoad?.interfaces[i]?.dataIn || [], dataIn),
      dataOut: [],
    };
  });

  const loadSite: Site = {
    id: existingLoadId,
    name: `${name} - Load Average`,
    type: "latency",
    unit: "load",
    axisMax,
    interfaces,
    region: "etle", // tidak perlu "as any" karena SiteRegion sudah include "etle"
    graphType: "load",
  };

  return { loadSite };
}

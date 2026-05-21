import type { Site, SiteInterface } from "../types";
import { getRenderer } from "../renderers/RendererFactory";
import { mergeData } from "./siteHelpers";
import { generateETLESmoothData } from "./dataGen";

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
  const axisMax = 16.0; // Total max: 6.5 + 5.0 + 3.5 = 15.0 (Y-axis goes to 16)

  const existingLoadId = `load-etle-${index}-${name
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
  const existingLoad = existingSites?.find((s) => s.id === existingLoadId);

  const nameHash =
    name.split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0) >>> 0;

  // ── Layer configs: min/max diperbesar agar stacked total ~12-14 (sesuai referensi) ──
  // Total max: 6.5 + 5.0 + 3.5 = 15.0  →  sesuai Y-axis yang goes to 16
  // smoothing: 1-min cepat (reactive), 15-min lambat (smooth)
  const layerConfigs = [
    { name: "1 Minute Average", min: 0.5, max: 6.5, smoothing: 0.25 },
    { name: "5 Minute Average", min: 0.3, max: 5.0, smoothing: 0.12 },
    { name: "15 Minute Average", min: 0.2, max: 3.5, smoothing: 0.06 },
  ];

  // ── baseSeed SAMA untuk semua layer → pattern berkorelasi ───────────
  // Ketiga layer akan mengalami HIGH/LOW di periode yang sama,
  // hanya berbeda di smoothness dan amplitude.
  const baseSeed = nameHash + index * 7919;

  const interfaces: SiteInterface[] = layerConfigs.map((cfg, i) => {
    const dataIn = generateETLESmoothData(
      startTs,
      now,
      cfg.min,
      cfg.max,
      baseSeed, // <-- SAMA untuk semua layer agar berkorelasi
      interval,
      cfg.smoothing, // <-- Beda speed: 1-min cepat, 15-min lambat
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
    region: "etle",
    graphType: "load",
  };

  return { loadSite };
}

import { DataPoint } from "../types";
import {
  IChartRenderer,
  AxisConfig,
  ColorPalette,
  InterfaceProfile,
} from "./ChartRenderer";
import { generateETLESmoothData } from "../utils/dataGen";

export class ETLERenderer implements IChartRenderer {
  readonly region = "etle" as const;

  getAxisConfig(): AxisConfig {
    return {
      bidirectional: false,
      showZeroLine: false,
      labelFormat: "RRDTool",
      steps: [5, 10, 15],
    };
  }

  getColorPalette(): ColorPalette {
    return {
      interfaces: [
        { in: "#EACC00", out: "#EACC00" }, // 1 Minute - Kuning
        { in: "#EA8F00", out: "#EA8F00" }, // 5 Minute - Oranye
        { in: "#FF0000", out: "#FF0000" }, // 15 Minute - Merah
      ],
      gridLine: "rgba(100, 100, 100, 0.25)",
      text: "#000000",
      zeroLine: "rgba(255, 0, 0, 0.3)",
      background: "#FFFFFF",
    };
  }

  getInterfaceProfiles(axisMax: number, siteName?: string): InterfaceProfile[] {
    return [
      {
        name: "1 Minute Average",
        inMinRatio: 0,
        inMaxRatio: 1,
        outMinRatio: 0,
        outMaxRatio: 1,
      },
      {
        name: "5 Minute Average",
        inMinRatio: 0,
        inMaxRatio: 1,
        outMinRatio: 0,
        outMaxRatio: 1,
      },
      {
        name: "15 Minute Average",
        inMinRatio: 0,
        inMaxRatio: 1,
        outMinRatio: 0,
        outMaxRatio: 1,
      },
    ];
  }

  generateInterfaceData(
    profile: InterfaceProfile,
    startTs: number,
    endTs: number,
    seed: number,
    interval: number,
    axisMax: number = 15.0,
    siteName?: string,
  ): { dataIn: DataPoint[]; dataOut: DataPoint[] } {
    const isOneMin = profile.name.includes("1 Minute");
    const isFiveMin = profile.name.includes("5 Minute");

    // Semua layer pakai BASE SEED yang sama agar pola terkait
    // Beda hanya di smoothing level
    const smoothing = isOneMin ? 0.25 : isFiveMin ? 0.12 : 0.06;

    const minRatio = isOneMin ? 0.08 : isFiveMin ? 0.06 : 0.04;
    const maxRatio = isOneMin ? 0.8 : isFiveMin ? 0.65 : 0.5;

    const data = generateETLESmoothData(
      startTs,
      endTs,
      axisMax * minRatio,
      axisMax * maxRatio,
      seed, // gunakan seed langsung (tidak + 500/1000) agar korrelasi
      interval,
      smoothing,
    );

    return { dataIn: data, dataOut: data };
  }
}

// ─── Generator utama ────────────────────────────────────────────────────────

function generateRRDLoadAverage(
  startTs: number,
  endTs: number,
  axisMax: number,
  seed: number,
  interval: number,
  smoothingLevel: number,
): { timestamp: number; value: number }[] {
  // Site personality — fully deterministic, sama untuk semua site
  const siteBaseLoad = axisMax * (0.35 + ((seed % 100) * 0.06) / 100); // 35-41% dari axisMax
  const peakHour = 7.5 + ((seed % 60) * 3) / 60; // Consistent peak hour
  const hasBump2 = seed % 2 === 1;

  const rawPoints: number[] = [];
  const timestamps: number[] = [];

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const d = new Date(ts);
    const hour = d.getHours() + d.getMinutes() / 60;
    const dow = d.getDay();
    const dayOfYear = Math.floor(
      (ts - new Date(new Date(ts).getFullYear(), 0, 0).getTime()) / 86400000,
    );

    // ── Diurnal pattern (morning peak) ──
    const morning = Math.max(
      0,
      Math.sin(Math.max(0, (hour - peakHour) / 6.5) * Math.PI),
    );
    const aftBump = hasBump2
      ? Math.max(0, Math.sin(Math.max(0, (hour - 14) / 4.5) * Math.PI)) * 0.35
      : 0;
    const nightMod = hour < 5 || hour > 23 ? 0.25 : hour < 7 ? 0.6 : 1.0;
    const wkndMod = dow === 0 || dow === 6 ? 0.68 : 1.0;

    const diurnalFactor = (morning + aftBump) * nightMod * wkndMod;
    const baseValue = siteBaseLoad * (0.5 + diurnalFactor * 0.8);

    // ── Smooth sine-based micro-variations (deterministic based on time) ──
    const microTime = (ts / 60000) % 1440; // Cycle every 24 hours
    const microWave1 =
      Math.sin((microTime * Math.PI) / 180) * 0.12 * siteBaseLoad;
    const microWave2 =
      Math.sin((microTime * Math.PI) / 90) * 0.08 * siteBaseLoad;

    // ── Seed-based texture variation (deterministic) ──
    let textureVal = 0;
    const texturePhase =
      ((seed * 7919 + dayOfYear * 12347) % 1000000) / 1000000;
    textureVal =
      (Math.sin(texturePhase * Math.PI * 2 + microTime * 0.05) - 0.5) *
      0.15 *
      siteBaseLoad;

    let val = baseValue + microWave1 + microWave2 + textureVal;

    // Clamp untuk consistency
    val = Math.max(axisMax * 0.15, Math.min(axisMax * 0.85, val));

    rawPoints.push(val);
    timestamps.push(ts);
  }

  // Apply EMA smoothing per layer untuk smooth transitions
  const smoothed = applyEMA(rawPoints, smoothingLevel);

  // Scale down setiap layer untuk stacked area
  // Layer 1-min = 100%, Layer 5-min = 78%, Layer 15-min = 65%
  const scale = smoothingLevel === 0 ? 1.0 : smoothingLevel === 1 ? 0.78 : 0.65;

  return timestamps.map((ts, i) => ({
    timestamp: ts,
    value: Math.max(0.05, smoothed[i] * scale),
  }));
}

function applyEMA(data: number[], level: number): number[] {
  if (data.length === 0) return [];
  // 1min=more responsive, 5min=medium, 15min=very smooth
  const alpha = level === 0 ? 0.6 : level === 1 ? 0.35 : 0.15;
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

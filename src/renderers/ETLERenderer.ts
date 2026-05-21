import { DataPoint } from "../types";
import {
  IChartRenderer,
  AxisConfig,
  ColorPalette,
  InterfaceProfile,
} from "./ChartRenderer";

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
    const smoothing = isOneMin ? 0 : isFiveMin ? 1 : 2; // 0=kasar, 2=smooth

    const data = generateRRDLoadAverage(
      startTs,
      endTs,
      axisMax,
      seed,
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
  let s = seed | 0 || 1;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // ── Site personality — KONSISTEN untuk semua site ──
  // Dimulai dari siteIndex yang sudah ditentukan dari seed
  const siteBaseLoad = axisMax * (0.32 + (seed % 100) * 0.08 / 100); // Sangat konsisten: 32-40% dari axisMax
  const peakHour = 7 + (seed % 60) * 4 / 60; // Consistent peak hour
  const hasBump2 = (seed % 2) === 1;
  const spikeFreq = 0.002 + (seed % 100) * 0.003 / 100; // 0.2-0.5% spike frequency
  const spikeHeight = axisMax * (0.15 + (seed % 50) * 0.15 / 50); // Lebih kecil: 15-30% dari axisMax

  const rawPoints: number[] = [];
  const timestamps: number[] = [];

  let baseWalk = siteBaseLoad;
  let walkTarget = siteBaseLoad;
  let walkHold = 0;

  for (let ts = startTs; ts <= endTs; ts += interval) {
    const d = new Date(ts);
    const hour = d.getHours() + d.getMinutes() / 60;
    const dow = d.getDay();

    // Diurnal shape
    const morning = Math.max(
      0,
      Math.sin(Math.max(0, (hour - peakHour) / 7) * Math.PI),
    );
    const aftBump = hasBump2
      ? Math.max(0, Math.sin(Math.max(0, (hour - 14) / 5) * Math.PI)) * 0.4
      : 0;
    const nightMod = hour < 5 || hour > 23 ? 0.22 : hour < 7 ? 0.55 : 1.0;
    const wkndMod = dow === 0 || dow === 6 ? 0.65 : 1.0;
    const diurnal = (morning + aftBump) * nightMod * wkndMod;
    const idealLoad = siteBaseLoad * 0.45 + diurnal * siteBaseLoad * 0.85;

    // Slow walk toward ideal
    if (walkHold <= 0) {
      walkTarget = idealLoad * (0.75 + rand() * 0.5);
      walkTarget = Math.max(
        axisMax * 0.02,
        Math.min(axisMax * 0.88, walkTarget),
      );
      walkHold = Math.floor(3 + rand() * 9);
    }
    walkHold--;
    baseWalk += (walkTarget - baseWalk) * 0.18;

    // Texture: noise lebih kecil untuk smoothness
    const texture = (rand() - 0.5) * siteBaseLoad * 0.3;

    // Spike tajam sesekali tapi kecil
    let spike = 0;
    if (rand() < spikeFreq) {
      spike = spikeHeight * (0.5 + rand() * 0.4);
    }

    let val = baseWalk + texture + spike;
    // Clamp untuk consistency dan tidak melebihi batas
    val = Math.max(axisMax * 0.15, Math.min(axisMax * 0.85, val));

    rawPoints.push(val);
    timestamps.push(ts);
  }

  // Apply EMA smoothing per layer untuk smooth transitions
  const smoothed = applyEMA(rawPoints, smoothingLevel);

  // Scale down setiap layer untuk stacked area - total tidak boleh melebihi axisMax
  // Layer 1-min = 100%, Layer 5-min = 80%, Layer 15-min = 70%
  const scale = smoothingLevel === 0 ? 1.0 : smoothingLevel === 1 ? 0.8 : 0.7;

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
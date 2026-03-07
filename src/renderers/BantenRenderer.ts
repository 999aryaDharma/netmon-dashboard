import { Site, DataPoint } from "../types";
import {
  IChartRenderer,
  AxisConfig,
  ColorPalette,
  InterfaceProfile,
} from "./ChartRenderer";
import { generateBantenInterfaceData } from "../utils/dataGen";

/**
 * Banten Renderer - Zabbix Style
 * - Unidirectional load graph (hanya IN dari bawah)
 * - 2 interfaces
 * - Teal/Cyan color palette (#4baeac, #329795)
 * - No zero line
 */
export class BantenRenderer implements IChartRenderer {
  readonly region = "banten" as const;

  private static readonly INTERFACE_COUNT = 2;
  private static readonly BIDIRECTIONAL = false;
  private static readonly SHOW_ZERO_LINE = false;

  // Zabbix-style colors
  private static readonly COLORS = [
    { in: "#4baeac", out: "#329795" },
    { in: "#329795", out: "#4baeac" },
  ];

  getAxisConfig(): AxisConfig {
    return {
      bidirectional: BantenRenderer.BIDIRECTIONAL,
      showZeroLine: BantenRenderer.SHOW_ZERO_LINE,
      labelFormat: "Zabbix",
      steps: [20, 40, 60, 80, 100],
    };
  }

  getColorPalette(): ColorPalette {
    return {
      interfaces: BantenRenderer.COLORS,
      gridLine: "rgba(255, 255, 255, 0.1)",
      text: "#c8ced6",
      zeroLine: "rgba(255,255,255,0.5)",
      background: "#2b2b2b", // Zabbix style - dark teal
    };
  }

  getInterfaceProfiles(axisMax: number): InterfaceProfile[] {
    // Zabbix-style: Hanya 1 interface dengan 2 garis
    // IN = Area fluktuatif (Download), OUT = Area stabil (CCTV Upload)
    return [
      {
        name: "Interface-1",
        inMinRatio: 0.1, // 10% - Batas bawah trafik fluktuatif
        inMaxRatio: 0.8, // 80% - Batas atas trafik fluktuatif (naik turun)
        outMinRatio: 0.5, // 50% - Trafik stabil bawah (CCTV Upload)
        outMaxRatio: 0.55, // 55% - Trafik stabil atas (CCTV Upload) - Jaraknya sangat sempit agar stabil
      },
    ];
  }

  generateInterfaceData(
    profile: InterfaceProfile,
    startTs: number,
    endTs: number,
    seed: number,
    interval: number,
    axisMax: number = 100_000_000,
  ): { dataIn: DataPoint[]; dataOut: DataPoint[] } {
    return generateBantenInterfaceData(
      profile as {
        inMinRatio: number;
        inMaxRatio: number;
        outMinRatio?: number;
        outMaxRatio?: number;
      },
      startTs,
      endTs,
      seed,
      interval,
      axisMax,
    );
  }
}

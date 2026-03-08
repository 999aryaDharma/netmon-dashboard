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

  // Zabbix-style colors: Biru tua (IN/Receive) vs Biru muda (OUT/Sent)
  private static readonly COLORS = [
    { in: "#329795", out: "#4baeac" }, // IN muda, OUT tua
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

  getInterfaceProfiles(axisMax: number, siteName?: string): InterfaceProfile[] {
    // Zabbix-style: Hanya 1 interface dengan 2 garis
    // IN = Stabil Rendah (Receive/Download) - Biru Muda - 5-15%
    // OUT = Fluktuatif Tinggi (Send/Upload) - Biru Tua - 15-95%

    // Profile default untuk site Banten (semua capacity)
    return [
      {
        name: "Interface-1",
        inMinRatio: 0.05, // IN minimum rendah (5%)
        inMaxRatio: 0.15, // IN maximum rendah (15%) - stabil dan steady
        outMinRatio: 0.15, // OUT minimum naik (15%)
        outMaxRatio: 0.95, // OUT maximum tinggi (95%) - fluktuatif dominan
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
    siteName?: string,
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

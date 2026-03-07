import { Site, DataPoint } from "../types";
import {
  IChartRenderer,
  AxisConfig,
  ColorPalette,
  InterfaceProfile,
} from "./ChartRenderer";
import { generateSmoothData } from "../utils/dataGen";

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
    // Zabbix-style: Load graph dengan 2 interface
    // Hanya IN (unidirectional), tidak ada OUT
    return [
      {
        name: "eth0",
        inMinRatio: 0.1, // 10% dari axisMax
        inMaxRatio: 0.4, // 40% dari axisMax
        // outMinRatio & outMaxRatio undefined = no OUT data
      },
      {
        name: "eth1",
        inMinRatio: 0.08, // 8% dari axisMax
        inMaxRatio: 0.35, // 35% dari axisMax
      },
    ];
  }

  generateInterfaceData(
    profile: InterfaceProfile,
    startTs: number,
    endTs: number,
    seed: number,
    interval: number,
  ): { dataIn: DataPoint[]; dataOut: DataPoint[] } {
    const dataIn = generateSmoothData(
      startTs,
      endTs,
      profile.inMinRatio * 100,
      profile.inMaxRatio * 100,
      seed,
      interval,
      false,
    );

    // Zabbix load graph: tidak ada data OUT
    return { dataIn, dataOut: [] };
  }
}

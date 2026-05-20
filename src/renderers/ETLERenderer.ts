import { DataPoint } from "../types";
import {
  IChartRenderer,
  AxisConfig,
  ColorPalette,
  InterfaceProfile,
} from "./ChartRenderer";
import { generateETLESmoothData, generateSmoothData } from "../utils/dataGen";

/**
 * ETLE Bali Renderer - Load Average Style
 * - Unidirectional load data (no IN/OUT split)
 * - 3 interfaces: 1 Minute, 5 Minute, 15 Minute Load Averages
 * - Stacked area chart (similar to MRTG but unidirectional)
 * - Yellow/Orange/Red color palette for visual intensity
 */
export class ETLERenderer implements IChartRenderer {
  readonly region = "etle" as const;

  private static readonly INTERFACE_COUNT = 3;
  private static readonly BIDIRECTIONAL = false; // Load is unidirectional
  private static readonly SHOW_ZERO_LINE = false; // No zero line for load

  getAxisConfig(): AxisConfig {
    return {
      bidirectional: ETLERenderer.BIDIRECTIONAL,
      showZeroLine: ETLERenderer.SHOW_ZERO_LINE,
      labelFormat: "RRDTool",
      steps: [20, 40, 60, 80, 100],
    };
  }

  getColorPalette(): ColorPalette {
    return {
      interfaces: [
        // 1 Minute Average - Yellow (base layer) #EACC00
        { in: "#EACC00", out: "#EACC00" },
        // 5 Minute Average - Orange (middle layer) #EA8F00
        { in: "#EA8F00", out: "#EA8F00" },
        // 15 Minute Average - Red (top layer) #FF0000
        { in: "#FF0000", out: "#FF0000" },
      ],
      gridLine: "rgba(100, 100, 100, 0.3)", // Grey dashed lines
      text: "#000000", // Black text on white background
      zeroLine: "rgba(255, 0, 0, 0.3)", // Red dashed line
      background: "#FFFFFF", // White background
    };
  }

  getInterfaceProfiles(axisMax: number, siteName?: string): InterfaceProfile[] {
    // For load average stacking:
    // - All three layers contribute to the total visible height
    // - Ratios ensure they stack naturally
    return [
      // 1 Minute Average - Bottom layer (base)
      {
        name: "1 Minute Average",
        inMinRatio: 0.1,
        inMaxRatio: 0.35,
        outMinRatio: 0.1,
        outMaxRatio: 0.35,
      },
      // 5 Minute Average - Middle layer
      {
        name: "5 Minute Average",
        inMinRatio: 0.15,
        inMaxRatio: 0.4,
        outMinRatio: 0.15,
        outMaxRatio: 0.4,
      },
      // 15 Minute Average - Top layer
      {
        name: "15 Minute Average",
        inMinRatio: 0.2,
        inMaxRatio: 0.45,
        outMinRatio: 0.2,
        outMaxRatio: 0.45,
      },
    ];
  }

  /**
   * Generate interface data for ETLE load average
   * Creates realistic load average patterns (lower variation than traffic)
   */
  generateInterfaceData(
    profile: InterfaceProfile,
    startTs: number,
    endTs: number,
    seed: number,
    interval: number,
    axisMax: number = 4.0,
    siteName?: string,
  ): { dataIn: DataPoint[]; dataOut: DataPoint[] } {
    const isOneMin = profile.name.includes("1 Minute");
    const isFiveMin = profile.name.includes("5 Minute");

    // 1-min paling volatile, 15-min paling smooth
    const smoothness = isOneMin ? 1.0 : isFiveMin ? 0.8 : 0.6;
    const uniqueSeed = seed + (isOneMin ? 0 : isFiveMin ? 500 : 1000);

    // Range berbeda per layer - 15-min lebih rendah dari 1-min (karena smoothed)
    const minRatio = isOneMin ? 0.1 : isFiveMin ? 0.12 : 0.14;
    const maxRatio = isOneMin ? 0.75 : isFiveMin ? 0.65 : 0.55;

    const data = generateETLESmoothData(
      startTs,
      endTs,
      axisMax * minRatio,
      axisMax * maxRatio,
      uniqueSeed,
      interval,
    );

    return { dataIn: data, dataOut: data };
  }
}

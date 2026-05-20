import { DataPoint } from "../types";
import {
  IChartRenderer,
  AxisConfig,
  ColorPalette,
  InterfaceProfile,
} from "./ChartRenderer";
import { generateSmoothData } from "../utils/dataGen";

/**
 * ETLE Bali Renderer - Load Average Style
 * - Unidirectional load data (no IN/OUT split)
 * - 3 interfaces: 1 Minute, 5 Minute, 15 Minute Load Averages
 * - Stacked area chart (similar to MRTG but unidirectional)
 * - Yellow/Orange/Red color palette for visual intensity
 */
export class ETLERenderer implements IChartRenderer {
  readonly region = "bali" as const;

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
    axisMax: number = 4.0, // Typical max load average
    siteName?: string,
  ): { dataIn: DataPoint[]; dataOut: DataPoint[] } {
    // For load average, we typically use axisMax around 4.0 for 4-core systems
    // Adjust based on typical load patterns
    const isOneMin = profile.name.includes("1 Minute");
    const isFiveMin = profile.name.includes("5 Minute");

    // Different volatility for each load metric
    // 1-minute is most volatile, 15-minute is smoothest
    let volatility = isOneMin ? 0.8 : isFiveMin ? 0.5 : 0.3;
    let baselineRatio = 0.3 + (seed % 100) / 500; // 30-50% baseline

    // 1-minute is more reactive, so higher min/max
    let min = axisMax * (isOneMin ? 0.2 : isFiveMin ? 0.3 : 0.4);
    let max = axisMax * (isOneMin ? 0.85 : isFiveMin ? 0.75 : 0.65);

    const data = generateSmoothData(
      startTs,
      endTs,
      min,
      max,
      seed,
      interval,
      false, // Not CCTV
    );

    return {
      dataIn: data,
      dataOut: data, // For unidirectional, dataIn and dataOut are the same
    };
  }
}

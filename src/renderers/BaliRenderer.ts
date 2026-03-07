import { Site, DataPoint } from "../types";
import {
  IChartRenderer,
  AxisConfig,
  ColorPalette,
  InterfaceProfile,
  InterfaceColor,
} from "./ChartRenderer";
import { INTERFACE_COLORS } from "../constants/defaults";
import { generateBaliInterfaceData } from "../utils/dataGen";

/**
 * Bali Renderer - MRTG Style
 * - Bidirectional traffic (IN atas, OUT bawah)
 * - 6 interfaces
 * - Green/Purple color palette
 * - Zero line di tengah
 */
export class BaliRenderer implements IChartRenderer {
  readonly region = "bali" as const;

  private static readonly INTERFACE_COUNT = 6;
  private static readonly BIDIRECTIONAL = true;
  private static readonly SHOW_ZERO_LINE = true;

  getAxisConfig(): AxisConfig {
    return {
      bidirectional: BaliRenderer.BIDIRECTIONAL,
      showZeroLine: BaliRenderer.SHOW_ZERO_LINE,
      labelFormat: "RRDTool",
      steps: [20, 40, 60, 80, 100], // Default steps, akan di-override berdasarkan axisMax
    };
  }

  getColorPalette(): ColorPalette {
    return {
      interfaces: INTERFACE_COLORS,
      gridLine: "rgba(255, 255, 255, 0.1)",
      text: "#c8ced6",
      zeroLine: "rgba(255,255,255,0.5)",
      background: "#202020", // MRTG style - dark gray
    };
  }

  getInterfaceProfiles(axisMax: number): InterfaceProfile[] {
    const profiles: InterfaceProfile[] = [];

    // ether1 - DOMINAN: Trafik utama bidirectional
    profiles.push({
      name: "ether1",
      inMinRatio: 0.3,
      inMaxRatio: 0.95, // Naikkan ke 95% dari axisMax untuk range lebih besar
      outMinRatio: 0.15,
      outMaxRatio: 0.5, // Kurangi OUT ke 50% agar lebih seimbang
    });

    // ether4 - TIPIS: Trafik kecil bidirectional
    profiles.push({
      name: "ether4",
      inMinRatio: 0.04,
      inMaxRatio: 0.08,
      outMinRatio: 0.03,
      outMaxRatio: 0.06, // Seimbang dengan IN
    });

    // LAN - TIPIS: Trafik kecil bidirectional
    profiles.push({
      name: "LAN",
      inMinRatio: 0.04,
      inMaxRatio: 0.08,
      outMinRatio: 0.03,
      outMaxRatio: 0.06, // Seimbang dengan IN
    });

    return profiles;
  }

  /**
   * Generate interface data khusus untuk Bali
   * - Lebih volatile dan sering ada spike/burst
   * - Support bidirectional traffic (IN + OUT)
   * - Data di-clamping agar tidak melebihi range yang ditentukan
   */
  generateInterfaceData(
    profile: InterfaceProfile,
    startTs: number,
    endTs: number,
    seed: number,
    interval: number,
    axisMax: number = 100_000_000,
  ): { dataIn: DataPoint[]; dataOut: DataPoint[] } {
    return generateBaliInterfaceData(
      profile,
      startTs,
      endTs,
      seed,
      interval,
      axisMax,
    );
  }
}

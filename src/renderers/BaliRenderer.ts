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

  getInterfaceProfiles(axisMax: number, siteName?: string): InterfaceProfile[] {
    // KARENA STACKED (Ditumpuk), total inMaxRatio dijaga agar max ~1.0 (100% tinggi grafik)
    return [
      // ether1: Pondasi dasar (lumayan tebal, stabil di bawah)
      {
        name: "ether1",
        inMinRatio: 0.02,
        inMaxRatio: 0.08,
        outMinRatio: 0.1,
        outMaxRatio: 0.2,
      },
      // ether2: Garis tengah (tipis)
      {
        name: "ether2",
        inMinRatio: 0.1,
        inMaxRatio: 0.25,
        outMinRatio: 0.02,
        outMaxRatio: 0.08,
      },
      // ether3: DOMINAN (Paling tebal, membentuk bukit utama 55%)
      {
        name: "ether3",
        inMinRatio: 0.3,
        inMaxRatio: 0.55,
        outMinRatio: 0.2,
        outMaxRatio: 0.45,
      },
      // ether4: Tipis, kadang-kadang paku noise
      {
        name: "ether4",
        inMinRatio: 0.0,
        inMaxRatio: 0.05,
        outMinRatio: 0.0,
        outMaxRatio: 0.05,
      },
      // ether5: Hampir 0, sesekali nongol
      {
        name: "ether5",
        inMinRatio: 0.0,
        inMaxRatio: 0.02,
        outMinRatio: 0.0,
        outMaxRatio: 0.02,
      },
      // LAN: Layer paling atas, nyaris 0, tapi ada paku tajam jarang-jarang
      {
        name: "LAN",
        inMinRatio: 0.0,
        inMaxRatio: 0.03,
        outMinRatio: 0.0,
        outMaxRatio: 0.03,
      },
    ];
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
    siteName?: string,
  ): { dataIn: DataPoint[]; dataOut: DataPoint[] } {
    return generateBaliInterfaceData(
      profile,
      startTs,
      endTs,
      seed,
      interval,
      axisMax,
      siteName,
    );
  }
}

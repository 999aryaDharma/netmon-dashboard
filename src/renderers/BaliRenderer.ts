import { Site, DataPoint } from "../types";
import {
  IChartRenderer,
  AxisConfig,
  ColorPalette,
  InterfaceProfile,
  InterfaceColor,
} from "./ChartRenderer";
import { INTERFACE_COLORS } from "../constants/defaults";
import { generateSmoothData } from "../utils/dataGen";

/**
 * Bali Renderer - MRTG Style
 * - Bidirectional traffic (IN atas, OUT bawah)
 * - 6 interfaces
 * - Green/Purple color palette
 * - Zero line di tengah
 */
export class BaliRenderer implements IChartRenderer {
  readonly region = 'bali' as const;

  private static readonly INTERFACE_COUNT = 6;
  private static readonly BIDIRECTIONAL = true;
  private static readonly SHOW_ZERO_LINE = true;

  getAxisConfig(): AxisConfig {
    return {
      bidirectional: BaliRenderer.BIDIRECTIONAL,
      showZeroLine: BaliRenderer.SHOW_ZERO_LINE,
      labelFormat: 'RRDTool',
      steps: [20, 40, 60, 80, 100], // Default steps, akan di-override berdasarkan axisMax
    };
  }

  getColorPalette(): ColorPalette {
    return {
      interfaces: INTERFACE_COLORS,
      gridLine: "rgba(255, 255, 255, 0.1)",
      text: "#c8ced6",
      zeroLine: "rgba(255,255,255,0.5)",
      background: "#202020",  // MRTG style - dark gray
    };
  }

  getInterfaceProfiles(axisMax: number): InterfaceProfile[] {
    const profiles: InterfaceProfile[] = [];
    
    // ether1 - Trafik kecil
    profiles.push({
      name: "ether1",
      inMinRatio: 50_000 / axisMax,
      inMaxRatio: 200_000 / axisMax,
      outMinRatio: 1,
      outMaxRatio: 2.5,
    });
    
    // ether2 - Trafik kecil
    profiles.push({
      name: "ether2",
      inMinRatio: 40_000 / axisMax,
      inMaxRatio: 150_000 / axisMax,
      outMinRatio: 60_000 / axisMax,
      outMaxRatio: 250_000 / axisMax,
    });
    
    // ether3 - UTAMA
    profiles.push({
      name: "ether3",
      inMinRatio: 40_000 / axisMax,
      inMaxRatio: 150_000 / axisMax,
      outMinRatio: 1,
      outMaxRatio: 1.4,
    });
    
    // ether4 - Trafik sedang
    profiles.push({
      name: "ether4",
      inMinRatio: 0.3,
      inMaxRatio: 0.8,
      outMinRatio: 150_000 / axisMax,
      outMaxRatio: 600_000 / axisMax,
    });
    
    // ether5 - Dead Port
    profiles.push({
      name: "ether5",
      inMinRatio: 0,
      inMaxRatio: 0,
      outMinRatio: 0,
      outMaxRatio: 0,
    });
    
    // LAN - Trafik sedang
    profiles.push({
      name: "LAN",
      inMinRatio: 0.2,
      inMaxRatio: 0.9,
      outMinRatio: 0.1,
      outMaxRatio: 0.3,
    });
    
    return profiles;
  }

  generateInterfaceData(
    profile: InterfaceProfile,
    startTs: number,
    endTs: number,
    seed: number,
    interval: number
  ): { dataIn: DataPoint[]; dataOut: DataPoint[] } {
    const axisMax = 100_000_000; // Default, akan di-scale
    
    const dataIn = generateSmoothData(
      startTs,
      endTs,
      profile.inMinRatio * axisMax,
      profile.inMaxRatio * axisMax,
      seed,
      interval,
      false
    );
    
    const dataOut = generateSmoothData(
      startTs,
      endTs,
      (profile.outMinRatio || 0) * axisMax,
      (profile.outMaxRatio || 0) * axisMax,
      seed + 997,
      interval,
      false
    );
    
    return { dataIn, dataOut };
  }
}

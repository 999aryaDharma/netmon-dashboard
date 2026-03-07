import { Site, DataPoint } from "../types";

/**
 * Interface configuration untuk chart
 */
export interface InterfaceColor {
  in: string;
  out: string;
}

/**
 * Axis configuration
 */
export interface AxisConfig {
  bidirectional: boolean;      // true = IN atas, OUT bawah (MRTG)
  showZeroLine: boolean;        // Garis tengah zero
  labelFormat: 'RRDTool' | 'Zabbix' | 'custom';
  steps: number[];              // Step interval untuk y-axis
}

/**
 * Color palette configuration
 */
export interface ColorPalette {
  interfaces: InterfaceColor[];
  gridLine: string;
  text: string;
  zeroLine: string;
  background: string;
}

/**
 * Interface profile untuk generate data
 */
export interface InterfaceProfile {
  name: string;
  inMinRatio: number;    // 0.1 = 10% dari axisMax
  inMaxRatio: number;    // 0.4 = 40% dari axisMax
  outMinRatio?: number;  // undefined untuk load-only
  outMaxRatio?: number;
}

/**
 * Base Chart Renderer Interface
 */
export interface IChartRenderer {
  readonly region: 'bali' | 'banten';
  
  // Get configurations
  getAxisConfig(): AxisConfig;
  getColorPalette(): ColorPalette;
  getInterfaceProfiles(axisMax: number): InterfaceProfile[];
  
  // Data generation helpers
  generateInterfaceData(
    profile: InterfaceProfile,
    startTs: number,
    endTs: number,
    seed: number,
    interval: number
  ): { dataIn: DataPoint[]; dataOut: DataPoint[] };
}

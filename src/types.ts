export type SiteType = "traffic" | "latency" | "ping";
export type SiteRegion = "bali" | "banten";
export type GraphType = "traffic" | "load"; // traffic = bidirectional, load = unidirectional

export interface DataPoint {
  timestamp: number;
  value: number;
  lossRate?: number;
}

export interface SiteInterface {
  id: string;
  name: string;
  colorIn: string;
  colorOut: string;
  dataIn: DataPoint[];
  dataOut: DataPoint[];
  dataRtt?: DataPoint[];
  dataLoss?: DataPoint[];
}

export interface Site {
  id: string;
  name: string;
  type: SiteType;
  unit: string;
  axisMax: number;
  interfaces: SiteInterface[];
  region?: SiteRegion; // "bali" | "banten" — opsional agar backward-compatible
  graphType?: GraphType; // "traffic" (bidirectional) atau "load" (unidirectional)
}

export interface TimeRange {
  start: number;
  end: number;
  label: string;
}

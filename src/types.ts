// 'traffic' = bidirectional (in up green / out down purple)
// 'latency' = single upward line
export type SiteType = 'traffic' | 'latency';

export interface DataPoint {
  timestamp: number;
  value: number;
}

export interface Site {
  id: string;
  name: string;
  type: SiteType;
  colorIn: string;   // green for IN, or single line color for latency
  colorOut: string;  // purple for OUT (ignored on latency)
  unit: string;      // 'Mbps' | 'bps' | 'ms' | '%'
  axisMax: number;   // positive Y max; negative mirror for out
  dataIn: DataPoint[];
  dataOut: DataPoint[];  // stored positive, rendered negative
}

export interface TimeRange {
  start: number;
  end: number;
  label: string;
}

export type SiteType = "traffic" | "latency" | "ping";

export interface DataPoint {
  timestamp: number;
  value: number;
  lossRate?: number; // Packet loss percentage (0-100) for ping type
}

// One interface inside a site (e.g. ether1, ether2, LAN)
export interface SiteInterface {
  id: string;
  name: string; // 'ether1', 'ether2', 'LAN', etc.
  colorIn: string; // color for IN traffic
  colorOut: string; // color for OUT traffic
  dataIn: DataPoint[];
  dataOut: DataPoint[];
  dataRtt?: DataPoint[]; // RTT data for ping type
  dataLoss?: DataPoint[]; // Packet loss data for ping type
}

// One site = one router/device with multiple interfaces stacked in one chart
export interface Site {
  id: string;
  name: string; // e.g. "Mikrotik-Core-01"
  type: SiteType;
  unit: string; // 'Mbps' | 'bps' | 'ms' | '%'
  axisMax: number; // total positive Y max (for ALL stacked interfaces)
  interfaces: SiteInterface[];
}

export interface TimeRange {
  start: number;
  end: number;
  label: string;
}
  
import React from "react";
import type { Site, DataPoint } from "../types";

interface PingChartProps {
  site: Site;
  startTs: number;
  endTs: number;
  width?: number;
  height?: number;
}

const PAD = { top: 20, right: 50, bottom: 36, left: 60 };

// NOC-style palette untuk Ping chart
const PING_COLORS = {
  background: "#333333",
  grid: "rgba(120,140,170,0.18)",
  axisText: "#9fb3c8",
  // RTT (hijau/cyan)
  rttLine: "#00ff88",
  rttFill: "rgba(0,255,136,0.15)",
  rttGlow: "rgba(0,255,136,0.85)",
  // Loss (merah/orange)
  lossLine: "#ff4444",
  lossFill: "rgba(255,68,68,0.15)",
  lossGlow: "rgba(255,68,68,0.85)",
};

function pathFrom(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function filterRange(data: DataPoint[], start: number, end: number): DataPoint[] {
  return data.filter((d) => d.timestamp >= start && d.timestamp <= end);
}

function getXTicks(startTs: number, endTs: number): { frac: number; label: string }[] {
  const rangeMs = endTs - startTs;
  const dayMs = 86_400_000;
  let intervalMs: number;
  if (rangeMs <= 12 * 3_600_000) intervalMs = 2 * 3_600_000;
  else if (rangeMs <= 2 * dayMs) intervalMs = 6 * 3_600_000;
  else if (rangeMs <= 14 * dayMs) intervalMs = dayMs;
  else intervalMs = 7 * dayMs;

  const ticks: { frac: number; label: string }[] = [];
  let ts = Math.ceil(startTs / intervalMs) * intervalMs;
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  while (ts <= endTs) {
    const frac = (ts - startTs) / (endTs - startTs);
    const d = new Date(ts);
    let label: string;
    if (intervalMs <= dayMs)
      label = `${DAY[d.getDay()]} ${d.getDate().toString().padStart(2, "0")} ${MON[d.getMonth()]}`;
    else label = `${d.getDate()} ${MON[d.getMonth()]}`;
    ticks.push({ frac, label });
    ts += intervalMs;
  }
  return ticks;
}

export function PingChart({ site, startTs, endTs, width = 800, height = 260 }: PingChartProps) {
  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  // Ambil data RTT dan Loss dari interface pertama
  const iface = site.interfaces[0];
  const rttData = iface.dataRtt || [];
  const lossData = iface.dataLoss || [];

  const rttFiltered = filterRange(rttData, startTs, endTs);
  const lossFiltered = filterRange(lossData, startTs, endTs);

  // Ambil semua timestamp unik
  const allTimestamps = Array.from(
    new Set([...rttFiltered, ...lossFiltered].map((d) => d.timestamp))
  ).sort((a, b) => a - b);

  // Fungsi scaling
  const rttMax = site.axisMax || 100; // ms
  const lossMax = 100; // %

  const tsToX = (ts: number) => PAD.left + ((ts - startTs) / (endTs - startTs)) * chartW;
  const rttToY = (v: number) => PAD.top + chartH - (v / rttMax) * chartH;
  const lossToY = (v: number) => PAD.top + chartH - (v / lossMax) * chartH;

  // Build points untuk RTT line
  const rttPoints = allTimestamps.map((ts) => {
    const pt = rttFiltered.find((d) => d.timestamp === ts);
    return { x: tsToX(ts), y: pt ? rttToY(pt.value) : PAD.top + chartH };
  });

  // Build points untuk Loss line
  const lossPoints = allTimestamps.map((ts) => {
    const pt = lossFiltered.find((d) => d.timestamp === ts);
    return { x: tsToX(ts), y: pt ? lossToY(pt.value) : PAD.top + chartH };
  });

  const rttLinePath = pathFrom(rttPoints);
  const lossLinePath = pathFrom(lossPoints);

  // Build area fill paths
  const rttFillPath = `${rttLinePath} L ${tsToX(allTimestamps[allTimestamps.length - 1] || 0)} ${PAD.top + chartH} L ${tsToX(allTimestamps[0] || 0)} ${PAD.top + chartH} Z`;
  const lossFillPath = `${lossLinePath} L ${tsToX(allTimestamps[allTimestamps.length - 1] || 0)} ${PAD.top + chartH} L ${tsToX(allTimestamps[0] || 0)} ${PAD.top + chartH} Z`;

  const xTicks = getXTicks(startTs, endTs);

  return (
    <div
      style={{
        position: "relative",
        background: PING_COLORS.background,
        borderRadius: "2px",
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
        {/* Background */}
        <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} fill={PING_COLORS.background} />

        {/* Grid horizontal */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = PAD.top + chartH * ratio;
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + chartW}
                y2={y}
                stroke={PING_COLORS.grid}
                strokeWidth={ratio === 1 ? 1 : 0.5}
                strokeDasharray={ratio === 1 ? "none" : "2,2"}
              />
            </g>
          );
        })}

        {/* Grid vertikal X-axis */}
        {xTicks.map((tick, i) => (
          <line
            key={i}
            x1={PAD.left + tick.frac * chartW}
            y1={PAD.top}
            x2={PAD.left + tick.frac * chartW}
            y2={PAD.top + chartH}
            stroke={PING_COLORS.grid}
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
        ))}

        {/* Label X-axis */}
        {xTicks.map((tick, i) => (
          <text
            key={i}
            x={PAD.left + tick.frac * chartW}
            y={PAD.top + chartH + 18}
            textAnchor="middle"
            fill={PING_COLORS.axisText}
            fontSize="10"
            fontFamily="JetBrains Mono, monospace"
          >
            {tick.label}
          </text>
        ))}

        {/* Loss Area Fill (di bawah) */}
        {lossFillPath && (
          <path d={lossFillPath} fill={PING_COLORS.lossFill} />
        )}

        {/* RTT Area Fill (di atas) */}
        {rttFillPath && (
          <path d={rttFillPath} fill={PING_COLORS.rttFill} />
        )}

        {/* Loss Line */}
        {lossLinePath && (
          <path
            d={lossLinePath}
            fill="none"
            stroke={PING_COLORS.lossLine}
            strokeWidth={1.5}
            opacity={0.85}
          />
        )}

        {/* RTT Line */}
        {rttLinePath && (
          <path
            d={rttLinePath}
            fill="none"
            stroke={PING_COLORS.rttLine}
            strokeWidth={1.5}
            opacity={0.85}
          />
        )}

        {/* Border */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={chartW}
          height={chartH}
          fill="none"
          stroke={PING_COLORS.grid}
          strokeWidth="1"
        />

        {/* Axis labels - Kiri (RTT ms) */}
        <text
          x={PAD.left - 10}
          y={PAD.top}
          textAnchor="end"
          fill={PING_COLORS.rttLine}
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
        >
          RTT (ms)
        </text>

        {/* Axis labels - Kanan (Loss %) */}
        <text
          x={PAD.left + chartW + 10}
          y={PAD.top}
          textAnchor="start"
          fill={PING_COLORS.lossLine}
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
        >
          Loss (%)
        </text>

        {/* Y-Axis Labels - Kiri (RTT) */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = rttToY(val);
          if (y < PAD.top || y > PAD.top + chartH) return null;
          return (
            <text
              key={`rtt-${val}`}
              x={PAD.left - 8}
              y={y + 4}
              textAnchor="end"
              fill={PING_COLORS.rttLine}
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              {val}
            </text>
          );
        })}

        {/* Y-Axis Labels - Kanan (Loss) */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = lossToY(val);
          if (y < PAD.top || y > PAD.top + chartH) return null;
          return (
            <text
              key={`loss-${val}`}
              x={PAD.left + chartW + 8}
              y={y + 4}
              textAnchor="start"
              fill={PING_COLORS.lossLine}
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              {val}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

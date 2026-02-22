import React, { useRef, useState, useCallback } from "react";
import type { Site, SiteInterface, DataPoint } from "../types";

interface ChartProps {
  site: Site;
  startTs: number;
  endTs: number;
  width?: number;
  height?: number;
}

interface TooltipData {
  x: number;
  ts: number;
  values: {
    iface: SiteInterface;
    valIn: number | null;
    valOut: number | null;
  }[];
}

const PAD = { top: 20, right: 30, bottom: 36, left: 60 };

// NOC-style palette
const COLORS = {
  background: "#333333",
  grid: "rgba(120,140,170,0.18)",
  axisText: "#9fb3c8",
  // Inbound (hijau)
  inGlow: "rgba(155,255,80,0.85)",
  inMain: "#7CFF4E",
  inDeep: "#2DBE4A",
  inShadow: "rgba(0,60,20,0.65)",
  // Outbound (ungu)
  outGlow: "rgba(210,80,255,0.85)",
  outMain: "#C23BFF",
  outDeep: "#6B1FA8",
  outShadow: "rgba(30,0,60,0.65)",
};

// Smooth curve menggunakan Catmull-Rom spline
function smoothCatmullRom(points: { x: number; y: number }[]): string {
  if (points.length < 2) return pathFrom(points);
  if (points.length === 2) return pathFrom(points);

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const tension = 0.5;

    for (let t = 0; t <= 1; t += 0.1) {
      const tt = t * t;
      const ttt = tt * t;

      const q0 = -ttt + 2 * tt - t;
      const q1 = 3 * ttt - 5 * tt + 2;
      const q2 = -3 * ttt + 4 * tt + t;
      const q3 = ttt - tt;

      const x =
        0.5 *
        (q0 * p0.x + q1 * p1.x + q2 * p2.x + q3 * p3.x) *
          (1 - tension) +
        p1.x * t +
        p2.x * (1 - t);

      const y =
        0.5 *
        (q0 * p0.y + q1 * p1.y + q2 * p2.y + q3 * p3.y) *
          (1 - tension) +
        p1.y * t +
        p2.y * (1 - t);

      if (t === 0) {
        d += ` L ${p1.x} ${p1.y}`;
      } else {
        d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
    }
  }

  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
}

function pathFrom(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function filterRange(
  data: DataPoint[],
  start: number,
  end: number,
): DataPoint[] {
  return data.filter((d) => d.timestamp >= start && d.timestamp <= end);
}

function alignToTimestamps(
  data: DataPoint[],
  timestamps: number[],
): (number | null)[] {
  const map = new Map(data.map((d) => [d.timestamp, d.value]));
  return timestamps.map((ts) => map.get(ts) ?? null);
}

function getXTicks(
  startTs: number,
  endTs: number,
): { frac: number; label: string }[] {
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
  const MON = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

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

function getYTicks(
  axisMax: number,
  bidir: boolean,
): { value: number; label: string }[] {
  const ticks: { value: number; label: string }[] = [];
  const count = 5;
  const step = axisMax / count;
  for (let i = count; i >= (bidir ? -count : 0); i--) {
    const v = i * step;
    const abs = Math.abs(v); // Hilangkan tanda minus
    let label: string;
    if (abs >= 1_000_000) label = `${(abs / 1_000_000).toFixed(0)} M`;
    else if (abs >= 1_000) label = `${(abs / 1_000).toFixed(0)} k`;
    else label = `${abs.toFixed(0)}`;
    ticks.push({ value: v, label });
  }
  return ticks;
}

export function Chart({
  site,
  startTs,
  endTs,
  width = 800,
  height = 260,
}: ChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;
  const isTraffic = site.type === "traffic";
  const axisMax = site.axisMax || 1;
  const totalRange = isTraffic ? axisMax * 2 : axisMax;

  const valToY = useCallback(
    (v: number) => PAD.top + ((axisMax - v) / totalRange) * chartH,
    [axisMax, totalRange, chartH],
  );

  const tsToX = useCallback(
    (ts: number) => PAD.left + ((ts - startTs) / (endTs - startTs)) * chartW,
    [startTs, endTs, chartW],
  );

  const allTimestamps = Array.from(
    new Set(
      site.interfaces.flatMap((iface) =>
        [
          ...filterRange(iface.dataIn, startTs, endTs),
          ...filterRange(iface.dataOut, startTs, endTs),
        ].map((d) => d.timestamp),
      ),
    ),
  ).sort((a, b) => a - b);

  const ifaceData = site.interfaces.map((iface) => ({
    iface,
    inFiltered: filterRange(iface.dataIn, startTs, endTs),
    outFiltered: filterRange(iface.dataOut, startTs, endTs),
  }));

  const stackedInLayers: {
    iface: SiteInterface;
    lowerY: number[];
    upperY: number[];
  }[] = [];
  const cumIn = new Array(allTimestamps.length).fill(0);
  for (const { iface, inFiltered } of ifaceData) {
    const vals = alignToTimestamps(inFiltered, allTimestamps);
    const lowerY = cumIn.map((v) => valToY(v));
    vals.forEach((v, i) => {
      if (v !== null) cumIn[i] += v;
    });
    const upperY = cumIn.map((v) => valToY(v));
    stackedInLayers.push({ iface, lowerY, upperY });
  }

  const stackedOutLayers: {
    iface: SiteInterface;
    lowerY: number[];
    upperY: number[];
  }[] = [];
  const cumOut = new Array(allTimestamps.length).fill(0);
  for (const { iface, outFiltered } of ifaceData) {
    const vals = alignToTimestamps(outFiltered, allTimestamps);
    const upperY = cumOut.map((v) => valToY(-v));
    vals.forEach((v, i) => {
      if (v !== null) cumOut[i] += v;
    });
    const lowerY = cumOut.map((v) => valToY(-v));
    stackedOutLayers.push({ iface, lowerY, upperY });
  }

  const tsX = allTimestamps.map((ts) => tsToX(ts));
  const yTicks = getYTicks(axisMax, isTraffic);
  const xTicks = getXTicks(startTs, endTs);
  const clipId = `clip-${site.id}`;

  return (
    <div
      style={{
        position: "relative",
        background: COLORS.background,
        borderRadius: "2px",
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block" }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
          </clipPath>
        </defs>

        {/* Background Grafik - NOC Style */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={chartW}
          height={chartH}
          fill={COLORS.background}
        />

        {/* Grid & Label Y-Axis */}
        {yTicks.map((tick, i) => {
          const y = valToY(tick.value);
          if (y < PAD.top - 1 || y > PAD.top + chartH + 1) return null;
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + chartW}
                y2={y}
                stroke={COLORS.grid}
                strokeWidth={tick.value === 0 ? 1 : 0.5}
                strokeDasharray={tick.value === 0 ? "none" : "2,2"}
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                fill={COLORS.axisText}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {tick.label}
              </text>
            </g>
          );
        })}

        {/* Grid Vertikal X-Axis */}
        {xTicks.map((tick, i) => (
          <line
            key={i}
            x1={PAD.left + tick.frac * chartW}
            y1={PAD.top}
            x2={PAD.left + tick.frac * chartW}
            y2={PAD.top + chartH}
            stroke={COLORS.grid}
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
        ))}

        {/* Teks Vertikal Khas RRDtool */}
        <text
          transform={`translate(${width - 12}, ${PAD.top + 10}) rotate(90)`}
          fill="#2a2f36"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
          letterSpacing="1px"
        >
          RRDTOOL / TOBI OETIKER
        </text>

        {/* Render 3 Layer per Interface - NOC Style */}
        {/* Outbound layers (bawah) */}
        {stackedOutLayers.map(({ iface, lowerY, upperY }, idx) => {
          if (!allTimestamps.length) return null;
          const totalLayers = stackedOutLayers.length;
          const layerOpacity = 0.5 + (idx / totalLayers) * 0.3;

          const lowerPts = allTimestamps.map((_, i) => ({
            x: tsX[i],
            y: lowerY[i],
          }));
          const upperPts = allTimestamps.map((_, i) => ({
            x: tsX[i],
            y: upperY[i],
          }));

          // Build fill path (area tertutup)
          let fillD = `M ${upperPts[0].x} ${upperPts[0].y}`;
          for (let i = 1; i < upperPts.length; i++) {
            fillD += ` L ${upperPts[i].x} ${upperPts[i].y}`;
          }
          for (let i = lowerPts.length - 1; i >= 0; i--) {
            fillD += ` L ${lowerPts[i].x} ${lowerPts[i].y}`;
          }
          fillD += " Z";

          // Build line path (glow line di atas)
          let lineD = `M ${upperPts[0].x} ${upperPts[0].y}`;
          for (let i = 1; i < upperPts.length; i++) {
            lineD += ` L ${upperPts[i].x} ${upperPts[i].y}`;
          }

          return (
            <g key={iface.id} clipPath={`url(#${clipId})`}>
              {/* Layer 1: Shadow fill (paling bawah) */}
              <path d={fillD} fill={COLORS.outShadow} />

              {/* Layer 2: Main fill (tengah) */}
              <path d={fillD} fill={COLORS.outDeep} opacity={layerOpacity} />

              {/* Layer 3: Glow line (paling atas) */}
              <path
                d={lineD}
                fill="none"
                stroke={COLORS.outGlow}
                strokeWidth={1.5}
                opacity={0.85}
              />
            </g>
          );
        })}

        {/* Inbound layers (atas) */}
        {stackedInLayers.map(({ iface, lowerY, upperY }, idx) => {
          if (!allTimestamps.length) return null;
          const totalLayers = stackedInLayers.length;
          const layerOpacity = 0.5 + (idx / totalLayers) * 0.3;

          const lowerPts = allTimestamps.map((_, i) => ({
            x: tsX[i],
            y: lowerY[i],
          }));
          const upperPts = allTimestamps.map((_, i) => ({
            x: tsX[i],
            y: upperY[i],
          }));

          // Build fill path (area tertutup)
          let fillD = `M ${upperPts[0].x} ${upperPts[0].y}`;
          for (let i = 1; i < upperPts.length; i++) {
            fillD += ` L ${upperPts[i].x} ${upperPts[i].y}`;
          }
          for (let i = lowerPts.length - 1; i >= 0; i--) {
            fillD += ` L ${lowerPts[i].x} ${lowerPts[i].y}`;
          }
          fillD += " Z";

          // Build line path (glow line di atas)
          let lineD = `M ${upperPts[0].x} ${upperPts[0].y}`;
          for (let i = 1; i < upperPts.length; i++) {
            lineD += ` L ${upperPts[i].x} ${upperPts[i].y}`;
          }

          return (
            <g key={iface.id} clipPath={`url(#${clipId})`}>
              {/* Layer 1: Shadow fill (paling bawah) */}
              <path d={fillD} fill={COLORS.inShadow} />

              {/* Layer 2: Main fill (tengah) */}
              <path d={fillD} fill={COLORS.inDeep} opacity={layerOpacity} />

              {/* Layer 3: Glow line (paling atas) */}
              <path
                d={lineD}
                fill="none"
                stroke={COLORS.inGlow}
                strokeWidth={1.5}
                opacity={0.85}
              />
            </g>
          );
        })}

        {/* X axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={i}
            x={PAD.left + tick.frac * chartW}
            y={PAD.top + chartH + 18}
            textAnchor="middle"
            fill={COLORS.axisText}
            fontSize="10"
            fontFamily="JetBrains Mono, monospace"
          >
            {tick.label}
          </text>
        ))}

        {/* Bingkai luar grafik */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={chartW}
          height={chartH}
          fill="none"
          stroke={COLORS.grid}
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

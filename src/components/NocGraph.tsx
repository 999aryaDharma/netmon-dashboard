// NOC-style Graph Renderer dengan 3-layer visual
import React from "react";

export interface Point {
  x: number;
  y: number;
}

// NOC-style color palette
export const NOC_COLORS = {
  background: "#0b0f14",
  grid: "rgba(120,140,170,0.18)",
  axisText: "#9fb3c8",
  // Inbound (hijau)
  inGlow: "rgba(155,255,80,0.85)",
  inMain: "#2DBE4A",
  inShadow: "rgba(0,60,20,0.65)",
  // Outbound (ungu)
  outGlow: "rgba(210,80,255,0.85)",
  outMain: "#6B1FA8",
  outShadow: "rgba(30,0,60,0.65)",
};

function pathFrom(points: Point[]): string {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function buildAreaPath(
  linePoints: Point[],
  baseY: number,
  width: number
): string {
  if (!linePoints.length) return "";
  let d = `M ${linePoints[0].x} ${linePoints[0].y}`;
  for (let i = 1; i < linePoints.length; i++) {
    d += ` L ${linePoints[i].x} ${linePoints[i].y}`;
  }
  d += ` L ${linePoints[linePoints.length - 1].x} ${baseY}`;
  d += ` L ${linePoints[0].x} ${baseY}`;
  d += " Z";
  return d;
}

interface NocGraphProps {
  width: number;
  height: number;
  inbound: Point[];
  outbound: Point[];
  showGrid?: boolean;
  gridColor?: string;
}

export default function NocGraph({
  width,
  height,
  inbound,
  outbound,
  showGrid = true,
  gridColor = NOC_COLORS.grid,
}: NocGraphProps) {
  const baseY = height / 2;

  const inLine = pathFrom(inbound);
  const outLine = pathFrom(outbound);

  const inFill = buildAreaPath(inbound, baseY, width);
  const outFill = buildAreaPath(outbound, baseY, width);

  return (
    <svg
      width={width}
      height={height}
      style={{ background: NOC_COLORS.background, display: "block" }}
    >
      {/* Grid lines (opsional) */}
      {showGrid && (
        <g>
          <line
            x1="0"
            y1={baseY}
            x2={width}
            y2={baseY}
            stroke={gridColor}
            strokeWidth="1"
            strokeDasharray="4,4"
          />
          {[0.25, 0.5, 0.75].map((ratio) => (
            <React.Fragment key={ratio}>
              <line
                x1="0"
                y1={baseY * ratio}
                x2={width}
                y2={baseY * ratio}
                stroke={gridColor}
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
              <line
                x1="0"
                y1={baseY + baseY * ratio}
                x2={width}
                y2={baseY + baseY * ratio}
                stroke={gridColor}
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            </React.Fragment>
          ))}
        </g>
      )}

      {/* Inbound layers (atas - hijau) */}
      {/* Layer 1: Shadow fill */}
      <path d={inFill} fill={NOC_COLORS.inShadow} />

      {/* Layer 2: Main fill */}
      <path d={inFill} fill={NOC_COLORS.inMain} opacity={0.75} />

      {/* Layer 3: Glow line */}
      <path
        d={inLine}
        fill="none"
        stroke={NOC_COLORS.inGlow}
        strokeWidth={1.6}
        opacity={0.85}
      />

      {/* Outbound layers (bawah - ungu) */}
      {/* Layer 1: Shadow fill */}
      <path d={outFill} fill={NOC_COLORS.outShadow} />

      {/* Layer 2: Main fill */}
      <path d={outFill} fill={NOC_COLORS.outMain} opacity={0.75} />

      {/* Layer 3: Glow line */}
      <path
        d={outLine}
        fill="none"
        stroke={NOC_COLORS.outGlow}
        strokeWidth={1.6}
        opacity={0.85}
      />
    </svg>
  );
}

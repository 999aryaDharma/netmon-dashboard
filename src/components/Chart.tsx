import React, { useRef, useState, useCallback } from 'react';
import type { Site, DataPoint } from '../types';

interface ChartProps {
  site: Site;
  startTs: number;
  endTs: number;
  width?: number;
  height?: number;
}

interface TooltipData {
  x: number;
  tsIn: number;
  valIn: number | null;
  valOut: number | null;
}

const PAD = { top: 16, right: 8, bottom: 36, left: 54 };

// -- helpers ------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function buildAreaPath(
  pts: { x: number; y: number }[],
  zeroY: number,
  side: 'up' | 'down'
): string {
  if (pts.length < 2) return '';
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    line += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${line} L ${last.x} ${zeroY} L ${first.x} ${zeroY} Z`;
}

function buildLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

function filterRange(data: DataPoint[], start: number, end: number): DataPoint[] {
  return data.filter(d => d.timestamp >= start && d.timestamp <= end);
}

function formatVal(v: number, unit: string): string {
  if (unit === 'Mbps' || unit === 'bps') {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)} k`;
    return `${v.toFixed(0)}`;
  }
  if (unit === 'ms') return `${v.toFixed(1)} ms`;
  if (unit === '%') return `${v.toFixed(1)}%`;
  return v.toFixed(2);
}

function getXTicks(startTs: number, endTs: number, chartW: number): { x: number; label: string }[] {
  const rangeMs = endTs - startTs;
  const dayMs = 86_400_000;
  let intervalMs: number;

  if (rangeMs <= 12 * 3_600_000) intervalMs = 2 * 3_600_000;
  else if (rangeMs <= 2 * dayMs) intervalMs = 6 * 3_600_000;
  else if (rangeMs <= 14 * dayMs) intervalMs = dayMs;
  else if (rangeMs <= 60 * dayMs) intervalMs = 7 * dayMs;
  else intervalMs = 30 * dayMs;

  const ticks: { x: number; label: string }[] = [];
  let ts = Math.ceil(startTs / intervalMs) * intervalMs;

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  while (ts <= endTs) {
    const x = ((ts - startTs) / (endTs - startTs)) * chartW;
    const d = new Date(ts);
    let label: string;
    if (intervalMs < dayMs) {
      label = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } else if (intervalMs <= dayMs) {
      label = `${DAY_NAMES[d.getDay()]} ${d.getDate().toString().padStart(2, '0')} ${MON_NAMES[d.getMonth()]}`;
    } else {
      label = `${d.getDate()} ${MON_NAMES[d.getMonth()]}`;
    }
    ticks.push({ x, label });
    ts += intervalMs;
  }
  return ticks;
}

function getYTicks(axisMax: number, bidir: boolean): { value: number; label: string }[] {
  const ticks: { value: number; label: string }[] = [];
  const count = 5; // per side
  const step = axisMax / count;
  for (let i = count; i >= (bidir ? -count : 0); i--) {
    const v = i * step;
    let label: string;
    const abs = Math.abs(v);
    if (abs >= 1_000_000) label = `${(v / 1_000_000).toFixed(0)} M`;
    else if (abs >= 1_000) label = `${(v / 1_000).toFixed(0)} k`;
    else label = `${v.toFixed(0)}`;
    ticks.push({ value: v, label });
  }
  return ticks;
}

function hexBright(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
  return `#${clamp(r * factor).toString(16).padStart(2, '0')}${clamp(g * factor).toString(16).padStart(2, '0')}${clamp(b * factor).toString(16).padStart(2, '0')}`;
}

// -- component ----------------------------------------------------------------

export function Chart({ site, startTs, endTs, width = 800, height = 240 }: ChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;
  const isTraffic = site.type === 'traffic';
  const axisMax = site.axisMax || 1;

  // Y mapping: value -> pixel Y
  // For traffic: range is [-axisMax, axisMax], zeroY = chartH/2
  // For latency: range is [0, axisMax], zeroY = chartH (bottom)
  const totalRange = isTraffic ? axisMax * 2 : axisMax;
  const yMin = isTraffic ? -axisMax : 0;

  const valToY = useCallback(
    (v: number) => PAD.top + ((axisMax - v) / totalRange) * chartH,
    [axisMax, totalRange, chartH]
  );
  const zeroY = valToY(0);

  const tsToX = useCallback(
    (ts: number) => PAD.left + ((ts - startTs) / (endTs - startTs)) * chartW,
    [startTs, endTs, chartW]
  );

  const inData = filterRange(site.dataIn, startTs, endTs);
  const outData = filterRange(site.dataOut, startTs, endTs);

  const inPts = inData.map(d => ({ x: tsToX(d.timestamp), y: valToY(d.value), raw: d }));
  const outPts = outData.map(d => ({ x: tsToX(d.timestamp), y: valToY(-d.value), raw: d }));

  const inAreaPath = buildAreaPath(inPts.map(p => ({ x: p.x, y: p.y })), zeroY, 'up');
  const outAreaPath = buildAreaPath(outPts.map(p => ({ x: p.x, y: p.y })), zeroY, 'down');
  const inLinePath = buildLinePath(inPts.map(p => ({ x: p.x, y: p.y })));
  const outLinePath = buildLinePath(outPts.map(p => ({ x: p.x, y: p.y })));

  const yTicks = getYTicks(axisMax, isTraffic);
  const xTicks = getXTicks(startTs, endTs, chartW);

  // Colors
  const colorIn = site.colorIn;
  const colorOut = site.colorOut;
  const colorInDark = hexBright(colorIn, 0.5);
  const colorOutDark = hexBright(colorOut, 0.5);

  // Mouse handling
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const relPos = (mouseX - PAD.left) / chartW;
      const ts = startTs + relPos * (endTs - startTs);

      const nearest = (data: DataPoint[]) => {
        if (!data.length) return null;
        let best = data[0];
        let bestDist = Math.abs(best.timestamp - ts);
        for (const d of data) {
          const dist = Math.abs(d.timestamp - ts);
          if (dist < bestDist) { bestDist = dist; best = d; }
        }
        return best;
      };

      const ni = nearest(inData);
      const no = nearest(outData);
      const refTs = (ni ?? no)?.timestamp ?? ts;

      setTooltip({
        x: mouseX,
        tsIn: refTs,
        valIn: ni?.value ?? null,
        valOut: no?.value ?? null,
      });
    },
    [inData, outData, chartW, startTs, endTs]
  );

  const clipId = `clip-${site.id}`;
  const gradInId = `gradin-${site.id}`;
  const gradOutId = `gradout-${site.id}`;

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div style={{ position: 'relative', background: '#1e1e1e', borderRadius: '2px' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
          </clipPath>

          {/* IN gradient: bright at zero line, slightly faded at top */}
          <linearGradient id={gradInId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorIn} stopOpacity="0.7" />
            <stop offset="100%" stopColor={colorIn} stopOpacity="0.85" />
          </linearGradient>

          {/* OUT gradient: bright at zero line, slightly faded downward */}
          <linearGradient id={gradOutId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorOut} stopOpacity="0.85" />
            <stop offset="100%" stopColor={colorOut} stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* Chart background */}
        <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} fill="#2a2a2a" />

        {/* Horizontal grid lines + Y labels */}
        {yTicks.map((tick, i) => {
          const y = valToY(tick.value);
          if (y < PAD.top - 1 || y > PAD.top + chartH + 1) return null;
          const isZero = tick.value === 0;
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + chartW}
                y2={y}
                stroke={isZero ? '#555' : '#3a3a3a'}
                strokeWidth={isZero ? 1.5 : 1}
                strokeDasharray={isZero ? 'none' : '4,4'}
              />
              <text
                x={PAD.left - 4}
                y={y + 4}
                textAnchor="end"
                fill="#999"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {tick.label}
              </text>
            </g>
          );
        })}

        {/* Vertical grid lines */}
        {xTicks.map((tick, i) => (
          <line
            key={i}
            x1={PAD.left + tick.x}
            y1={PAD.top}
            x2={PAD.left + tick.x}
            y2={PAD.top + chartH}
            stroke="#3a3a3a"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        ))}

        {/* OUT area (rendered first so IN overlaps) */}
        {outAreaPath && (
          <path
            d={outAreaPath}
            fill={`url(#${gradOutId})`}
            clipPath={`url(#${clipId})`}
          />
        )}
        {outLinePath && (
          <path
            d={outLinePath}
            fill="none"
            stroke={colorOutDark}
            strokeWidth="1.5"
            clipPath={`url(#${clipId})`}
          />
        )}

        {/* IN area */}
        {inAreaPath && (
          <path
            d={inAreaPath}
            fill={`url(#${gradInId})`}
            clipPath={`url(#${clipId})`}
          />
        )}
        {inLinePath && (
          <path
            d={inLinePath}
            fill="none"
            stroke={colorInDark}
            strokeWidth="1.5"
            clipPath={`url(#${clipId})`}
          />
        )}

        {/* X axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={i}
            x={PAD.left + tick.x}
            y={PAD.top + chartH + 18}
            textAnchor="middle"
            fill="#888"
            fontSize="10"
            fontFamily="JetBrains Mono, monospace"
          >
            {tick.label}
          </text>
        ))}

        {/* Border */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={chartW}
          height={chartH}
          fill="none"
          stroke="#444"
          strokeWidth="1"
        />

        {/* Tooltip vertical line */}
        {tooltip && (
          <line
            x1={tooltip.x}
            y1={PAD.top}
            x2={tooltip.x}
            y2={PAD.top + chartH}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1"
            strokeDasharray="3,2"
          />
        )}

        {/* No data */}
        {inData.length === 0 && outData.length === 0 && (
          <text
            x={PAD.left + chartW / 2}
            y={PAD.top + chartH / 2 + 4}
            textAnchor="middle"
            fill="#444"
            fontSize="11"
            fontFamily="JetBrains Mono, monospace"
          >
            No data — use Edit to generate data
          </text>
        )}
      </svg>

      {/* Tooltip box */}
      {tooltip && (tooltip.valIn !== null || tooltip.valOut !== null) && (
        <div style={{
          position: 'absolute',
          left: Math.min(tooltip.x + 10, width - 160),
          top: 20,
          background: 'rgba(20,20,20,0.96)',
          border: '1px solid #555',
          borderRadius: '2px',
          padding: '7px 11px',
          fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace',
          color: '#ccc',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 50,
        }}>
          <div style={{ color: '#777', marginBottom: '5px', fontSize: '10px' }}>
            {(() => {
              const d = new Date(tooltip.tsIn);
              return `${DAY_NAMES[d.getDay()]} ${d.getDate().toString().padStart(2, '0')} ${MON_NAMES[d.getMonth()]} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            })()}
          </div>
          {tooltip.valIn !== null && (
            <div style={{ color: colorIn }}>
              In: {formatVal(tooltip.valIn, site.unit)} {site.unit}
            </div>
          )}
          {tooltip.valOut !== null && isTraffic && (
            <div style={{ color: colorOut }}>
              Out: {formatVal(tooltip.valOut, site.unit)} {site.unit}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

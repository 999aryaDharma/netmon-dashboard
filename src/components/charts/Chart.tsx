import React, { useMemo } from "react";
import { Site } from "../../types";

// Fungsi helper untuk memformat angka Bytes/Bits
function formatBytesRate(v: number): string {
  if (v === null || isNaN(v)) return "0 bps";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} Mbps`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(2)} kbps`;
  return `${v.toFixed(2)} bps`;
}

// Gunakan tema yang sama persis dengan PingChart agar konsisten
const THEME = {
  chartBg: "#323841",
  gridLine: "rgba(255, 255, 255, 0.15)",
  text: "#c8ced6",
  axisTitle: "#edf1f4",
};

export function Chart({
  site,
  startTs,
  endTs,
  width,
  height,
}: {
  site: Site;
  startTs: number;
  endTs: number;
  width: number;
  height: number;
}) {
  // Padding disesuaikan untuk label yang diputar
  const PAD = { top: 30, right: 30, bottom: 30, left: 85 };
  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  // --- Data Processing ---
  let combined: { ts: number; [key: string]: number }[] = [];
  const timeSet = new Set<number>();

  site.interfaces.forEach((iface) => {
    // "latency" di aplikasi ini dipakai untuk single metric (CPU Load)
    if (site.type === "latency") {
      iface.dataIn?.forEach((d) => timeSet.add(d.timestamp));
    } else {
      // "traffic"
      iface.dataIn?.forEach((d) => timeSet.add(d.timestamp));
      iface.dataOut?.forEach((d) => timeSet.add(d.timestamp));
    }
  });

  const sortedTimes = Array.from(timeSet).sort((a, b) => a - b);
  const timestamps = sortedTimes.filter((t) => t >= startTs && t <= endTs);

  timestamps.forEach((ts) => {
    const row: any = { ts };
    site.interfaces.forEach((iface) => {
      if (site.type === "latency") {
        const pt = iface.dataIn?.find((d) => d.timestamp === ts);
        row[`${iface.id}_load`] = pt ? pt.value : 0;
      } else {
        const ptIn = iface.dataIn?.find((d) => d.timestamp === ts);
        row[`${iface.id}_in`] = ptIn ? ptIn.value : 0;
        const ptOut = iface.dataOut?.find((d) => d.timestamp === ts);
        row[`${iface.id}_out`] = ptOut ? ptOut.value : 0;
      }
    });
    combined.push(row);
  });

  if (combined.length < 2) {
    return (
      <svg width={width} height={height} style={{ background: THEME.chartBg }}>
        <text
          x={width / 2}
          y={height / 2}
          fill={THEME.text}
          textAnchor="middle"
        >
          No Data in Range
        </text>
      </svg>
    );
  }

  // --- Stacking Logic ---
  const stacked: any[] = combined.map((c) => ({ ...c }));
  let maxStack = 0;

  if (site.type === "latency") {
    stacked.forEach((row) => {
      let sum = 0;
      site.interfaces.forEach((iface) => {
        const val = row[`${iface.id}_load`];
        row[`${iface.id}_y0`] = sum;
        sum += val;
        row[`${iface.id}_y1`] = sum;
      });
      if (sum > maxStack) maxStack = sum;
    });
  } else {
    // Traffic (bidirectional)
    stacked.forEach((row) => {
      let sumIn = 0;
      site.interfaces.forEach((iface) => {
        const val = row[`${iface.id}_in`];
        row[`${iface.id}_in_y0`] = sumIn;
        sumIn += val;
        row[`${iface.id}_in_y1`] = sumIn;
      });
      if (sumIn > maxStack) maxStack = sumIn;

      let sumOut = 0;
      site.interfaces.forEach((iface) => {
        const val = row[`${iface.id}_out`];
        row[`${iface.id}_out_y0`] = sumOut;
        sumOut += val;
        row[`${iface.id}_out_y1`] = sumOut;
      });
      if (sumOut > maxStack) maxStack = sumOut;
    });
  }

  // --- Scales ---
  // Dynamic axis: gunakan nilai terbesar antara configured max atau spike manual
  const configuredMax = site.axisMax || 100;
  const axisMax = Math.max(configuredMax, maxStack * 1.1);
  const timeRange = endTs - startTs || 1;
  const getX = (ts: number) => PAD.left + ((ts - startTs) / timeRange) * chartW;

  // Y-Scale Logic: Traffic (Center 0) vs Load (Bottom 0)
  let getY: (v: number) => number;
  let zeroY: number;
  if (site.type === "traffic") {
    // Tengah adalah 0
    const halfH = chartH / 2;
    zeroY = PAD.top + halfH;
    getY = (val: number) => zeroY - (val / axisMax) * halfH;
  } else {
    // Bawah adalah 0 (Untuk tipe 'latency' / CPU Load upward)
    zeroY = PAD.top + chartH;
    getY = (val: number) => zeroY - (val / axisMax) * chartH;
  }

  // area generators
  const makeArea = (keyY0: string, keyY1: string) => {
    if (stacked.length < 2) return "";
    let top = ``;
    let bottom = ``;
    // forward
    for (let i = 0; i < stacked.length; i++) {
      const x = getX(stacked[i].ts);
      const y1 = getY(stacked[i][keyY1]);
      top += `${i === 0 ? "M" : "L"} ${x} ${y1} `;
    }
    // backward
    for (let i = stacked.length - 1; i >= 0; i--) {
      const x = getX(stacked[i].ts);
      const y0 = getY(stacked[i][keyY0]);
      bottom += `L ${x} ${y0} `;
    }
    return top + bottom + "Z";
  };

  // --- Ticks ---
  const yTickCount = 5;
  const yTicks = [];
  if (site.type === "traffic") {
    // Ticks positif dan negatif
    for (let i = 0; i <= yTickCount; i++) {
      const val = (axisMax / yTickCount) * i;
      if (val === 0) continue;
      yTicks.push({ val, y: getY(val), label: formatBytesRate(val) });
      yTicks.push({ val: -val, y: getY(-val), label: formatBytesRate(val) });
    }
    yTicks.push({ val: 0, y: zeroY, label: "0" });
  } else {
    for (let i = 0; i <= yTickCount; i++) {
      const val = (axisMax / yTickCount) * i;
      yTicks.push({ val, y: getY(val), label: formatBytesRate(val) });
    }
  }

  // X Ticks (Waktu)
  const xTickCount = 8;
  const xTicks = [];
  const step = timeRange / xTickCount;
  for (let i = 0; i <= xTickCount; i++) {
    const ts = startTs + step * i;
    xTicks.push({ ts, x: getX(ts) });
  }

  // Helper format waktu NOC Style
  const formatXLabel = (ts: number, isLast: boolean) => {
    const date = new Date(ts);
    if (isLast) {
      return date
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        .replace(" ", ". ");
    }
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <svg width={width} height={height} style={{ background: "transparent" }}>
      {/* Area Plot Latar Belakang */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={chartW}
        height={chartH}
        fill={THEME.chartBg}
        stroke="none"
      />

      {/* --- Areas --- */}
      {[...site.interfaces].reverse().map((iface) => {
        if (site.type === "latency") {
          return (
            <path
              key={iface.id}
              d={makeArea(`${iface.id}_y0`, `${iface.id}_y1`)}
              fill={iface.colorIn}
              opacity={0.8}
            />
          );
        } else {
          return (
            <g key={iface.id}>
              <path
                d={makeArea(`${iface.id}_in_y0`, `${iface.id}_in_y1`)}
                fill={iface.colorIn}
                opacity={0.7}
              />
              <path
                d={makeArea(`${iface.id}_out_y0`, `${iface.id}_out_y1`)}
                fill={iface.colorOut}
                opacity={0.7}
              />
            </g>
          );
        }
      })}

      {/* --- Grid & Y Labels --- */}
      {yTicks.map(({ y, label }, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            y1={y}
            x2={PAD.left + chartW}
            y2={y}
            stroke={THEME.gridLine}
            strokeWidth={1}
          />
          {/* Label Angka Sumbu Y */}
          <text
            x={PAD.left - 8}
            y={y + 4}
            textAnchor="end"
            fill={THEME.text}
            fontSize="10"
            fontFamily="Arial, sans-serif"
          >
            {label}
          </text>
        </g>
      ))}

      {/* Center Line untuk Traffic */}
      {site.type === "traffic" && (
        <line
          x1={PAD.left}
          y1={zeroY}
          x2={PAD.left + chartW}
          y2={zeroY}
          stroke={THEME.text}
          strokeWidth={1}
          opacity={0.3}
        />
      )}

      {/* --- X Labels (Waktu) --- */}
      {xTicks.map(({ ts, x }, i) => {
        const isLast = i === xTicks.length - 1;
        return (
          <g key={i}>
            <line
              x1={x}
              y1={PAD.top + chartH}
              x2={x}
              y2={PAD.top + chartH + 5}
              stroke={THEME.gridLine}
              strokeWidth={1}
            />
            <text
              x={x}
              y={PAD.top + chartH + 18}
              textAnchor={isLast ? "end" : "middle"}
              fill={THEME.text}
              fontSize="10"
              fontFamily="Arial, sans-serif"
            >
              {formatXLabel(ts, isLast)}
            </text>
          </g>
        );
      })}

      {/* --- Judul Sumbu Y Kiri di Ujung Atas --- */}
      <text
        x={PAD.left - 8}
        y={PAD.top - 12}
        textAnchor="end"
        fill={THEME.axisTitle}
        fontSize="10"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        Bits/sec
      </text>

      {/* Border Kotak Luar */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={chartW}
        height={chartH}
        fill="none"
        stroke={THEME.gridLine}
        strokeWidth={1}
      />
    </svg>
  );
}

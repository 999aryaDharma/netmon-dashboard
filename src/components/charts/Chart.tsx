import React, { useMemo } from "react";
import { Site } from "../../types";

// 1. FORMATTER DIPERBAIKI: Menambahkan format M / k dan tanda minus (-)
function formatBytesRate(v: number): string {
  if (v === null || isNaN(v)) return "0";
  const isNegative = v < 0;
  const abs = Math.abs(v);
  const sign = isNegative ? "-" : "";

  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)} k`;
  return `${sign}${abs.toFixed(0)}`;
}

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
  const PAD = { top: 30, right: 30, bottom: 30, left: 85 };
  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  let combined: { ts: number; [key: string]: number }[] = [];
  const timeSet = new Set<number>();

  site.interfaces.forEach((iface) => {
    if (site.type === "latency") {
      iface.dataIn?.forEach((d) => timeSet.add(d.timestamp));
    } else {
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

  const configuredMax = site.axisMax || 100;
  const axisMax = Math.max(configuredMax, maxStack * 1.1);
  const timeRange = endTs - startTs || 1;
  const getX = (ts: number) => PAD.left + ((ts - startTs) / timeRange) * chartW;

  let getY: (v: number) => number;
  let zeroY: number;
  if (site.type === "traffic") {
    const halfH = chartH / 2;
    zeroY = PAD.top + halfH;
    getY = (val: number) => zeroY - (val / axisMax) * halfH;
  } else {
    zeroY = PAD.top + chartH;
    getY = (val: number) => zeroY - (val / axisMax) * chartH;
  }

  // 2. PERBAIKAN GENERATOR AREA: Menerima parameter invertY agar OUT digambar ke bawah
  const makeArea = (keyY0: string, keyY1: string, invertY = false) => {
    if (stacked.length < 2) return "";
    let top = ``;
    let bottom = ``;
    // forward
    for (let i = 0; i < stacked.length; i++) {
      const x = getX(stacked[i].ts);
      const val = stacked[i][keyY1];
      const y1 = getY(invertY ? -val : val);
      top += `${i === 0 ? "M" : "L"} ${x} ${y1} `;
    }
    // backward
    for (let i = stacked.length - 1; i >= 0; i--) {
      const x = getX(stacked[i].ts);
      const val = stacked[i][keyY0];
      const y0 = getY(invertY ? -val : val);
      bottom += `L ${x} ${y0} `;
    }
    return top + bottom + "Z";
  };

  const yTickCount = 5;
  const yTicks = [];
  if (site.type === "traffic") {
    for (let i = 0; i <= yTickCount; i++) {
      const val = (axisMax / yTickCount) * i;
      if (val === 0) continue;
      yTicks.push({ val, y: getY(val), label: formatBytesRate(val) });
      // Perbaikan: gunakan -val agar string memunculkan tanda minus (-)
      yTicks.push({ val: -val, y: getY(-val), label: formatBytesRate(-val) });
    }
    yTicks.push({ val: 0, y: zeroY, label: "0" });
  } else {
    for (let i = 0; i <= yTickCount; i++) {
      const val = (axisMax / yTickCount) * i;
      yTicks.push({ val, y: getY(val), label: formatBytesRate(val) });
    }
  }

  const xTickCount = width < 600 ? 4 : 8;
  const xTicks = [];
  const step = timeRange / xTickCount;
  for (let i = 0; i <= xTickCount; i++) {
    const ts = startTs + step * i;
    xTicks.push({ ts, x: getX(ts) });
  }

  // Helper format waktu NOC Style (Cerdas / Dinamis)
  const formatXLabel = (ts: number, isLast: boolean) => {
    const date = new Date(ts);
    const rangeHours = timeRange / (1000 * 60 * 60); // Hitung rentang waktu dalam satuan Jam

    if (rangeHours <= 24) {
      // Jika rentang <= 24 Jam: Tampilkan jam (09:00), khusus di paling ujung tampilkan tanggal (25. Feb)
      if (isLast) {
        return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).replace(" ", ". ");
      }
      return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      
    } else if (rangeHours <= 168) { // 168 jam = 7 Hari
      // Jika rentang 2 - 7 Hari: Tampilkan Hari & Tanggal (contoh: Mon 20 Feb)
      return date.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).replace(/,/g, "");
      
    } else if (rangeHours <= 8760) { // 8760 jam = 1 Tahun
      // Jika rentang > 7 Hari sampai 1 Tahun: Tampilkan Tanggal & Bulan (contoh: 20 Feb)
      return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      
    } else {
      // Jika > 1 Tahun: Tampilkan Bulan & Tahun (contoh: Feb 2026)
      return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    }
  };

  return (
    <svg width={width} height={height} style={{ background: "transparent" }}>
      <rect
        x={PAD.left}
        y={PAD.top}
        width={chartW}
        height={chartH}
        fill={THEME.chartBg}
        stroke="none"
      />

      {/* 3. PERBAIKAN RENDER LAYER */}
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
                stroke="rgba(0,0,0,0.15)" // Memberi batas garis tipis antar layer
                strokeWidth={0.5}
                opacity={0.9} // Dibuat solid pekat
              />
              <path
                // PENTING: Flag 'true' untuk membalikkan posisi Y
                d={makeArea(`${iface.id}_out_y0`, `${iface.id}_out_y1`, true)}
                fill={iface.colorOut}
                stroke="rgba(0,0,0,0.15)"
                strokeWidth={0.5}
                opacity={0.9}
              />
            </g>
          );
        }
      })}

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

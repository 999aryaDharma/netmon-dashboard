import React, { useMemo } from "react";
import { Site } from "../../types";

const THEME = {
  chartBg: "#323841",
  gridLine: "rgba(255, 255, 255, 0.15)",
  text: "#c8ced6",
  axisTitle: "#edf1f4",
};

/**
 * Meniru format RRDTool: 
 * - Memberikan spasi antara angka dan unit (misal: "5 M", "2.5 M")
 * - Menghilangkan desimal jika bilangan bulat (misal: "10 M" bukan "10.0 M")
 */
function formatRRDLabel(v: number): string {
  const abs = Math.abs(v);
  if (abs === 0) return "0";
  const sign = v < 0 ? "-" : "";
  
  let val = abs;
  let unit = "";
  if (abs >= 1_000_000_000) { val = abs / 1_000_000_000; unit = "G"; }
  else if (abs >= 1_000_000) { val = abs / 1_000_000; unit = "M"; }
  else if (abs >= 1_000) { val = abs / 1_000; unit = "k"; }
  
  // RRDTool Style: 1 desimal jika bukan bulat (2.5), tanpa desimal jika bulat (5)
  const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1);
  return `${sign}${formatted} ${unit}`.trim();
}

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

  const timeRange = endTs - startTs || 1;
  const getX = (ts: number) => PAD.left + ((ts - startTs) / timeRange) * chartW;

  // Ukuran kotak grid yang diinginkan (dalam pixel) - agar persegi sempurna
  const gridPixelSize = 25;

  // Logika Interval Sumbu Y yang "Cantik" (RRDTool Style) - FIXED STEPS
  const { finalAxisMax, yTicks, getY, zeroY } = useMemo(() => {
    // PAKSA step tetap berdasarkan axisMax untuk konsistensi
    let step: number;
    let finalMax: number;
    
    // Tentukan step berdasarkan axisMax (harus match dengan siteHelpers.ts)
    if (site.axisMax === 1_000_000_000) {
      // Backbone: Step 200 M
      step = 200_000_000;
      finalMax = 1_000_000_000;
    } else if (site.axisMax === 40_000_000) {
      // Integration: Step 8 M
      step = 8_000_000;
      finalMax = 40_000_000;
    } else if (site.axisMax === 6_000_000) {
      // CCTV: Step 1.2 M
      step = 1_200_000;
      finalMax = 6_000_000;
    } else if (site.axisMax === 100_000_000) {
      // Default: Step 20 M
      step = 20_000_000;
      finalMax = 100_000_000;
    } else {
      // Fallback: Gunakan algoritma nice step
      const peak = maxStack * 1.05;
      const targetMax = Math.max(site.axisMax || 0, peak);
      const mag = Math.pow(10, Math.floor(Math.log10(targetMax || 1)));
      const possibleSteps = [
        mag / 10, mag / 5, mag / 4, mag / 2,
        mag, mag * 2, mag * 2.5, mag * 5
      ];
      step = mag;
      for (const s of possibleSteps) {
        const divs = targetMax / s;
        if (divs >= 4 && divs <= 9) {
          step = s;
          break;
        }
      }
      finalMax = Math.ceil(targetMax / step) * step;
    }

    // 5. Setup getY dan zeroY
    let getYFunc: (v: number) => number;
    let zeroYVal: number;
    if (site.type === "traffic") {
      const halfH = chartH / 2;
      zeroYVal = PAD.top + halfH;
      getYFunc = (val: number) => zeroYVal - (val / finalMax) * halfH;
    } else {
      zeroYVal = PAD.top + chartH;
      getYFunc = (val: number) => zeroYVal - (val / finalMax) * chartH;
    }
    
    // 6. Generate Ticks
    const ticks = [];
    for (let v = 0; v <= finalMax; v += step) {
      ticks.push({ val: v, y: getYFunc(v), label: formatRRDLabel(v) });
      if (site.type === "traffic" && v !== 0) {
        // Untuk sumbu negatif (Out)
        ticks.push({ val: -v, y: getYFunc(-v), label: formatRRDLabel(-v) });
      }
    }
    
    return { finalAxisMax: finalMax, yTicks: ticks, getY: getYFunc, zeroY: zeroYVal };
  }, [site.axisMax, maxStack, site.type, chartH]);

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

  const xTickCount = width < 600 ? 3 : 5; // Kurangi ticks agar grid lebih kotak
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
      <defs>
        {/* PATTERN 1: Grid Dasar (Abu-abu tua - Solid & Tipis - Di bawah data) */}
        <pattern 
          id="baseGrid" 
          width={gridPixelSize} 
          height={gridPixelSize} 
          patternUnits="userSpaceOnUse"
        >
          <path 
            d={`M ${gridPixelSize} 0 L 0 0 0 ${gridPixelSize}`} 
            fill="none" 
            stroke="#555555" 
            strokeWidth="0.5"
          />
        </pattern>

        {/* PATTERN 2: Grid Overlay (Abu-abu tua - Dashed/Putus-putus - Di atas data) */}
        <pattern 
          id="dashedGrid" 
          width={gridPixelSize} 
          height={gridPixelSize} 
          patternUnits="userSpaceOnUse"
        >
          <path 
            d={`M ${gridPixelSize} 0 L 0 0 0 ${gridPixelSize}`} 
            fill="none" 
            stroke="#444444" 
            strokeWidth="1"
            strokeDasharray="2,3" // Putus-putus: 2px on, 3px off
          />
        </pattern>
      </defs>

      {/* --- LAYER 1: Plot Area Background --- */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={chartW}
        height={chartH}
        fill={THEME.chartBg}
        stroke="none"
      />

      {/* --- LAYER 2: Grid Dasar (Di bawah data) --- */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={chartW}
        height={chartH}
        fill="url(#baseGrid)"
      />

      {/* --- LAYER 3: Render Data Area (Stacked) --- */}
      {[...site.interfaces].reverse().map((iface) => {
        if (site.type === "latency") {
          return (
            <path
              key={iface.id}
              d={makeArea(`${iface.id}_y0`, `${iface.id}_y1`)}
              fill={iface.colorIn}
              shapeRendering="crispEdges"
              opacity={1}
            />
          );
        } else {
          return (
            <g key={iface.id}>
              <path
                d={makeArea(`${iface.id}_in_y0`, `${iface.id}_in_y1`)}
                fill={iface.colorIn}
                shapeRendering="crispEdges"
                opacity={1}
              />
              <path
                d={makeArea(`${iface.id}_out_y0`, `${iface.id}_out_y1`, true)}
                fill={iface.colorOut}
                shapeRendering="crispEdges"
                opacity={1}
              />
            </g>
          );
        }
      })}

      {/* --- LAYER 4: Grid Overlay (Dashed/Putus-putus di atas data) --- */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={chartW}
        height={chartH}
        fill="url(#dashedGrid)"
        style={{ pointerEvents: 'none' }}
      />

      {/* --- LAYER 5: Zero Line (Garis Tengah) --- */}
      {site.type === "traffic" && (
        <line
          x1={PAD.left}
          y1={zeroY}
          x2={PAD.left + chartW}
          y2={zeroY}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
        />
      )}

      {/* --- LAYER 6: Label Y-Axis --- */}
      {yTicks.map(({ y, label }, i) => (
        <text
          key={`label-y-${i}`}
          x={PAD.left - 10}
          y={y}
          textAnchor="end"
          dominantBaseline="central"
          fill={THEME.text}
          fontSize="10"
          fontFamily="Arial, sans-serif"
        >
          {label}
        </text>
      ))}

      {/* --- LAYER 7: Label X-Axis --- */}
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

      {/* --- LAYER 8: Axis Title --- */}
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

      {/* --- LAYER 9: Border Luar Kotak Grafik --- */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={chartW}
        height={chartH}
        fill="none"
        stroke="#999"
        strokeWidth="1"
      />
    </svg>
  );
}

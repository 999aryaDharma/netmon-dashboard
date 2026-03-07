import React, { useMemo } from "react";
import { Site } from "../../types";

const THEME = {
  chartBg: "#2b2b2b", // Unified gray background (MRTG & Zabbix)
  chartBgBanten: "#2b2b2b", // Same color for consistency
  gridLine: "rgba(255, 255, 255, 0.1)",
  text: "#c8ced6",
  axisTitle: "#edf1f4",
};

/**
 * Meniru format RRDTool:
 * - Memberikan spasi antara angka dan unit (misal: "5 M", "2.5 M")
 * - Menghilangkan desimal jika bilangan bulat (misal: "10 M" bukan "10.0 M")
 * - Menampilkan satuan yang sesuai (bps, kbps, Mbps, Gbps)
 */
function formatRRDLabel(v: number, unit: string = "bps"): string {
  const abs = Math.abs(v);
  if (abs === 0) return `0 ${unit}`;
  const sign = v < 0 ? "-" : "";

  let val = abs;
  let prefix = "";
  if (abs >= 1_000_000_000) {
    val = abs / 1_000_000_000;
    prefix = "G";
  } else if (abs >= 1_000_000) {
    val = abs / 1_000_000;
    prefix = "M";
  } else if (abs >= 1_000) {
    val = abs / 1_000;
    prefix = "k";
  }

  // RRDTool Style: 1 desimal jika bukan bulat (2.5), tanpa desimal jika bulat (5)
  const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1);
  return `${sign}${formatted} ${prefix}${unit}`.trim();
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

  // Traffic = bidirectional (IN atas, OUT bawah), Load = unidirectional (hanya IN dari bawah)
  const isBidirectional = site.graphType === "traffic";

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

  // Grid configuration - berbeda per region
  // Bali (MRTG): persegi 25x25px, Banten (Zabbix): persegi panjang 60x25px
  const isBanten = site.region === "banten";
  const gridWidth = isBanten ? 60 : 25; // Banten: lebih lebar (persegi panjang)
  const gridHeight = isBanten ? 25 : 25; // Bali: persegi sempurna

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
    } else if (site.axisMax === 250_000_000) {
      // ETLE: Step 50 M
      step = 50_000_000;
      finalMax = 250_000_000;
    } else if (site.axisMax === 100_000_000) {
      // Default/Command Center: Step 20 M
      step = 20_000_000;
      finalMax = 100_000_000;
    } else if (site.axisMax === 40_000_000) {
      // Integration: Step 8 M
      step = 8_000_000;
      finalMax = 40_000_000;
    } else if (site.axisMax === 35_000_000) {
      // Integration Bali: Step 7 M
      step = 7_000_000;
      finalMax = 35_000_000;
    } else if (site.axisMax === 6_000_000) {
      // CCTV: Step 1.2 M
      step = 1_200_000;
      finalMax = 6_000_000;
    } else if (site.axisMax === 5_000_000) {
      // OBVIT/Small sites: Step 1 M
      step = 1_000_000;
      finalMax = 5_000_000;
    } else {
      // Fallback: Gunakan algoritma nice step untuk nilai custom
      const peak = maxStack * 1.05;
      const targetMax = Math.max(site.axisMax || 0, peak);
      const mag = Math.pow(10, Math.floor(Math.log10(targetMax || 1)));
      const possibleSteps = [
        mag / 10,
        mag / 5,
        mag / 4,
        mag / 2,
        mag,
        mag * 2,
        mag * 2.5,
        mag * 5,
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
    if (isBidirectional) {
      // Traffic: split axis - IN di atas, OUT di bawah (bidirectional)
      const halfH = chartH / 2;
      zeroYVal = PAD.top + halfH;
      getYFunc = (val: number) => zeroYVal - (val / finalMax) * halfH;
    } else {
      // Load/Ping: semua dari bawah (unidirectional)
      zeroYVal = PAD.top + chartH;
      getYFunc = (val: number) => zeroYVal - (val / finalMax) * chartH;
    }

    // 6. Generate Ticks
    const ticks = [];
    const unit = site.unit || "bps";
    for (let v = 0; v <= finalMax; v += step) {
      ticks.push({ val: v, y: getYFunc(v), label: formatRRDLabel(v, unit) });
      if (isBidirectional && v !== 0) {
        // Untuk sumbu negatif (Out) - hanya untuk traffic bidirectional
        ticks.push({
          val: -v,
          y: getYFunc(-v),
          label: formatRRDLabel(-v, unit),
        });
      }
    }

    return {
      finalAxisMax: finalMax,
      yTicks: ticks,
      getY: getYFunc,
      zeroY: zeroYVal,
    };
  }, [site.axisMax, maxStack, site.type, chartH]);

  // 2. GENERATOR AREA untuk stacked chart
  // invertY=true untuk OUT (digambar ke bawah dari zero line)
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

    // Format yyyy-m-dd
    const yyyy = date.getFullYear();
    const m = date.getMonth() + 1; // 'm' tanpa 0 di depan (1-12)
    const dd = date.getDate().toString().padStart(2, "0"); // 'dd' dengan 0 di depan (01-31)

    // Format jam hh:mm
    const hh = date.getHours().toString().padStart(2, "0");
    const min = date.getMinutes().toString().padStart(2, "0");

    const formattedDate = `${yyyy}-${m}-${dd}`;

    if (rangeHours <= 24) {
      // Jika rentang <= 24 Jam: Tampilkan jam (09:00), di titik terakhir tampilkan tanggal (2026-3-05)
      if (isLast) return formattedDate;
      return `${hh}:${min}`;
    } else if (rangeHours <= 168) {
      // 168 jam = 7 Hari
      // Jika rentang 2 - 7 Hari: Tampilkan Tanggal & Jam (2026-3-05 09:00)
      return `${formattedDate} ${hh}:${min}`;
    } else if (rangeHours <= 8760) {
      // 8760 jam = 1 Tahun
      // Jika rentang > 7 Hari sampai 1 Tahun: Tampilkan Tanggal (2026-3-05)
      return formattedDate;
    } else {
      // Jika > 1 Tahun: Tampilkan Tanggal (2026-3-05)
      return formattedDate;
    }
  };

  const currentBg =
    site.region === "banten" ? THEME.chartBgBanten : THEME.chartBg;

  return (
    <svg width={width} height={height} style={{ background: currentBg }}>
      <defs>
        {/* Universal Arrow Marker - Triangle pointing RIGHT (closed with Z) */}
        {/* orient="auto" will rotate it automatically for Y-axis */}
        <marker
          id="arrowHead"
          markerWidth="4"
          markerHeight="4"
          refX="4"
          refY="2"
          orient="auto"
        >
          <path
            d="M 0 0 L 4 2 L 0 4 Z"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1"
            shapeRendering="crispEdges"
          />
        </marker>

        {/* PATTERN 1: Grid Dasar (Abu-abu tua - Solid & Tipis - Di bawah data) */}
        <pattern
          id="baseGrid"
          width={gridWidth}
          height={gridHeight}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${gridWidth} 0 L 0 0 0 ${gridHeight}`}
            fill="none"
            stroke="#444444"
            strokeWidth="0.5"
          />
        </pattern>

        {/* PATTERN 2: Grid Overlay (Putih - Dashed/Putus-putus - Di atas data) */}
        <pattern
          id="dashedGrid"
          width={gridWidth}
          height={gridHeight}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${gridWidth} 0 L 0 0 0 ${gridHeight}`}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.2"
            strokeDasharray="3,3" // Putus-putus lebih tegas: 3px on, 3px off
          />
        </pattern>
      </defs>

      {/* --- LAYER 1: Plot Area Background --- */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={chartW}
        height={chartH}
        fill={site.region === "banten" ? THEME.chartBgBanten : THEME.chartBg}
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
          // Tentukan apakah OUT dirender ke bawah (MRTG/Bali) atau area tumpuk (Zabbix/Banten)
          const drawOutDownwards = isBidirectional; // isBidirectional = true untuk Bali
          const hasOutData = iface.dataOut && iface.dataOut.length > 0;
          const isBantenZabbix = !isBidirectional && hasOutData; // Banten: unidirectional + ada OUT data
          const opacityValue = isBantenZabbix ? 0.4 : 1; // Opacity rendah untuk Banten (Zabbix style)

          return (
            <g key={iface.id}>
              {/* Render Trafik IN (Selalu Area Filled) */}
              <path
                d={makeArea(`${iface.id}_in_y0`, `${iface.id}_in_y1`)}
                fill={iface.colorIn}
                shapeRendering="crispEdges"
                opacity={opacityValue}
              />

              {/* Render Trafik OUT (Untuk Banten: Area tumpuk di atas, Untuk Bali: Area dibalik ke bawah) */}
              {hasOutData && (
                <path
                  d={makeArea(
                    `${iface.id}_out_y0`,
                    `${iface.id}_out_y1`,
                    drawOutDownwards,
                  )}
                  fill={iface.colorOut}
                  shapeRendering="crispEdges"
                  opacity={opacityValue}
                />
              )}
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
        style={{ pointerEvents: "none" }}
      />

      {/* --- LAYER 5: Zero Line (Garis Tengah) --- */}
      {isBidirectional && (
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

      {/* --- LAYER 8: Axis Lines with Arrows --- */}
      {/* Y-Axis Line (from bottom to top - arrow auto-rotates to point UP) */}
      <line
        x1={PAD.left}
        y1={PAD.top + chartH}
        x2={PAD.left}
        y2={PAD.top - 15}
        stroke="#999"
        strokeWidth="1"
        markerEnd="url(#arrowHead)"
      />

      {/* X-Axis Line (from left to right - arrow points RIGHT) */}
      <line
        x1={PAD.left}
        y1={PAD.top + chartH}
        x2={PAD.left + chartW + 15}
        y2={PAD.top + chartH}
        stroke="#999"
        strokeWidth="1"
        markerEnd="url(#arrowHead)"
      />

      {/* --- LAYER 9: Grid Border (Dashed lines on all sides) --- */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={chartW}
        height={chartH}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.2"
        strokeDasharray="3,3"
      />
    </svg>
  );
}

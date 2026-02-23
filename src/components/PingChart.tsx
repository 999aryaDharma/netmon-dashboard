import React, { useMemo } from "react";
import { Site } from "../types";

const PING_COLORS = {
  rttLine: "#CECECE", // Putih untuk RTT
  rttFill: "rgba(255, 255, 255, 0.2)", // Putih transparan untuk fill RTT
  lossLine: "#CC0000",
};
// ============================================
// NOC THEME COLORS (Observium Style)
// ============================================
const THEME = {
  chartBg: "#323841", // Latar belakang area plot
  gridLine: "rgba(255, 255, 255, 0.15)", // Garis grid tipis
  text: "#c8ced6", // Warna teks standar
  axisTitle: "#e4e8ec", // Warna judul sumbu sedikit lebih terang
};

export function PingChart({
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
  // Padding yang lebih lebar untuk mengakomodasi teks yang diputar
  const PAD = { top: 30, right: 50, bottom: 30, left: 75 };
  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  const iface = site.interfaces[0];
  const dataRtt = iface?.dataRtt || [];
  const dataLoss = iface?.dataLoss || [];

  // Filter data sesuai range waktu
  const rttIn = useMemo(() => {
    return dataRtt.filter(
      (d) => d.timestamp >= startTs && d.timestamp <= endTs,
    );
  }, [dataRtt, startTs, endTs]);

  const lossIn = useMemo(() => {
    return dataLoss.filter(
      (d) => d.timestamp >= startTs && d.timestamp <= endTs,
    );
  }, [dataLoss, startTs, endTs]);

  // Skala X (Waktu)
  const timeRange = endTs - startTs || 1;
  const getX = (ts: number) => PAD.left + ((ts - startTs) / timeRange) * chartW;

  // Skala Y Kiri (RTT - default max 100ms agar grafik terlihat penuh)
  const maxRttVal = Math.max(100, ...rttIn.map((d) => d.value));
  // Tambahkan buffer 10% di atas agar tidak mentok atap
  const axisMaxRtt = maxRttVal * 1.1;
  const getY_Rtt = (val: number) =>
    PAD.top + chartH - (val / axisMaxRtt) * chartH;

  // Skala Y Kanan (Loss - Fixed 0-100%)
  const getY_Loss = (val: number) => PAD.top + chartH - (val / 100) * chartH;

  // --- Path Generator ---
  const makePath = (
    data: { timestamp: number; value: number }[],
    getY: (v: number) => number,
  ) => {
    if (data.length < 2) return "";
    let d = `M ${getX(data[0].timestamp)} ${getY(data[0].value)}`;
    for (let i = 1; i < data.length; i++) {
      d += ` L ${getX(data[i].timestamp)} ${getY(data[i].value)}`;
    }
    return d;
  };

  const pathRtt = makePath(rttIn, getY_Rtt);
  const pathLoss = makePath(lossIn, getY_Loss);

  // --- Ticks Generator ---
  // Y Ticks (RTT Kiri) - Buat 5 level
  const yTicksRtt = [];
  for (let i = 0; i <= 5; i++) {
    const val = (axisMaxRtt / 5) * i;
    const y = getY_Rtt(val);
    yTicksRtt.push({ val, y });
  }

  // Y Ticks (Loss Kanan) - Fixed 0, 25, 50, 75, 100
  const yTicksLoss = [0, 25, 50, 75, 100].map((val) => ({
    val,
    y: getY_Loss(val),
  }));

  // X Ticks (Waktu) - Targetkan sekitar 8-10 ticks
  const xTickCount = width < 600 ? 4 : 8;
  const xTicks = [];
  const step = timeRange / xTickCount;
  for (let i = 0; i <= xTickCount; i++) {
    const ts = startTs + step * i;
    xTicks.push({ ts, x: getX(ts) });
  }

  // Helper format waktu NOC Style (HH:mm untuk tengah, DD. Mon untuk akhir)
  const formatXLabel = (ts: number, isLast: boolean) => {
    const date = new Date(ts);
    if (isLast) {
      // Format: 26. Jun
      return date
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        .replace(" ", ". ");
    }
    // Format: 09:00
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    // Ubah background SVG utama agar menyatu dengan modal
    <svg width={width} height={height} style={{ background: "transparent" }}>
      {/* Area Plot Latar Belakang (Warna Dark Blue/Grey khas RRDTool) */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={chartW}
        height={chartH}
        fill={THEME.chartBg}
        stroke="none"
      />

      {/* Grid Lines Horizontal & Label Y Kiri (RTT) */}
      {yTicksRtt.map(({ val, y }, i) => (
        <g key={`rtt-${i}`}>
          {/* Garis Grid Halus */}
          <line
            x1={PAD.left}
            y1={y}
            x2={PAD.left + chartW}
            y2={y}
            stroke={THEME.gridLine}
            strokeWidth={1}
          />
          {/* Label Angka Kiri */}
          <text
            x={PAD.left - 8}
            y={y + 4}
            textAnchor="end"
            fill={THEME.text}
            fontSize="10"
            fontFamily="Arial, sans-serif"
          >
            {val.toFixed(0)}
          </text>
        </g>
      ))}

      {/* Label Y Kanan (Loss) */}
      {yTicksLoss.map(({ val, y }, i) => (
        <text
          key={`loss-${i}`}
          x={PAD.left + chartW + 8}
          y={y + 4}
          textAnchor="start"
          fill={THEME.text}
          fontSize="10"
          fontFamily="Arial, sans-serif"
        >
          {val.toFixed(0)}
        </text>
      ))}

      {/* X-Axis Ticks & Labels */}
      {xTicks.map(({ ts, x }, i) => {
        const isLast = i === xTicks.length - 1;
        return (
          <g key={i}>
            {/* Tick mark kecil di bawah */}
            <line
              x1={x}
              y1={PAD.top + chartH}
              x2={x}
              y2={PAD.top + chartH + 5}
              stroke={THEME.gridLine}
              strokeWidth={1}
            />
            {/* Label Waktu */}
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

      {/* --- Judul Sumbu Y di Ujung Atas --- */}

      {/* Judul Kiri: Latency (ms) */}
      <text
        x={PAD.left - 8}
        y={PAD.top - 14}
        textAnchor="end"
        fill={THEME.axisTitle}
        fontSize="10"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        Latency (ms)
      </text>

      {/* Judul Kanan: Loss (%) */}
      <text
        x={width - PAD.right + 8}
        y={PAD.top - 14}
        textAnchor="start"
        fill={THEME.axisTitle}
        fontSize="10"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        Loss (%)
      </text>

      {/* --- Data Lines --- */}
      {/* Garis Loss (Merah) */}
      <path
        d={pathLoss}
        fill="none"
        stroke={PING_COLORS.lossLine}
        strokeWidth={2}
        opacity={0.8}
      />
      {/* Garis RTT (Hijau - di atas merah) */}
      <path
        d={pathRtt}
        fill="none"
        stroke={PING_COLORS.rttLine}
        strokeWidth={2}
      />

      {/* Border Kotak Luar Grafik */}
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

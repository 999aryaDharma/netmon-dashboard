import React, { useMemo } from "react";
import { Site } from "../../types";

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

// Algoritma NOC: Membulatkan sumbu Y ke angka bulat terdekat yang "cantik"
function getNiceAxisMax(rawMax: number): number {
  if (rawMax <= 0) return 100;
  
  // Cari besaran skala (Misal: 10, 100, 1000, 1 Juta)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const normalized = rawMax / magnitude;
  
  // Paksa angka keriting ke titik henti yang solid
  let nice: number;
  if (normalized <= 1.0) nice = 1.0;
  else if (normalized <= 1.2) nice = 1.2;
  else if (normalized <= 1.5) nice = 1.5;
  else if (normalized <= 2.0) nice = 2.0;
  else if (normalized <= 2.5) nice = 2.5;
  else if (normalized <= 3.0) nice = 3.0;
  else if (normalized <= 4.0) nice = 4.0;
  else if (normalized <= 5.0) nice = 5.0;
  else if (normalized <= 6.0) nice = 6.0;
  else if (normalized <= 8.0) nice = 8.0;
  else nice = 10.0;
  
  return nice * magnitude;
}

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
  const PAD = { top: 55, right: 60, bottom: 30, left: 75 };
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
  const rawMax = maxRttVal * 1.1;
  // Bulatkan ke nilai "cantik" terdekat
  const axisMaxRtt = getNiceAxisMax(rawMax);
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
  // Y Ticks (RTT Kiri) - Buat 5 level dengan label "ms"
  const yTicksRtt = [];
  for (let i = 0; i <= 5; i++) {
    const val = (axisMaxRtt / 5) * i;
    const y = getY_Rtt(val);
    yTicksRtt.push({ val, y, label: `${val} ms` });
  }

  // Y Ticks (Loss Kanan) - Fixed 0, 25, 50, 75, 100 dengan label "%"
  const yTicksLoss = [0, 25, 50, 75, 100].map((val) => ({
    val,
    y: getY_Loss(val),
    label: `${val}%`,
  }));

  // X Ticks (Waktu) - Targetkan sekitar 8-10 ticks
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

    } else if (rangeHours <= 168) { // 168 jam = 7 Hari
      // Jika rentang 2 - 7 Hari: Tampilkan Tanggal & Jam (2026-3-05 09:00)
      return `${formattedDate} ${hh}:${min}`;

    } else if (rangeHours <= 8760) { // 8760 jam = 1 Tahun
      // Jika rentang > 7 Hari sampai 1 Tahun: Tampilkan Tanggal (2026-3-05)
      return formattedDate;

    } else {
      // Jika > 1 Tahun: Tampilkan Tanggal (2026-3-05)
      return formattedDate;
    }
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
      {yTicksRtt.map(({ val, y, label }, i) => (
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
            {label}
          </text>
        </g>
      ))}

      {/* Label Y Kanan (Loss) */}
      {yTicksLoss.map(({ val, y, label }, i) => (
        <text
          key={`loss-${i}`}
          x={PAD.left + chartW + 8}
          y={y + 4}
          textAnchor="start"
          fill={THEME.text}
          fontSize="10"
          fontFamily="Arial, sans-serif"
        >
          {label}
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
        y={PAD.top - 10}
        width={chartW}
        height={chartH}
        fill="none"
        stroke={THEME.gridLine}
        strokeWidth={1}
      />
    </svg>
  );
}

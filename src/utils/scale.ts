// Scaling utilities untuk konversi data ke koordinat SVG

export interface Point {
  x: number;
  y: number;
}

/**
 * Scale data numerik ke koordinat SVG
 * @param data - Array data numerik
 * @param width - Lebar canvas SVG
 * @param height - Tinggi canvas SVG
 * @param maxValue - Nilai maksimum untuk scaling
 * @param invert - Jika true, Y dibalik (untuk grafik bidirectional)
 */
export function scaleToPoints(
  data: number[],
  width: number,
  height: number,
  maxValue: number,
  invert = false
): Point[] {
  const stepX = width / (data.length - 1 || 1);

  return data.map((v, i) => {
    const x = i * stepX;
    const yRatio = Math.min(1, v / maxValue);
    const y = invert
      ? height / 2 + yRatio * (height / 2)
      : height / 2 - yRatio * (height / 2);

    return { x, y };
  });
}

/**
 * Scale data dengan padding dan margin untuk chart lengkap
 */
export function scaleToPointsWithPadding(
  data: (number | null)[],
  width: number,
  height: number,
  maxValue: number,
  padding: { top: number; right: number; bottom: number; left: number },
  invert = false
): Point[] {
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const stepX = chartW / (data.length - 1 || 1);

  return data.map((v, i) => {
    const x = padding.left + i * stepX;
    const value = v ?? 0;
    const yRatio = Math.min(1, value / maxValue);
    const baseY = invert ? padding.top + chartH / 2 : padding.top + chartH / 2;
    const offset = yRatio * (chartH / 2);
    const y = invert ? baseY + offset : baseY - offset;

    return { x, y };
  });
}

/**
 * Hitung nilai maksimum yang "bagus" untuk axis (round number)
 */
export function niceMax(max: number): number {
  if (max <= 0) return 10;

  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;

  let nice: number;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;

  return nice * magnitude;
}

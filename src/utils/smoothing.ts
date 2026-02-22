// Smoothing functions untuk grafik yang lebih realistis

/**
 * Moving average sederhana
 * @param data - Array data numerik
 * @param window - Jumlah titik di setiap sisi (total window = 2*window+1)
 */
export function movingAverage(data: number[], window = 5): number[] {
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;

    for (let j = -window; j <= window; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < data.length) {
        sum += data[idx];
        count++;
      }
    }

    result.push(sum / count);
  }

  return result;
}

/**
 * Exponential moving average (EMA)
 * Lebih responsif terhadap perubahan terbaru
 */
export function exponentialMovingAverage(
  data: number[],
  alpha = 0.3
): number[] {
  if (data.length === 0) return [];

  const result: number[] = [data[0]];

  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }

  return result;
}

/**
 * Gaussian smoothing untuk hasil yang lebih halus
 * Menggunakan kernel Gaussian
 */
export function gaussianSmooth(data: number[], sigma = 2): number[] {
  const kernelSize = Math.ceil(sigma * 6);
  const kernel: number[] = [];
  let sum = 0;

  // Buat Gaussian kernel
  for (let i = -kernelSize; i <= kernelSize; i++) {
    const value = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(value);
    sum += value;
  }

  // Normalisasi kernel
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }

  // Apply convolution
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    let value = 0;

    for (let j = 0; j < kernel.length; j++) {
      const idx = i + j - kernelSize;
      if (idx >= 0 && idx < data.length) {
        value += data[idx] * kernel[j];
      }
    }

    result.push(value);
  }

  return result;
}

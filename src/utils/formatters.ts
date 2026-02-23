// Formatter functions untuk display data

export function formatRate(v: number | null): string {
  if (v === null || isNaN(v)) return "  -nan bps";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2).padStart(6, " ")}Mbps`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2).padStart(6, " ")}kbps`;
  return `${v.toFixed(2).padStart(6, " ")} bps`;
}

export function formatVol(avgBps: number | null): string {
  if (avgBps === null || isNaN(avgBps)) return "  -nan B";
  const durationSeconds = 86400; // Default 24h
  const totalBytes = (avgBps * durationSeconds) / 8;
  if (totalBytes >= 1_099_511_627_776) return `${(totalBytes / 1_099_511_627_776).toFixed(2).padStart(6, " ")}TB`;
  if (totalBytes >= 1_073_741_824) return `${(totalBytes / 1_073_741_824).toFixed(2).padStart(6, " ")}GB`;
  if (totalBytes >= 1_048_576) return `${(totalBytes / 1_048_576).toFixed(2).padStart(6, " ")}MB`;
  if (totalBytes >= 1_024) return `${(totalBytes / 1_024).toFixed(2).padStart(6, " ")}KB`;
  return `${totalBytes.toFixed(2).padStart(6, " ")}B`;
}

export function formatRtt(v: number | null): string {
  if (v === null || isNaN(v) || v === 0) return "   0.00 ms";
  if (v >= 1000) return `${(v / 1000).toFixed(2).padStart(6, " ")}s`;
  return `${v.toFixed(2).padStart(6, " ")}ms`;
}

export function formatLoss(v: number | null): string {
  if (v === null || isNaN(v) || v === 0) return "   0.00 %";
  return `${v.toFixed(2).padStart(6, " ")} %`;
}

export function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatTimestampToLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

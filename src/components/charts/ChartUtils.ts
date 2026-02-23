// Chart utilities dan constants yang bisa dipakai berulang

export const CHART_THEME = {
  chartBg: "#333333",
  gridLine: "rgba(120,140,170,0.18)",
  text: "#9fb3c8",
  axisTitle: "#9fb3c8",
};

export const NOC_TIME_FORMAT = {
  locale: "en-GB",
  timeOptions: { hour: "2-digit", minute: "2-digit" } as Intl.DateTimeFormatOptions,
  dateOptions: { day: "2-digit", month: "short" } as Intl.DateTimeFormatOptions,
};

export function formatNocTimeLabel(ts: number, isLast: boolean): string {
  const date = new Date(ts);
  if (isLast) {
    return date
      .toLocaleDateString(NOC_TIME_FORMAT.locale, NOC_TIME_FORMAT.dateOptions)
      .replace(" ", ". ");
  }
  return date.toLocaleTimeString(NOC_TIME_FORMAT.locale, NOC_TIME_FORMAT.timeOptions);
}

export function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

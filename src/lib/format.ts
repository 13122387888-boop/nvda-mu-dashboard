const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function money(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : `$${numberFormat.format(value)}`;
}

export function number(value: number | null, digits = 2): string {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

export function percent(value: number | null, alreadyPercent = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(alreadyPercent ? value : value * 100).toFixed(2)}%`;
}

export const STATUS_LABELS: Record<string, string> = {
  STRONG_BULLISH: "Strong Bullish",
  BULLISH: "Bullish",
  NEUTRAL: "Neutral",
  BEARISH: "Bearish",
  INSUFFICIENT_DATA: "Insufficient Data",
};

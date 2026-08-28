import type { IntradayBarRecord } from "@/lib/providers/types";

export type VolumeProfileBin = {
  low: number;
  high: number;
  price: number;
  volume: number;
  volumePct: number;
  inValueArea: boolean;
};

export type VolumeProfile = {
  status: "AVAILABLE" | "UNAVAILABLE";
  bins: VolumeProfileBin[];
  pointOfControl: number | null;
  valueAreaHigh: number | null;
  valueAreaLow: number | null;
  sampleStart: string | null;
  sampleEnd: string | null;
  sessionCount: number;
  barCount: number;
  barSize: "1分钟";
};

export function calculateVolumeProfile(input: IntradayBarRecord[], binCount = 24): VolumeProfile {
  const valid = input.filter((bar) => bar.volume > 0 && bar.high >= bar.low && Number.isFinite(bar.close));
  if (!valid.length) return { status: "UNAVAILABLE", bins: [], pointOfControl: null, valueAreaHigh: null, valueAreaLow: null, sampleStart: null, sampleEnd: null, sessionCount: 0, barCount: 0, barSize: "1分钟" };

  const dates = [...new Set(valid.map((bar) => bar.tradeDate))].sort();
  const selectedDates = new Set(dates.slice(-20));
  const bars = valid.filter((bar) => selectedDates.has(bar.tradeDate));
  const minimum = Math.min(...bars.map((bar) => bar.low));
  const maximum = Math.max(...bars.map((bar) => bar.high));
  const width = Math.max((maximum - minimum) / Math.max(binCount, 1), Math.max(maximum, 1) * 0.0001);
  const volumes = Array.from({ length: binCount }, () => 0);

  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    const index = Math.min(binCount - 1, Math.max(0, Math.floor((typicalPrice - minimum) / width)));
    volumes[index] += bar.volume;
  }

  const totalVolume = volumes.reduce((sum, volume) => sum + volume, 0);
  const pocIndex = volumes.reduce((best, volume, index) => volume > volumes[best] ? index : best, 0);
  const valueArea = new Set([pocIndex]);
  let accumulated = volumes[pocIndex];
  let lower = pocIndex - 1;
  let upper = pocIndex + 1;
  while (accumulated < totalVolume * 0.7 && (lower >= 0 || upper < volumes.length)) {
    const lowerVolume = lower >= 0 ? volumes[lower] : -1;
    const upperVolume = upper < volumes.length ? volumes[upper] : -1;
    const next = upperVolume > lowerVolume ? upper++ : lower--;
    valueArea.add(next);
    accumulated += volumes[next];
  }

  const bins = volumes.map((volume, index) => ({
    low: minimum + index * width,
    high: index === binCount - 1 ? maximum : minimum + (index + 1) * width,
    price: minimum + (index + 0.5) * width,
    volume,
    volumePct: totalVolume ? volume / totalVolume : 0,
    inValueArea: valueArea.has(index),
  }));
  const valueIndices = [...valueArea].sort((a, b) => a - b);
  return {
    status: "AVAILABLE",
    bins,
    pointOfControl: bins[pocIndex].price,
    valueAreaHigh: bins[valueIndices.at(-1)!].high,
    valueAreaLow: bins[valueIndices[0]].low,
    sampleStart: [...selectedDates][0] ?? null,
    sampleEnd: [...selectedDates].at(-1) ?? null,
    sessionCount: selectedDates.size,
    barCount: bars.length,
    barSize: "1分钟",
  };
}

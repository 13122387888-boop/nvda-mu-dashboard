export function simpleMovingAverage(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const window = values.slice(-period);
  return window.reduce((sum, value) => sum + value, 0) / period;
}

export function movingAverageSeries(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => simpleMovingAverage(values.slice(0, index + 1), period));
}

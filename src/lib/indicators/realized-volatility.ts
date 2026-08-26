export function realizedVolatility(values: number[], period = 20): number | null {
  if (period <= 1 || values.length < period + 1 || values.some((value) => value <= 0)) return null;
  const window = values.slice(-(period + 1));
  const returns = window.slice(1).map((value, index) => Math.log(value / window[index]));
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

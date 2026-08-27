export const STOCKS = {
  NVDA: { name: "英伟达 NVIDIA", shortName: "英伟达", accent: "#76b900" },
  MU: { name: "美光科技 Micron", shortName: "美光", accent: "#4f8cff" },
  SNDK: { name: "闪迪 SanDisk", shortName: "闪迪", accent: "#f15a3a" },
  MSFT: { name: "微软 Microsoft", shortName: "微软", accent: "#00a4ef" },
  TSLA: { name: "特斯拉 Tesla", shortName: "特斯拉", accent: "#e82127" },
  DRAM: { name: "Roundhill 内存主题 ETF", shortName: "内存 ETF", accent: "#b47cff" },
  SOXX: { name: "iShares 半导体 ETF", shortName: "半导体 ETF", accent: "#2f7cf6" },
} as const;

export type SupportedSymbol = keyof typeof STOCKS;

// Verified first trading dates for recently launched securities. This prevents
// providers that reject pre-inception ranges from discarding the valid tail.
export const STOCK_HISTORY_START_DATES: Partial<Record<SupportedSymbol, string>> = {
  DRAM: "2026-04-02",
};

export const SUPPORTED_SYMBOLS = Object.keys(STOCKS) as SupportedSymbol[];

export function isSupportedSymbol(value: string): value is SupportedSymbol {
  return Object.hasOwn(STOCKS, value);
}

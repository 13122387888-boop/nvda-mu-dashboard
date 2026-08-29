export const STOCKS = {
  NVDA: { name: "英伟达 NVIDIA", shortName: "英伟达", accent: "#76b900", assetType: "STOCK" },
  MU: { name: "美光科技 Micron", shortName: "美光", accent: "#4f8cff", assetType: "STOCK" },
  SNDK: { name: "闪迪 SanDisk", shortName: "闪迪", accent: "#f15a3a", assetType: "STOCK" },
  MSFT: { name: "微软 Microsoft", shortName: "微软", accent: "#00a4ef", assetType: "STOCK" },
  TSLA: { name: "特斯拉 Tesla", shortName: "特斯拉", accent: "#e82127", assetType: "STOCK" },
  DRAM: { name: "Roundhill 内存主题 ETF", shortName: "内存 ETF", accent: "#b47cff", assetType: "ETF" },
  SOXX: { name: "iShares 半导体 ETF", shortName: "半导体 ETF", accent: "#2f7cf6", assetType: "ETF" },
  QQQ: { name: "Invesco 纳斯达克 100 ETF", shortName: "纳指 100 ETF", accent: "#9b6cff", assetType: "ETF" },
  IBIT: { name: "iShares 比特币信托 ETF", shortName: "比特币 ETF", accent: "#f3a53a", assetType: "ETF" },
  SKHY: { name: "SK海力士 SK Hynix", shortName: "SK海力士", accent: "#ef4b3f", assetType: "STOCK" },
  TSM: { name: "台积电 TSMC", shortName: "台积电", accent: "#d7262f", assetType: "STOCK" },
  AAPL: { name: "苹果 Apple", shortName: "苹果", accent: "#aeb8c4", assetType: "STOCK" },
  AVGO: { name: "博通 Broadcom", shortName: "博通", accent: "#cc2340", assetType: "STOCK" },
  ORCL: { name: "甲骨文 Oracle", shortName: "甲骨文", accent: "#f04b42", assetType: "STOCK" },
  GLD: { name: "SPDR 黄金 ETF", shortName: "黄金 ETF", accent: "#d6ad3c", assetType: "ETF" },
  XLF: { name: "金融精选行业 SPDR ETF", shortName: "金融 ETF", accent: "#4c8fd8", assetType: "ETF" },
  XLE: { name: "能源精选行业 SPDR ETF", shortName: "能源 ETF", accent: "#ee9d36", assetType: "ETF" },
  XLU: { name: "公用事业精选行业 SPDR ETF", shortName: "公用事业 ETF", accent: "#42b9bc", assetType: "ETF" },
  XLV: { name: "医疗保健精选行业 SPDR ETF", shortName: "医疗 ETF", accent: "#68bf83", assetType: "ETF" },
} as const;

export type SupportedSymbol = keyof typeof STOCKS;

// Verified first trading dates for recently launched securities. This prevents
// providers that reject pre-inception ranges from discarding the valid tail.
export const STOCK_HISTORY_START_DATES: Partial<Record<SupportedSymbol, string>> = {
  DRAM: "2026-04-02",
  SKHY: "2026-07-10",
};

export const SUPPORTED_SYMBOLS = Object.keys(STOCKS) as SupportedSymbol[];

export function isSupportedSymbol(value: string): value is SupportedSymbol {
  return Object.hasOwn(STOCKS, value);
}

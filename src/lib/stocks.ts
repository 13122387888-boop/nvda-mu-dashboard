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
  MVRL: { name: "ETRACS 1.5倍房贷 REIT ETN", shortName: "房贷 REIT ETN", accent: "#8b74d6", assetType: "ETF" },
  SPCX: { name: "SpaceX", shortName: "SpaceX", accent: "#d9dde3", assetType: "STOCK" },
  CRCL: { name: "Circle", shortName: "Circle", accent: "#2775ca", assetType: "STOCK" },
  INTC: { name: "英特尔 Intel", shortName: "英特尔", accent: "#0071c5", assetType: "STOCK" },
  GOOG: { name: "谷歌 Alphabet C", shortName: "谷歌 C", accent: "#4285f4", assetType: "STOCK" },
  AMD: { name: "超威半导体 AMD", shortName: "AMD", accent: "#ed1c24", assetType: "STOCK" },
  IGV: { name: "iShares 软件行业 ETF", shortName: "软件 ETF", accent: "#7c8fe8", assetType: "ETF" },
  UVIX: { name: "2倍做多 VIX 期货 ETF", shortName: "VIX 2倍 ETF", accent: "#b86bff", assetType: "ETF" },
  META: { name: "Meta Platforms", shortName: "Meta", accent: "#1877f2", assetType: "STOCK" },
  AMZN: { name: "亚马逊 Amazon", shortName: "亚马逊", accent: "#ff9900", assetType: "STOCK" },
  ASML: { name: "阿斯麦 ASML", shortName: "阿斯麦", accent: "#00a3e0", assetType: "STOCK" },
  WDC: { name: "西部数据 Western Digital", shortName: "西部数据", accent: "#005195", assetType: "STOCK" },
  STX: { name: "希捷科技 Seagate", shortName: "希捷", accent: "#6ebe44", assetType: "STOCK" },
  PLTR: { name: "Palantir Technologies", shortName: "Palantir", accent: "#c4cad2", assetType: "STOCK" },
  XBI: { name: "SPDR 标普生物科技 ETF", shortName: "生物科技 ETF", accent: "#00a6a6", assetType: "ETF" },
  "BRK.B": { name: "伯克希尔哈撒韦 B", shortName: "伯克希尔 B", accent: "#5476a6", assetType: "STOCK" },
  LLY: { name: "礼来 Eli Lilly", shortName: "礼来", accent: "#d52b1e", assetType: "STOCK" },
  GLW: { name: "康宁 Corning", shortName: "康宁", accent: "#3d6fb4", assetType: "STOCK" },
  COHR: { name: "相干公司 Coherent", shortName: "Coherent", accent: "#f05a28", assetType: "STOCK" },
  AAOI: { name: "应用光电 Applied Optoelectronics", shortName: "应用光电", accent: "#00a7b5", assetType: "STOCK" },
  LITE: { name: "Lumentum Holdings", shortName: "Lumentum", accent: "#7a5cff", assetType: "STOCK" },
  BE: { name: "布鲁姆能源 Bloom Energy", shortName: "布鲁姆能源", accent: "#35b56a", assetType: "STOCK" },
} as const;

export type SupportedSymbol = keyof typeof STOCKS;

// Verified first trading dates for recently launched securities. This prevents
// providers that reject pre-inception ranges from discarding the valid tail.
export const STOCK_HISTORY_START_DATES: Partial<Record<SupportedSymbol, string>> = {
  DRAM: "2026-04-02",
  SKHY: "2026-07-10",
  SPCX: "2026-06-12",
  CRCL: "2025-06-05",
};

export const SUPPORTED_SYMBOLS = Object.keys(STOCKS) as SupportedSymbol[];

// MVRL is a listed ETN, but neither the primary provider nor Longbridge currently
// reports a listed option chain for it. Treat it as stock-data-only so the daily
// sync does not mislabel a market-coverage limitation as a failed fetch.
export const NON_OPTION_SYMBOLS = ["MVRL"] as const satisfies readonly SupportedSymbol[];
export const LIMITED_STOCK_SOURCE_SYMBOLS = ["MVRL"] as const satisfies readonly SupportedSymbol[];
export const OPTION_SUPPORTED_SYMBOLS = SUPPORTED_SYMBOLS.filter(
  (symbol) => !(NON_OPTION_SYMBOLS as readonly SupportedSymbol[]).includes(symbol),
);

export function isSupportedSymbol(value: string): value is SupportedSymbol {
  return Object.hasOwn(STOCKS, value);
}

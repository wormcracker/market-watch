export interface StockEntry {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  pointChange: number;
  percentChange: number;
  updatedAt: number;
}

export interface Position {
  symbol: string;
  qty: number;
  avgBuy: number;
  invested: number;
  ltp: number;
  chgPct: number;
  high: number;
  low: number;
  currentVal: number;
  netPL: number;
  plPct: number;
}

export interface CapitalSummary {
  totalCapitalAdded: number;
  totalRetained: number;
  deployedCapital: number;
  realizedPL: number;
  actualCapital: number;
  tradingCapital: number;
  reservedCapital: number;
  maxPerStock: number;
  availableCapital: number;
  additions: CapitalEntry[];
  retentions: CapitalEntry[];
}

export interface CapitalEntry {
  date: string;
  amount: number;
  notes: string;
}

export interface Trade {
  tradeId: string;
  date: string;
  dateStr: string;
  symbol: string;
  type: "buy" | "sell";
  qty: number;
  buyWacc: number;
  totalBuy: number;
  sellPrice: number;
  totalSell: number;
  holdingDays: number;
  commission: number;
  profitTax: number;
  netPl: number;
  plPct: number;
  remarks: string;
}

export interface WatchlistEntry {
  symbol: string;
  cap: string;
  watch: boolean;
  remark: string;
  targetCap: number;
  ltp: number;
  chgPct: number;
  high: number;
  low: number;
  inPortfolio: boolean;
  heldQty: number;
}

export interface SummaryData {
  filter: string;
  buyCount: number;
  buyQty: number;
  buyTurnover: number;
  sellCount: number;
  sellQty: number;
  sellTurnover: number;
  profit: number;
  plPct: number;
  commissionPaid: number;
  cgtPaid: number;
  leftAmt: number;
  allTimeProfit: number;
  allTimePLPct: number;
  avgHoldDays: number;
  caagr: number;
  firstTradeDate: string;
  lastTradeDate: string;
}

export interface Watch {
  id: string;
  name: string;
  enabled: boolean;
  engine: "nepse" | "http";
  symbol?: string;
  conditionLabel: string;
  lastCheckedAt: string | null;
  lastAlertAt: string | null;
  createdAt: string;
}

export interface Alert {
  id: string;
  watchName: string;
  conditionLabel: string;
  value: string;
  firedAt: string;
  read: boolean;
}

export interface LtpEntry {
  symbol: string;
  ltp: number;
  chgPct?: number;
  open?: number;
  high?: number;
  low?: number;
}

export type TradeType = "buy" | "sell";

export type TradeRow = {
  tradeId: string;
  date: Date | null;
  dateStr: string;
  symbol: string;
  type: TradeType;
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
};

export type LtpSource = "nepse-ws" | "csv";

export type Position = {
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
  source: LtpSource | null;
  fetchedAt: string | null;
};

export type PositionResult = {
  positions: Position[];
  totals: {
    invested: number;
    currentVal: number;
    netPL: number;
    plPct: number;
    count: number;
  };
};

export type LtpEntry = {
  ltp: number;
  chgPct: number;
  open: number;
  high: number;
  low: number;
  qty: number;
  prevClose?: number;
  pointChange?: number | null;
  source: LtpSource;
  fetchedAt: string;
};

export type LtpMap = Record<string, LtpEntry>;

export type CommissionBreakdown = {
  total: number;
  brokerFee: number;
  sebonFee: number;
  sebonDP: number;
};

export type StockRow = {
  rowIndex: number;
  num: string | number;
  symbol: string;
  cap: string;
  watch: boolean;
  remark: string;
  targetCap: number;
  slTp: string;
  message: string;
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type CapitalEntry = {
  date: string;
  amount: number;
  notes: string;
};

export type LockInEntry = {
  lockInDate: string;
  unlockIn: string;
  isLocked: boolean;
  daysRemaining: number | null;
};

export type LockInMap = Record<string, LockInEntry>;

export type TradeInput = {
  symbol: string;
  type: TradeType;
  qty: number;
  price: number;
  remarks?: string;
  dateStr?: string;
};

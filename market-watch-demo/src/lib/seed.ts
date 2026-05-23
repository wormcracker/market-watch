import type {
  StockEntry, Position, Trade, WatchlistEntry,
  CapitalSummary, SummaryData, Watch, Alert,
} from "./types";

// ─── Market snapshot seed ────────────────────────────────────────────────────
export const SEED_STOCKS: Record<string, StockEntry> = {
  NABIL: { symbol:"NABIL", ltp:530, open:529, high:530.8, low:527.9, volume:42686, pointChange:2.1, percentChange:0.4, updatedAt:Date.now() },
  NIMB:  { symbol:"NIMB",  ltp:198, open:195.5, high:198, low:194, volume:92849, pointChange:2.5, percentChange:1.28, updatedAt:Date.now() },
  SCB:   { symbol:"SCB",   ltp:653.2, open:653.5, high:660, low:648, volume:5706, pointChange:3.2, percentChange:0.49, updatedAt:Date.now() },
  HBL:   { symbol:"HBL",   ltp:203, open:204.8, high:206, low:200, volume:68976, pointChange:-1.8, percentChange:-0.88, updatedAt:Date.now() },
  SBI:   { symbol:"SBI",   ltp:405, open:395, high:405, low:393, volume:47425, pointChange:6.5, percentChange:1.63, updatedAt:Date.now() },
  EBL:   { symbol:"EBL",   ltp:710, open:705, high:712, low:705, volume:13673, pointChange:0.2, percentChange:0.03, updatedAt:Date.now() },
  NICA:  { symbol:"NICA",  ltp:352.5, open:353, high:353, low:346, volume:58510, pointChange:1.0, percentChange:0.28, updatedAt:Date.now() },
  MBL:   { symbol:"MBL",   ltp:252.9, open:253, high:253, low:248.1, volume:87023, pointChange:1.9, percentChange:0.76, updatedAt:Date.now() },
  LSL:   { symbol:"LSL",   ltp:225.9, open:223, high:226.3, low:222, volume:120134, pointChange:2.9, percentChange:1.30, updatedAt:Date.now() },
  KBL:   { symbol:"KBL",   ltp:218.7, open:222, high:222, low:215.5, volume:119765, pointChange:2.0, percentChange:0.92, updatedAt:Date.now() },
  SBL:   { symbol:"SBL",   ltp:400.9, open:396, high:400.9, low:396, volume:64525, pointChange:4.9, percentChange:1.24, updatedAt:Date.now() },
  SANIMA:{ symbol:"SANIMA",ltp:365.5, open:364.4, high:365.5, low:360.1, volume:52060, pointChange:3.3, percentChange:0.91, updatedAt:Date.now() },
  NHPC:  { symbol:"NHPC",  ltp:295, open:289, high:297.6, low:286, volume:550729, pointChange:6.5, percentChange:2.25, updatedAt:Date.now() },
  BPCL:  { symbol:"BPCL",  ltp:699, open:695.1, high:705, low:695.1, volume:44960, pointChange:-2.8, percentChange:-0.40, updatedAt:Date.now() },
  CHCL:  { symbol:"CHCL",  ltp:482, open:477.6, high:482, low:477.6, volume:9620, pointChange:3.0, percentChange:0.63, updatedAt:Date.now() },
  NICL:  { symbol:"NICL",  ltp:497, open:490.2, high:497, low:486.2, volume:7161, pointChange:5.0, percentChange:1.02, updatedAt:Date.now() },
  NLICL: { symbol:"NLICL", ltp:591, open:596, high:596, low:585, volume:3932, pointChange:1.2, percentChange:0.20, updatedAt:Date.now() },
  CBBL:  { symbol:"CBBL",  ltp:917, open:915, high:918, low:910, volume:6793, pointChange:2.0, percentChange:0.22, updatedAt:Date.now() },
  NUBL:  { symbol:"NUBL",  ltp:660, open:645, high:660, low:645, volume:3011, pointChange:9.7, percentChange:1.49, updatedAt:Date.now() },
  RBCL:  { symbol:"RBCL",  ltp:14931, open:15000, high:15000, low:14915.1, volume:135, pointChange:-69, percentChange:-0.46, updatedAt:Date.now() },
};

// ─── Positions seed ──────────────────────────────────────────────────────────
export const SEED_POSITIONS: Position[] = [
  { symbol:"NABIL", qty:50,  avgBuy:490, invested:24500, ltp:530,   chgPct:0.4,  high:530.8, low:527.9, currentVal:26500,  netPL:2000,  plPct:8.16  },
  { symbol:"SBI",   qty:30,  avgBuy:371, invested:11130, ltp:405,   chgPct:1.63, high:405,   low:393,   currentVal:12150,  netPL:1020,  plPct:9.16  },
  { symbol:"NHPC",  qty:200, avgBuy:260, invested:52000, ltp:295,   chgPct:2.25, high:297.6, low:286,   currentVal:59000,  netPL:7000,  plPct:13.46 },
  { symbol:"CBBL",  qty:20,  avgBuy:945, invested:18900, ltp:917,   chgPct:0.22, high:918,   low:910,   currentVal:18340,  netPL:-560,  plPct:-2.96 },
  { symbol:"EBL",   qty:15,  avgBuy:640, invested:9600,  ltp:710,   chgPct:0.03, high:712,   low:705,   currentVal:10650,  netPL:1050,  plPct:10.94 },
  { symbol:"CHCL",  qty:40,  avgBuy:455, invested:18200, ltp:482,   chgPct:0.63, high:482,   low:477.6, currentVal:19280,  netPL:1080,  plPct:5.93  },
  { symbol:"NICL",  qty:25,  avgBuy:471, invested:11775, ltp:497,   chgPct:1.02, high:497,   low:486.2, currentVal:12425,  netPL:650,   plPct:5.52  },
  { symbol:"BPCL",  qty:35,  avgBuy:730, invested:25550, ltp:699,   chgPct:-0.40,high:705,   low:695.1, currentVal:24465,  netPL:-1085, plPct:-4.25 },
];

// ─── Trades seed ─────────────────────────────────────────────────────────────
export const SEED_TRADES: Trade[] = [
  { tradeId:"t1",  date:"2025-01-15", dateStr:"Jan 15, 2025", symbol:"NABIL", type:"buy",  qty:50,  buyWacc:490,  totalBuy:24500,  sellPrice:0,   totalSell:0,     holdingDays:0,   commission:124,  profitTax:0,    netPl:0,     plPct:0,     remarks:"" },
  { tradeId:"t2",  date:"2025-02-03", dateStr:"Feb 3, 2025",  symbol:"EBL",   type:"buy",  qty:15,  buyWacc:640,  totalBuy:9600,   sellPrice:0,   totalSell:0,     holdingDays:0,   commission:49,   profitTax:0,    netPl:0,     plPct:0,     remarks:"" },
  { tradeId:"t3",  date:"2025-02-20", dateStr:"Feb 20, 2025", symbol:"SANIMA",type:"sell", qty:100, buyWacc:310,  totalBuy:31000,  sellPrice:365, totalSell:36500, holdingDays:45,  commission:185,  profitTax:413,  netPl:4902,  plPct:15.81, remarks:"TP hit" },
  { tradeId:"t4",  date:"2025-03-08", dateStr:"Mar 8, 2025",  symbol:"NHPC",  type:"buy",  qty:200, buyWacc:260,  totalBuy:52000,  sellPrice:0,   totalSell:0,     holdingDays:0,   commission:263,  profitTax:0,    netPl:0,     plPct:0,     remarks:"" },
  { tradeId:"t5",  date:"2025-03-22", dateStr:"Mar 22, 2025", symbol:"KBL",   type:"sell", qty:80,  buyWacc:195,  totalBuy:15600,  sellPrice:218, totalSell:17440, holdingDays:60,  commission:88,   profitTax:138,  netPl:1614,  plPct:10.35, remarks:"" },
  { tradeId:"t6",  date:"2025-04-10", dateStr:"Apr 10, 2025", symbol:"SBI",   type:"buy",  qty:30,  buyWacc:371,  totalBuy:11130,  sellPrice:0,   totalSell:0,     holdingDays:0,   commission:56,   profitTax:0,    netPl:0,     plPct:0,     remarks:"" },
  { tradeId:"t7",  date:"2025-04-28", dateStr:"Apr 28, 2025", symbol:"CBBL",  type:"buy",  qty:20,  buyWacc:945,  totalBuy:18900,  sellPrice:0,   totalSell:0,     holdingDays:0,   commission:95,   profitTax:0,    netPl:0,     plPct:0,     remarks:"" },
  { tradeId:"t8",  date:"2025-05-05", dateStr:"May 5, 2025",  symbol:"NLICL", type:"sell", qty:25,  buyWacc:540,  totalBuy:13500,  sellPrice:591, totalSell:14775, holdingDays:30,  commission:74,   profitTax:96,   netPl:1105,  plPct:8.19,  remarks:"" },
  { tradeId:"t9",  date:"2025-05-12", dateStr:"May 12, 2025", symbol:"CHCL",  type:"buy",  qty:40,  buyWacc:455,  totalBuy:18200,  sellPrice:0,   totalSell:0,     holdingDays:0,   commission:92,   profitTax:0,    netPl:0,     plPct:0,     remarks:"" },
  { tradeId:"t10", date:"2025-05-20", dateStr:"May 20, 2025", symbol:"NICL",  type:"buy",  qty:25,  buyWacc:471,  totalBuy:11775,  sellPrice:0,   totalSell:0,     holdingDays:0,   commission:59,   profitTax:0,    netPl:0,     plPct:0,     remarks:"" },
  { tradeId:"t11", date:"2025-05-22", dateStr:"May 22, 2025", symbol:"BPCL",  type:"buy",  qty:35,  buyWacc:730,  totalBuy:25550,  sellPrice:0,   totalSell:0,     holdingDays:0,   commission:129,  profitTax:0,    netPl:0,     plPct:0,     remarks:"" },
];

// ─── Capital seed ────────────────────────────────────────────────────────────
export const SEED_CAPITAL: CapitalSummary = {
  totalCapitalAdded: 200000,
  totalRetained: 7621,
  deployedCapital: 160525,
  realizedPL: 7621,
  actualCapital: 207621,
  tradingCapital: 185000,
  reservedCapital: 22621,
  maxPerStock: 30000,
  availableCapital: 24475,
  additions: [
    { date:"2025-01-01", amount:100000, notes:"Initial capital" },
    { date:"2025-02-15", amount:50000,  notes:"Top-up" },
    { date:"2025-04-01", amount:50000,  notes:"Additional funds" },
  ],
  retentions: [
    { date:"2025-03-31", amount:4902, notes:"Q1 realized profit retained" },
    { date:"2025-04-30", amount:2719, notes:"April trades retained" },
  ],
};

// ─── Summary seed ────────────────────────────────────────────────────────────
export const SEED_SUMMARY: SummaryData = {
  filter: "all",
  buyCount: 8, buyQty: 415, buyTurnover: 171655,
  sellCount: 3, sellQty: 205, sellTurnover: 68715,
  profit: 7621, plPct: 11.09,
  commissionPaid: 1070, cgtPaid: 647,
  leftAmt: 0,
  allTimeProfit: 7621, allTimePLPct: 11.09,
  avgHoldDays: 42, caagr: 19.4,
  firstTradeDate: "2025-01-15",
  lastTradeDate: "2025-05-22",
};

// ─── Watchlist seed ──────────────────────────────────────────────────────────
export const SEED_WATCHLIST: WatchlistEntry[] = [
  { symbol:"NABIL", cap:"h", watch:true,  remark:"", targetCap:30000, ltp:530,  chgPct:0.4,   high:530.8, low:527.9, inPortfolio:true,  heldQty:50  },
  { symbol:"NIMB",  cap:"h", watch:true,  remark:"", targetCap:20000, ltp:198,  chgPct:1.28,  high:198,   low:194,   inPortfolio:false, heldQty:0   },
  { symbol:"HBL",   cap:"h", watch:false, remark:"", targetCap:0,     ltp:203,  chgPct:-0.88, high:206,   low:200,   inPortfolio:false, heldQty:0   },
  { symbol:"SBI",   cap:"h", watch:true,  remark:"", targetCap:15000, ltp:405,  chgPct:1.63,  high:405,   low:393,   inPortfolio:true,  heldQty:30  },
  { symbol:"EBL",   cap:"h", watch:true,  remark:"", targetCap:12000, ltp:710,  chgPct:0.03,  high:712,   low:705,   inPortfolio:true,  heldQty:15  },
  { symbol:"NHPC",  cap:"s", watch:true,  remark:"", targetCap:60000, ltp:295,  chgPct:2.25,  high:297.6, low:286,   inPortfolio:true,  heldQty:200 },
  { symbol:"BPCL",  cap:"s", watch:true,  remark:"", targetCap:30000, ltp:699,  chgPct:-0.40, high:705,   low:695.1, inPortfolio:true,  heldQty:35  },
  { symbol:"CHCL",  cap:"s", watch:true,  remark:"", targetCap:20000, ltp:482,  chgPct:0.63,  high:482,   low:477.6, inPortfolio:true,  heldQty:40  },
  { symbol:"CBBL",  cap:"m", watch:false, remark:"", targetCap:0,     ltp:917,  chgPct:0.22,  high:918,   low:910,   inPortfolio:true,  heldQty:20  },
  { symbol:"NICL",  cap:"m", watch:true,  remark:"", targetCap:15000, ltp:497,  chgPct:1.02,  high:497,   low:486.2, inPortfolio:true,  heldQty:25  },
  { symbol:"NLICL", cap:"m", watch:false, remark:"", targetCap:0,     ltp:591,  chgPct:0.20,  high:596,   low:585,   inPortfolio:false, heldQty:0   },
  { symbol:"KBL",   cap:"h", watch:false, remark:"", targetCap:0,     ltp:218.7,chgPct:0.92,  high:222,   low:215.5, inPortfolio:false, heldQty:0   },
  { symbol:"LSL",   cap:"h", watch:false, remark:"", targetCap:0,     ltp:225.9,chgPct:1.30,  high:226.3, low:222,   inPortfolio:false, heldQty:0   },
  { symbol:"SANIMA",cap:"h", watch:true,  remark:"", targetCap:20000, ltp:365.5,chgPct:0.91,  high:365.5, low:360.1, inPortfolio:false, heldQty:0   },
];

// ─── Watches seed ────────────────────────────────────────────────────────────
export const SEED_WATCHES: Watch[] = [
  { id:"w1", name:"NABIL above 550",     enabled:true,  engine:"nepse", symbol:"NABIL", conditionLabel:"above 550",      lastCheckedAt:"2025-05-22T14:59:56Z", lastAlertAt:null,                     createdAt:"2025-01-15T00:00:00Z" },
  { id:"w2", name:"NHPC above 300",      enabled:true,  engine:"nepse", symbol:"NHPC",  conditionLabel:"above 300",      lastCheckedAt:"2025-05-22T14:59:58Z", lastAlertAt:null,                     createdAt:"2025-03-08T00:00:00Z" },
  { id:"w3", name:"EBL below 680",       enabled:false, engine:"nepse", symbol:"EBL",   conditionLabel:"below 680",      lastCheckedAt:"2025-05-20T14:50:00Z", lastAlertAt:null,                     createdAt:"2025-02-03T00:00:00Z" },
  { id:"w4", name:"BPCL any change",     enabled:true,  engine:"nepse", symbol:"BPCL",  conditionLabel:"any change",     lastCheckedAt:"2025-05-22T14:59:53Z", lastAlertAt:"2025-05-22T14:30:00Z",  createdAt:"2025-04-10T00:00:00Z" },
  { id:"w5", name:"SBI above 410",       enabled:true,  engine:"nepse", symbol:"SBI",   conditionLabel:"above 410",      lastCheckedAt:"2025-05-22T14:59:57Z", lastAlertAt:null,                     createdAt:"2025-04-10T00:00:00Z" },
];

// ─── Alerts seed ─────────────────────────────────────────────────────────────
export const SEED_ALERTS: Alert[] = [
  { id:"a1", watchName:"BPCL any change",  conditionLabel:"any_change",    value:"699",  firedAt:"2025-05-22T14:30:00Z", read:false },
  { id:"a2", watchName:"BPCL any change",  conditionLabel:"any_change",    value:"701",  firedAt:"2025-05-22T11:00:00Z", read:true  },
  { id:"a3", watchName:"SBI above 410",    conditionLabel:"above 410",     value:"405",  firedAt:"2025-05-21T14:55:00Z", read:true  },
  { id:"a4", watchName:"NABIL above 550",  conditionLabel:"above 550",     value:"530",  firedAt:"2025-05-20T12:30:00Z", read:true  },
];

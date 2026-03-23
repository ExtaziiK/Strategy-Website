export interface StrategyRule {
  indicator: string;
  params: Record<string, number>;
  comparator: string;
  value: number | string;
  delta_pct: number;
}

export interface StrategyConfig {
  buy_rules: StrategyRule[];
  sell_rules: StrategyRule[];
  filters: StrategyRule[];
  timeframe: string;
  initial_balance: number;
  exchange: string;
  position_size_pct: number;
  lookback_days: number;
  trailing_stop_atr: number | null;
  trailing_stop_atr_period: number;
}

export interface StrategyLastResult {
  final_balance: number;
  roi_pct: number;
  win_rate: number;
  total_trades: number;
  max_drawdown: number;
  total_fees?: number;
}

export interface Strategy {
  id: string;
  name: string;
  config: StrategyConfig;
  created_at?: string;
  last_result?: StrategyLastResult;
}

export interface TradeRecord {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  pnl: number;
  pnl_pct: number;
  exit_reason?: string;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
}

export interface BacktestResult {
  id?: string;
  strategy_id?: string;
  final_balance: number;
  roi_pct: number;
  win_rate: number;
  total_trades: number;
  max_drawdown: number;
  total_fees: number;
  trades: TradeRecord[];
  equity_curve: EquityPoint[];
}

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData {
  [key: string]: { timestamp: string; value: number }[];
}

export interface BacktestResponse {
  result: BacktestResult;
  candles: CandleData[];
  indicators: IndicatorData;
}

export const INDICATORS = ["price", "ema", "rsi", "atr", "macd", "macd_signal", "macd_hist"] as const;
export const COMPARATORS = [">", "<", "crosses_above", "crosses_below"] as const;
export const TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
export const EXCHANGES = [
  { value: "binance",     label: "Binance (0.10%)" },
  { value: "kraken",      label: "Kraken (0.26%)" },
  { value: "hyperliquid", label: "Hyperliquid (0.035%)" },
] as const;

export const LOOKBACK_OPTIONS = [
  { label: "6 Months",  days: 182  },
  { label: "1 Year",    days: 365  },
  { label: "2 Years",   days: 730  },
  { label: "3 Years",   days: 1095 },
  { label: "4 Years",   days: 1460 },
  { label: "5 Years",   days: 1825 },
  { label: "6 Years",   days: 2190 },
  { label: "7 Years",   days: 2555 },
  { label: "8 Years",   days: 2920 },
] as const;

export function emptyRule(): StrategyRule {
  return { indicator: "rsi", params: { period: 14 }, comparator: "<", value: 30, delta_pct: 0 };
}

export function emptyConfig(): StrategyConfig {
  return {
    buy_rules: [emptyRule()],
    sell_rules: [{ indicator: "rsi", params: { period: 14 }, comparator: ">", value: 70, delta_pct: 0 }],
    filters: [],
    timeframe: "1h",
    initial_balance: 10000,
    exchange: "binance",
    position_size_pct: 100,
    lookback_days: 365,
    trailing_stop_atr: null,
    trailing_stop_atr_period: 14,
  };
}

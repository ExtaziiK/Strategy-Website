from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class StrategyRule(BaseModel):
    indicator: str          # "ema", "rsi", "macd", "macd_signal", "macd_hist", "price"
    params: dict = {}       # e.g. {"period": 14}
    comparator: str         # ">", "<", "crosses_above", "crosses_below"
    value: float | str      # numeric threshold or another indicator like "ema_200"
    delta_pct: float = 0.0  # % offset applied to the comparison value (e.g. 1.0 = 1%)


class StrategyConfig(BaseModel):
    buy_rules: list[StrategyRule]
    sell_rules: list[StrategyRule]
    filters: list[StrategyRule] = []
    timeframe: str = "1h"           # "1h", "4h", "1d", "1w"
    initial_balance: float = 10000.0
    exchange: str = "binance"       # "binance", "kraken", "hyperliquid"
    position_size_pct: float = 100.0  # % of available balance to use per trade (1-100)
    lookback_days: int = 365           # how many days of history to backtest


class StrategyCreate(BaseModel):
    name: str
    config: StrategyConfig


class StrategyLastResult(BaseModel):
    final_balance: Optional[float] = None
    roi_pct: Optional[float] = None
    win_rate: Optional[float] = None
    total_trades: Optional[int] = None
    max_drawdown: Optional[float] = None
    total_fees: Optional[float] = None


class StrategyResponse(BaseModel):
    id: str
    name: str
    config: StrategyConfig
    created_at: Optional[str] = None
    last_result: Optional[StrategyLastResult] = None


class TradeRecord(BaseModel):
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    pnl: float
    pnl_pct: float


class EquityPoint(BaseModel):
    timestamp: str
    equity: float


class BacktestRequest(BaseModel):
    strategy_id: Optional[str] = None
    config: Optional[StrategyConfig] = None


class BacktestResultResponse(BaseModel):
    id: Optional[str] = None
    strategy_id: Optional[str] = None
    final_balance: float
    roi_pct: float
    win_rate: float
    total_trades: int
    max_drawdown: float
    total_fees: float
    trades: list[TradeRecord]
    equity_curve: list[EquityPoint]


class CandleData(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float

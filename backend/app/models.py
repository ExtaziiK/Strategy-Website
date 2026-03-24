from pydantic import BaseModel, field_validator
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
    start_date: Optional[str] = None   # custom start date ISO format (overrides lookback_days)
    end_date: Optional[str] = None     # custom end date ISO format (defaults to now)
    trailing_stop_atr: Optional[float] = None  # ATR multiplier for trailing stop (e.g. 2.0)
    trailing_stop_atr_period: int = 14          # ATR period for trailing stop

    @field_validator("initial_balance")
    @classmethod
    def validate_balance(cls, v: float) -> float:
        if v < 1:
            raise ValueError("initial_balance must be at least 1")
        return v

    @field_validator("position_size_pct")
    @classmethod
    def validate_position_size(cls, v: float) -> float:
        if not 1 <= v <= 100:
            raise ValueError("position_size_pct must be between 1 and 100")
        return v

    @field_validator("lookback_days")
    @classmethod
    def validate_lookback(cls, v: int) -> int:
        if v < 1:
            raise ValueError("lookback_days must be at least 1")
        if v > 3650:
            raise ValueError("lookback_days cannot exceed 3650 (10 years)")
        return v


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
    exit_reason: Optional[str] = None  # "sell_rule", "trailing_stop", "end_of_data"


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

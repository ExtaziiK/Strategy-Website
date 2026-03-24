from fastapi import APIRouter, HTTPException
from app.models import BacktestRequest, BacktestResultResponse, StrategyConfig, CandleData
from app.database import get_supabase
from app.services.data_fetcher import get_btc_data, TIMEFRAME_SECONDS
from app.services.indicators import compute_indicators
from app.services.backtester import run_backtest
import uuid
import pandas as pd
from datetime import datetime, timezone, timedelta

router = APIRouter()


def _max_warmup_periods(rules: list) -> int:
    """Return the largest indicator period across all rules (indicator + value refs)."""
    max_p = 0
    for rule in rules:
        ind = rule.indicator.lower()
        if ind in ("ema", "rsi", "atr"):
            max_p = max(max_p, int(rule.params.get("period", 20 if ind == "ema" else 14)))
        elif ind in ("macd", "macd_signal", "macd_hist"):
            max_p = max(max_p, 34)  # MACD uses 26-period EMA + 9-period signal
        if isinstance(rule.value, str):
            val = rule.value.lower()
            if val.startswith("ema_"):
                max_p = max(max_p, int(val.split("_")[1]))
            elif val.startswith("rsi_"):
                max_p = max(max_p, int(val.split("_")[1]))
            elif val.startswith("atr_"):
                max_p = max(max_p, int(val.split("_")[1]))
    return max_p


@router.post("/")
def run_backtest_endpoint(request: BacktestRequest):
    """Run a backtest with either a saved strategy or an inline config."""
    config: StrategyConfig | None = request.config

    if request.strategy_id:
        db = get_supabase()
        result = db.table("strategies").select("*").eq("id", request.strategy_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Strategy not found")
        strategy = result.data[0]
        config = StrategyConfig(**strategy["config"])

    if config is None:
        raise HTTPException(status_code=400, detail="Provide strategy_id or config")

    # Calculate warmup: fetch extra candles so indicators cover the full range
    all_rules = config.buy_rules + config.sell_rules + config.filters
    warmup_periods = _max_warmup_periods(all_rules)
    if config.trailing_stop_atr:
        warmup_periods = max(warmup_periods, config.trailing_stop_atr_period)
    # Add 50% buffer for EMA convergence
    warmup_candles = int(warmup_periods * 1.5) + 10

    tf_seconds = TIMEFRAME_SECONDS.get(config.timeframe, 3600)
    warmup_seconds = warmup_candles * tf_seconds

    # Shift start date / lookback back by warmup amount
    warmup_days = int(warmup_seconds / 86400) + 1
    fetch_start = config.start_date
    fetch_lookback = config.lookback_days + warmup_days
    if config.start_date:
        orig_start_dt = datetime.fromisoformat(config.start_date).replace(tzinfo=timezone.utc)
        warmup_start_dt = orig_start_dt - timedelta(seconds=warmup_seconds)
        fetch_start = warmup_start_dt.isoformat()

    # Fetch data (with warmup prefix)
    try:
        supabase_client = None
        try:
            supabase_client = get_supabase()
        except Exception:
            pass
        df = get_btc_data(
            timeframe=config.timeframe,
            lookback_days=fetch_lookback,
            supabase_client=supabase_client,
            start_date=fetch_start,
            end_date=config.end_date,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

    # Compute indicators on full dataset (including warmup)
    df = compute_indicators(df, all_rules)

    # Ensure ATR is computed when trailing stop is enabled
    if config.trailing_stop_atr:
        atr_col = f"atr_{config.trailing_stop_atr_period}"
        if atr_col not in df.columns:
            from app.services.indicators import add_atr
            df = add_atr(df, config.trailing_stop_atr_period)

    # Run backtest on the full dataset (warmup rows let indicators be valid from the start)
    result = run_backtest(df, config)

    # Trim to user's requested range for chart output
    if config.start_date:
        orig_start_dt = datetime.fromisoformat(config.start_date).replace(tzinfo=timezone.utc)
        df = df[df["timestamp"] >= pd.Timestamp(orig_start_dt)].reset_index(drop=True)
    elif warmup_days > 0:
        # lookback_days case: trim the extra warmup candles
        desired_start = datetime.now(timezone.utc) - timedelta(days=config.lookback_days)
        df = df[df["timestamp"] >= pd.Timestamp(desired_start)].reset_index(drop=True)

    # Attach strategy_id if available
    if request.strategy_id:
        result.strategy_id = request.strategy_id

    # Save result to Supabase
    try:
        db = get_supabase()
        save_record = {
            "id": str(uuid.uuid4()),
            "strategy_id": request.strategy_id,
            "final_balance": result.final_balance,
            "roi_pct": result.roi_pct,
            "win_rate": result.win_rate,
            "total_trades": result.total_trades,
            "max_drawdown": result.max_drawdown,
            "total_fees": result.total_fees,
            "trades": [t.model_dump() for t in result.trades],
            "equity_curve": [e.model_dump() for e in result.equity_curve],
        }
        db.table("backtest_results").insert(save_record).execute()
        result.id = save_record["id"]
    except Exception as e:
        print(f"Warning: Failed to save backtest result to database: {e}", flush=True)

    # Build candle data for frontend chart (vectorized)
    candle_df = df[["timestamp", "open", "high", "low", "close", "volume"]].copy()
    candle_df["timestamp"] = candle_df["timestamp"].astype(str)
    candles = candle_df.to_dict(orient="records")

    # Build indicator data for overlays (vectorized)
    indicator_data = {}
    for col in df.columns:
        if col.startswith("ema_") or col.startswith("rsi_") or col.startswith("atr_") or col in ("macd", "macd_signal", "macd_hist"):
            col_df = df[["timestamp", col]].dropna(subset=[col]).copy()
            col_df["timestamp"] = col_df["timestamp"].astype(str)
            col_df[col] = col_df[col].round(2)
            indicator_data[col] = col_df.rename(columns={col: "value"}).to_dict(orient="records")

    return {
        "result": result.model_dump(),
        "candles": candles,
        "indicators": indicator_data,
    }


@router.get("/{strategy_id}")
def get_backtest_result(strategy_id: str):
    """Get the most recent backtest result for a strategy."""
    db = get_supabase()
    result = (
        db.table("backtest_results")
        .select("*")
        .eq("strategy_id", strategy_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No backtest results found")
    return result.data[0]

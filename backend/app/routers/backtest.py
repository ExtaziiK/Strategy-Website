from fastapi import APIRouter, HTTPException
from app.models import BacktestRequest, BacktestResultResponse, StrategyConfig, CandleData
from app.database import get_supabase
from app.services.data_fetcher import get_btc_data
from app.services.indicators import compute_indicators
from app.services.backtester import run_backtest
import uuid

router = APIRouter()


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

    # Fetch data
    try:
        supabase_client = None
        try:
            supabase_client = get_supabase()
        except Exception:
            pass
        df = get_btc_data(
            timeframe=config.timeframe,
            lookback_days=config.lookback_days,
            supabase_client=supabase_client,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

    # Compute indicators
    all_rules = config.buy_rules + config.sell_rules + config.filters
    df = compute_indicators(df, all_rules)

    # Run backtest
    result = run_backtest(df, config)

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
    except Exception:
        pass

    # Build candle data for frontend chart
    candles = []
    for _, row in df.iterrows():
        candles.append({
            "timestamp": str(row["timestamp"]),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": float(row["volume"]),
        })

    # Build indicator data for overlays
    indicator_data = {}
    for col in df.columns:
        if col.startswith("ema_") or col.startswith("rsi_") or col in ("macd", "macd_signal", "macd_hist"):
            values = []
            for _, row in df.iterrows():
                val = row[col]
                if not (val != val):  # check NaN
                    values.append({"timestamp": str(row["timestamp"]), "value": round(float(val), 2)})
            indicator_data[col] = values

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

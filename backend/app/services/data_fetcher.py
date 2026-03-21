import ccxt
import pandas as pd
from datetime import datetime, timezone, timedelta


TIMEFRAME_MAP = {
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
    "1w": "1w",
}


def fetch_btc_data(timeframe: str = "1h", lookback_days: int = 365) -> pd.DataFrame:
    """Fetch BTC/USDT OHLCV data from Binance via ccxt with full lookback pagination."""
    exchange = ccxt.binance({"enableRateLimit": True})
    tf = TIMEFRAME_MAP.get(timeframe, "1h")

    since_dt = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    since_ms = int(since_dt.timestamp() * 1000)

    all_ohlcv = []
    while True:
        ohlcv = exchange.fetch_ohlcv("BTC/USDT", timeframe=tf, since=since_ms, limit=1000)
        if not ohlcv:
            break
        all_ohlcv.extend(ohlcv)
        if len(ohlcv) < 1000:
            break
        since_ms = ohlcv[-1][0] + 1  # start after last candle

    df = pd.DataFrame(all_ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df = df.drop_duplicates("timestamp").sort_values("timestamp").reset_index(drop=True)
    return df


def try_load_from_supabase(supabase_client, timeframe: str, lookback_days: int = 365) -> pd.DataFrame | None:
    """Try to load cached candle data from Supabase."""
    try:
        since_dt = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        result = (
            supabase_client.table("candles")
            .select("*")
            .eq("timeframe", timeframe)
            .gte("timestamp", since_dt.isoformat())
            .order("timestamp", desc=False)
            .execute()
        )
        if result.data and len(result.data) > 100:
            df = pd.DataFrame(result.data)
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
            df = df.sort_values("timestamp").reset_index(drop=True)
            return df
    except Exception:
        pass
    return None


def cache_to_supabase(supabase_client, df: pd.DataFrame, timeframe: str):
    """Cache candle data to Supabase for future use."""
    try:
        records = []
        for _, row in df.iterrows():
            records.append({
                "timestamp": row["timestamp"].isoformat(),
                "timeframe": timeframe,
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"]),
            })
        supabase_client.table("candles").upsert(records, on_conflict="timestamp,timeframe").execute()
    except Exception:
        pass


def get_btc_data(timeframe: str = "1h", lookback_days: int = 365, supabase_client=None) -> pd.DataFrame:
    """Get BTC data, trying Supabase cache first, then fetching from Binance."""
    if supabase_client:
        cached = try_load_from_supabase(supabase_client, timeframe, lookback_days)
        if cached is not None:
            return cached

    df = fetch_btc_data(timeframe, lookback_days)

    if supabase_client:
        cache_to_supabase(supabase_client, df, timeframe)

    return df

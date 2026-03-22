import ccxt
import pandas as pd
from datetime import datetime, timezone, timedelta


TIMEFRAME_MAP = {
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
    "1w": "1w",
}

TIMEFRAME_SECONDS = {
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
    "1w": 604800,
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
    """Try to load cached candle data from Supabase. Returns None if cache is missing or stale."""
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

            # Check staleness: last candle must be within 2 periods of now
            period_seconds = TIMEFRAME_SECONDS.get(timeframe, 3600)
            last_candle_ts = df["timestamp"].iloc[-1]
            now = pd.Timestamp.now(tz="UTC")
            staleness = (now - last_candle_ts).total_seconds()
            if staleness > period_seconds * 2:
                print(f"Cache stale ({staleness:.0f}s old, limit {period_seconds * 2}s). Fetching fresh data.", flush=True)
                return None

            return df
    except Exception as e:
        print(f"Warning: Failed to load from Supabase cache: {e}", flush=True)
    return None


def cache_to_supabase(supabase_client, df: pd.DataFrame, timeframe: str):
    """Cache candle data to Supabase in batches to avoid request size limits."""
    try:
        records = (
            df.assign(
                timestamp=df["timestamp"].apply(lambda ts: ts.isoformat()),
                timeframe=timeframe,
            )[["timestamp", "timeframe", "open", "high", "low", "close", "volume"]]
            .astype({"open": float, "high": float, "low": float, "close": float, "volume": float})
            .to_dict(orient="records")
        )

        batch_size = 1000
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            supabase_client.table("candles").upsert(batch, on_conflict="timestamp,timeframe").execute()
    except Exception as e:
        print(f"Warning: Failed to cache candles to Supabase: {e}", flush=True)


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

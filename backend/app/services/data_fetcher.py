import re
import ccxt
import pandas as pd
from datetime import datetime, timezone, timedelta


# Base timeframes supported by Binance that we use for fetching
BASE_TIMEFRAMES = {"1h", "4h", "1d", "1w"}

UNIT_SECONDS = {"h": 3600, "d": 86400, "w": 604800}


def parse_timeframe(tf: str) -> tuple[int, str]:
    """Parse a timeframe string like '3d' into (amount, unit)."""
    m = re.match(r"^(\d+)([hdw])$", tf.lower())
    if not m:
        return 1, "h"
    return int(m.group(1)), m.group(2)


def timeframe_seconds(tf: str) -> int:
    """Return the total seconds for a timeframe string."""
    amount, unit = parse_timeframe(tf)
    return amount * UNIT_SECONDS.get(unit, 3600)


def base_fetch_timeframe(tf: str) -> str:
    """Determine the best base timeframe to fetch from the exchange.
    If the requested timeframe is a direct Binance timeframe, use it.
    Otherwise, use the unit's 1-period base (e.g. '3d' → '1d', '2h' → '1h')."""
    if tf in BASE_TIMEFRAMES:
        return tf
    _, unit = parse_timeframe(tf)
    return f"1{unit}"


def resample_ohlcv(df: pd.DataFrame, tf: str) -> pd.DataFrame:
    """Resample OHLCV data to a custom timeframe by grouping N base candles."""
    amount, unit = parse_timeframe(tf)
    base = f"1{unit}"
    if tf == base or amount <= 1:
        return df  # No resampling needed

    # Group every `amount` candles
    df = df.sort_values("timestamp").reset_index(drop=True)
    groups = df.index // amount
    resampled = df.groupby(groups).agg({
        "timestamp": "first",
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum",
    }).reset_index(drop=True)
    return resampled


def fetch_btc_data(timeframe: str = "1h", lookback_days: int = 365,
                    start_date: str | None = None, end_date: str | None = None) -> pd.DataFrame:
    """Fetch BTC/USDT OHLCV data from Binance via ccxt with full lookback pagination."""
    exchange = ccxt.binance({"enableRateLimit": True})
    fetch_tf = base_fetch_timeframe(timeframe)

    if start_date:
        since_dt = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
    else:
        since_dt = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    since_ms = int(since_dt.timestamp() * 1000)

    end_ms = None
    if end_date:
        end_dt = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
        end_ms = int(end_dt.timestamp() * 1000)

    all_ohlcv = []
    while True:
        ohlcv = exchange.fetch_ohlcv("BTC/USDT", timeframe=fetch_tf, since=since_ms, limit=1000)
        if not ohlcv:
            break
        if end_ms:
            ohlcv = [c for c in ohlcv if c[0] <= end_ms]
        all_ohlcv.extend(ohlcv)
        if len(ohlcv) < 1000:
            break
        since_ms = ohlcv[-1][0] + 1  # start after last candle

    df = pd.DataFrame(all_ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df = df.drop_duplicates("timestamp").sort_values("timestamp").reset_index(drop=True)

    # Resample if the requested timeframe differs from the fetch timeframe
    df = resample_ohlcv(df, timeframe)

    return df


def try_load_from_supabase(supabase_client, timeframe: str, lookback_days: int = 365) -> pd.DataFrame | None:
    """Try to load cached candle data from Supabase. Returns None if cache is missing or stale."""
    try:
        # Cache is stored at base timeframe
        base_tf = base_fetch_timeframe(timeframe)
        since_dt = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        result = (
            supabase_client.table("candles")
            .select("*")
            .eq("timeframe", base_tf)
            .gte("timestamp", since_dt.isoformat())
            .order("timestamp", desc=False)
            .execute()
        )
        if result.data and len(result.data) > 100:
            df = pd.DataFrame(result.data)
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
            df = df.sort_values("timestamp").reset_index(drop=True)

            # Check staleness: last candle must be within 2 periods of now
            period_secs = timeframe_seconds(base_tf)
            last_candle_ts = df["timestamp"].iloc[-1]
            now = pd.Timestamp.now(tz="UTC")
            staleness = (now - last_candle_ts).total_seconds()
            if staleness > period_secs * 2:
                print(f"Cache stale ({staleness:.0f}s old, limit {period_secs * 2}s). Fetching fresh data.", flush=True)
                return None

            # Resample to target timeframe
            df = resample_ohlcv(df, timeframe)
            return df
    except Exception as e:
        print(f"Warning: Failed to load from Supabase cache: {e}", flush=True)
    return None


def cache_to_supabase(supabase_client, df_base: pd.DataFrame, base_tf: str):
    """Cache base-timeframe candle data to Supabase in batches."""
    try:
        records = (
            df_base.assign(
                timestamp=df_base["timestamp"].apply(lambda ts: ts.isoformat()),
                timeframe=base_tf,
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


def get_btc_data(timeframe: str = "1h", lookback_days: int = 365,
                  supabase_client=None, start_date: str | None = None,
                  end_date: str | None = None) -> pd.DataFrame:
    """Get BTC data, trying Supabase cache first, then fetching from Binance."""
    if supabase_client and not start_date:
        cached = try_load_from_supabase(supabase_client, timeframe, lookback_days)
        if cached is not None:
            return cached

    df = fetch_btc_data(timeframe, lookback_days, start_date, end_date)

    if supabase_client:
        # Cache at the base timeframe (before resampling) — but we already resampled in
        # fetch_btc_data, so we re-fetch the base df only if needed. For simplicity,
        # only cache when timeframe IS a base timeframe.
        base_tf = base_fetch_timeframe(timeframe)
        if timeframe == base_tf:
            cache_to_supabase(supabase_client, df, base_tf)

    return df

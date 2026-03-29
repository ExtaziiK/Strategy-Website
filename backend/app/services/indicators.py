import pandas as pd


def add_ema(df: pd.DataFrame, period: int) -> pd.DataFrame:
    """Add EMA column to DataFrame. Uses min_periods=1 so values start from the first candle."""
    col = f"ema_{period}"
    df[col] = df["close"].ewm(span=period, min_periods=1, adjust=False).mean()
    return df


def add_rsi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """Add RSI column using Wilder smoothing. SMA seed for the first `period` rows, then EWM."""
    col = f"rsi_{period}"
    delta = df["close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = pd.Series(index=df.index, dtype="float64")
    avg_loss = pd.Series(index=df.index, dtype="float64")

    # SMA seed
    avg_gain.iloc[period] = gain.iloc[1:period + 1].mean()
    avg_loss.iloc[period] = loss.iloc[1:period + 1].mean()

    # Wilder EWM from period+1 onward
    alpha = 1 / period
    for i in range(period + 1, len(df)):
        avg_gain.iloc[i] = avg_gain.iloc[i - 1] * (1 - alpha) + gain.iloc[i] * alpha
        avg_loss.iloc[i] = avg_loss.iloc[i - 1] * (1 - alpha) + loss.iloc[i] * alpha

    rs = avg_gain / avg_loss
    df[col] = 100 - (100 / (1 + rs))
    # Fill the first `period` rows with 50 (neutral) so the indicator covers the full range
    df[col] = df[col].fillna(50)
    return df


def add_atr(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """Add ATR column to DataFrame. Uses min_periods=1 for full coverage."""
    col = f"atr_{period}"
    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift()).abs()
    low_close = (df["low"] - df["close"].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    df[col] = tr.ewm(span=period, min_periods=1, adjust=False).mean()
    return df


def add_macd(df: pd.DataFrame) -> pd.DataFrame:
    """Add MACD, MACD signal, and MACD histogram columns. Uses min_periods=1 for full coverage."""
    ema12 = df["close"].ewm(span=12, min_periods=1, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, min_periods=1, adjust=False).mean()
    df["macd"] = ema12 - ema26
    df["macd_signal"] = df["macd"].ewm(span=9, min_periods=1, adjust=False).mean()
    df["macd_hist"] = df["macd"] - df["macd_signal"]
    return df


def compute_indicators(df: pd.DataFrame, rules: list) -> pd.DataFrame:
    """Compute all indicators needed by the given rules."""
    indicators_added = set()

    for rule in rules:
        indicator = rule.indicator.lower()
        params = rule.params

        if indicator == "ema":
            period = int(params.get("period", 20))
            key = f"ema_{period}"
            if key not in indicators_added:
                df = add_ema(df, period)
                indicators_added.add(key)

        elif indicator == "rsi":
            period = int(params.get("period", 14))
            key = f"rsi_{period}"
            if key not in indicators_added:
                df = add_rsi(df, period)
                indicators_added.add(key)

        elif indicator == "atr":
            period = int(params.get("period", 14))
            key = f"atr_{period}"
            if key not in indicators_added:
                df = add_atr(df, period)
                indicators_added.add(key)

        elif indicator in ("macd", "macd_signal", "macd_hist"):
            if "macd" not in indicators_added:
                df = add_macd(df)
                indicators_added.add("macd")

        # Handle value references to other indicators
        if isinstance(rule.value, str):
            val = rule.value.lower()
            if val.startswith("ema_"):
                period = int(val.split("_")[1])
                key = f"ema_{period}"
                if key not in indicators_added:
                    df = add_ema(df, period)
                    indicators_added.add(key)
            elif val.startswith("rsi_"):
                period = int(val.split("_")[1])
                key = f"rsi_{period}"
                if key not in indicators_added:
                    df = add_rsi(df, period)
                    indicators_added.add(key)
            elif val.startswith("atr_"):
                period = int(val.split("_")[1])
                key = f"atr_{period}"
                if key not in indicators_added:
                    df = add_atr(df, period)
                    indicators_added.add(key)
            elif val in ("macd", "macd_signal", "macd_hist"):
                if "macd" not in indicators_added:
                    df = add_macd(df)
                    indicators_added.add("macd")

    return df

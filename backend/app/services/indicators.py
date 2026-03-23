import pandas as pd
import ta


def add_ema(df: pd.DataFrame, period: int) -> pd.DataFrame:
    """Add EMA column to DataFrame."""
    col = f"ema_{period}"
    df[col] = ta.trend.EMAIndicator(close=df["close"], window=period).ema_indicator()
    return df


def add_rsi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """Add RSI column to DataFrame."""
    col = f"rsi_{period}"
    df[col] = ta.momentum.RSIIndicator(close=df["close"], window=period).rsi()
    return df


def add_atr(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """Add ATR column to DataFrame."""
    col = f"atr_{period}"
    df[col] = ta.volatility.AverageTrueRange(
        high=df["high"], low=df["low"], close=df["close"], window=period
    ).average_true_range()
    return df


def add_macd(df: pd.DataFrame) -> pd.DataFrame:
    """Add MACD, MACD signal, and MACD histogram columns."""
    macd_indicator = ta.trend.MACD(close=df["close"])
    df["macd"] = macd_indicator.macd()
    df["macd_signal"] = macd_indicator.macd_signal()
    df["macd_hist"] = macd_indicator.macd_diff()
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

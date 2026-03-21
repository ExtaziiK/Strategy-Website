import pandas as pd
import numpy as np
from app.models import StrategyConfig, StrategyRule
from app.services.backtester import run_backtest
from app.services.indicators import add_ema, add_rsi, add_macd


def make_test_df():
    """Create a small mock DataFrame for testing."""
    dates = pd.date_range("2024-01-01", periods=50, freq="1h", tz="UTC")
    np.random.seed(42)
    prices = 40000 + np.cumsum(np.random.randn(50) * 100)

    df = pd.DataFrame({
        "timestamp": dates,
        "open": prices - 50,
        "high": prices + 100,
        "low": prices - 100,
        "close": prices,
        "volume": np.random.rand(50) * 1000,
    })
    return df


def test_backtest_basic():
    """Test that the backtester produces valid results."""
    df = make_test_df()
    df = add_rsi(df, 14)

    config = StrategyConfig(
        buy_rules=[StrategyRule(indicator="rsi", params={"period": 14}, comparator="<", value=40)],
        sell_rules=[StrategyRule(indicator="rsi", params={"period": 14}, comparator=">", value=60)],
        filters=[],
        timeframe="1h",
        initial_balance=10000.0,
    )

    result = run_backtest(df, config)

    assert result.total_trades >= 0
    assert result.final_balance > 0
    assert -100 <= result.roi_pct <= 1000
    assert 0 <= result.win_rate <= 100
    assert len(result.equity_curve) == len(df)


def test_backtest_with_ema_filter():
    """Test backtester with EMA filter."""
    df = make_test_df()
    df = add_ema(df, 10)
    df = add_rsi(df, 14)

    config = StrategyConfig(
        buy_rules=[StrategyRule(indicator="rsi", params={"period": 14}, comparator="<", value=45)],
        sell_rules=[StrategyRule(indicator="rsi", params={"period": 14}, comparator=">", value=55)],
        filters=[StrategyRule(indicator="price", params={}, comparator=">", value="ema_10")],
        timeframe="1h",
        initial_balance=10000.0,
    )

    result = run_backtest(df, config)
    assert result.total_trades >= 0
    assert result.final_balance > 0


def test_backtest_no_trades():
    """Test backtester when no trades are triggered."""
    df = make_test_df()
    df = add_rsi(df, 14)

    config = StrategyConfig(
        buy_rules=[StrategyRule(indicator="rsi", params={"period": 14}, comparator="<", value=1)],
        sell_rules=[StrategyRule(indicator="rsi", params={"period": 14}, comparator=">", value=99)],
        filters=[],
        timeframe="1h",
        initial_balance=10000.0,
    )

    result = run_backtest(df, config)
    assert result.total_trades == 0
    assert result.final_balance == 10000.0
    assert result.roi_pct == 0.0


def test_trade_fees():
    """Test that fees are applied correctly."""
    df = make_test_df()
    df = add_rsi(df, 14)

    config = StrategyConfig(
        buy_rules=[StrategyRule(indicator="rsi", params={"period": 14}, comparator="<", value=50)],
        sell_rules=[StrategyRule(indicator="rsi", params={"period": 14}, comparator=">", value=50)],
        filters=[],
        timeframe="1h",
        initial_balance=10000.0,
    )

    result = run_backtest(df, config)
    if result.total_trades > 0:
        # With fees, even break-even price trades should result in slight loss
        assert result.final_balance != config.initial_balance


def test_macd_crossover():
    """Test MACD crossover strategy."""
    df = make_test_df()
    df = add_macd(df)

    config = StrategyConfig(
        buy_rules=[StrategyRule(indicator="macd", params={}, comparator="crosses_above", value="macd_signal")],
        sell_rules=[StrategyRule(indicator="macd", params={}, comparator="crosses_below", value="macd_signal")],
        filters=[],
        timeframe="1h",
        initial_balance=10000.0,
    )

    result = run_backtest(df, config)
    assert result.total_trades >= 0
    assert len(result.equity_curve) == len(df)

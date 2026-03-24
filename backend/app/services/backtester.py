import pandas as pd
import numpy as np
from dataclasses import dataclass
from app.models import StrategyConfig, TradeRecord, EquityPoint, BacktestResultResponse


# Taker (market order) fee rates per exchange
EXCHANGE_FEES = {
    "binance":      0.001,    # 0.10%
    "kraken":       0.0026,   # 0.26%
    "hyperliquid":  0.00035,  # 0.035%
}


@dataclass
class Position:
    entry_price: float
    entry_date: str
    qty: float
    highest_price: float = 0.0  # high watermark for trailing stop


def get_indicator_value(row, indicator: str, params: dict) -> float:
    """Get the value of an indicator from a DataFrame row."""
    indicator = indicator.lower()
    if indicator == "price":
        return float(row["close"])
    elif indicator == "ema":
        period = int(params.get("period", 20))
        return float(row[f"ema_{period}"])
    elif indicator == "rsi":
        period = int(params.get("period", 14))
        return float(row[f"rsi_{period}"])
    elif indicator == "macd":
        return float(row["macd"])
    elif indicator == "macd_signal":
        return float(row["macd_signal"])
    elif indicator == "macd_hist":
        return float(row["macd_hist"])
    elif indicator == "atr":
        period = int(params.get("period", 14))
        return float(row[f"atr_{period}"])
    return 0.0


def get_comparison_value(row, value) -> float:
    """Get the comparison value - either a number or another indicator reference."""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        val = value.lower()
        if val.startswith("ema_"):
            return float(row[val])
        elif val.startswith("rsi_"):
            return float(row[val])
        elif val.startswith("atr_"):
            return float(row[val])
        elif val in ("macd", "macd_signal", "macd_hist"):
            return float(row[val])
        elif val == "price":
            return float(row["close"])
        try:
            return float(val)
        except ValueError:
            return 0.0
    return float(value)


def apply_delta(comp_val: float, delta_pct: float, direction: str) -> float:
    """Shift comp_val up or down by delta_pct depending on direction."""
    if delta_pct == 0.0:
        return comp_val
    if direction == "above":
        return comp_val * (1 + delta_pct / 100)
    else:  # below
        return comp_val * (1 - delta_pct / 100)


def evaluate_rule(row, rule) -> bool:
    """Evaluate a non-crossing rule (> or <) against the current row."""
    ind_val = get_indicator_value(row, rule.indicator, rule.params)
    comp_val = get_comparison_value(row, rule.value)
    delta_pct = getattr(rule, "delta_pct", 0.0) or 0.0

    if pd.isna(ind_val) or pd.isna(comp_val):
        return False

    if rule.comparator == ">":
        return ind_val > apply_delta(comp_val, delta_pct, "above")
    elif rule.comparator == "<":
        return ind_val < apply_delta(comp_val, delta_pct, "below")
    return False


def get_crossing_threshold(row, rule) -> float:
    """Return the threshold value for a crossing rule."""
    comp_val = get_comparison_value(row, rule.value)
    delta_pct = getattr(rule, "delta_pct", 0.0) or 0.0
    direction = "above" if rule.comparator == "crosses_above" else "below"
    return apply_delta(comp_val, delta_pct, direction)


def get_trigger_value(row, rule, side: str) -> float:
    """
    For price indicator:
      - crosses_above: use max(open, high) — catches both gap-ups and intra-candle crosses.
      - crosses_below: use min(open, low)  — catches both gap-downs and intra-candle crosses.
    For other indicators: use the close-based indicator value.
    """
    if rule.indicator.lower() == "price":
        if side == "above":
            return max(float(row["open"]), float(row["high"]))
        else:
            return min(float(row["open"]), float(row["low"]))
    return get_indicator_value(row, rule.indicator, rule.params)


def get_close_state(row, rule, side: str) -> bool:
    """
    Returns the crossing state based on the candle CLOSE.
    True  = close is above the threshold (for crosses_above tracking)
    False = close is below the threshold (for crosses_below tracking)
    """
    comp_val = get_comparison_value(row, rule.value)
    delta_pct = getattr(rule, "delta_pct", 0.0) or 0.0
    threshold = apply_delta(comp_val, delta_pct, side)
    ind_val = get_indicator_value(row, rule.indicator, rule.params)
    if rule.indicator.lower() == "price":
        ind_val = float(row["close"])
    return ind_val >= threshold


def evaluate_rules_stateful(row, rules: list, states: list[bool | None]) -> tuple[bool, list[bool | None]]:
    """
    Evaluate all rules using stateful crossing detection.
    `states[i]` is the last known crossing state for rule i:
      - For crosses_above: True = was above threshold at last close
      - For crosses_below: True = was above threshold at last close
      - None = not yet initialised (first candle seen)
    Returns (all_triggered, new_states).
    """
    results = []
    new_states = []

    for i, rule in enumerate(rules):
        if rule.comparator == "crosses_above":
            threshold = get_crossing_threshold(row, rule)
            trigger_val = get_trigger_value(row, rule, "above")
            was_above = states[i]
            new_state = get_close_state(row, rule, "above")
            if pd.isna(threshold) or pd.isna(trigger_val):
                results.append(False)
                new_states.append(was_above)
                continue
            if was_above is None:
                # Initialise without triggering
                results.append(False)
                new_states.append(new_state)
            else:
                triggered = (not was_above) and (trigger_val >= threshold)
                results.append(triggered)
                new_states.append(new_state)

        elif rule.comparator == "crosses_below":
            threshold = get_crossing_threshold(row, rule)
            trigger_val = get_trigger_value(row, rule, "below")
            was_above = states[i]
            new_state = get_close_state(row, rule, "below")
            if pd.isna(threshold) or pd.isna(trigger_val):
                results.append(False)
                new_states.append(was_above)
                continue
            if was_above is None:
                results.append(False)
                new_states.append(new_state)
            else:
                triggered = was_above and (trigger_val <= threshold)
                results.append(triggered)
                new_states.append(new_state)

        else:
            results.append(evaluate_rule(row, rule))
            new_states.append(states[i])

    triggered = bool(results) and all(results)

    # If the combined signal didn't fire, revert crossing states for rules that
    # DID trigger individually.  This preserves the "a cross happened" info so
    # the crossing isn't consumed when another rule (e.g. RSI threshold) blocked
    # the trade on this candle.
    if not triggered:
        for i, rule in enumerate(rules):
            if rule.comparator in ("crosses_above", "crosses_below"):
                if results[i]:                 # this crossing rule fired …
                    new_states[i] = states[i]  # … but combined didn't → revert

    return triggered, new_states


def get_execution_price(row, rules: list, fallback_price: float) -> float:
    """
    For crossing rules, execute at the threshold or the candle open if price gapped past it.
    - crosses_above: threshold = ema*(1+delta%). If open > threshold, fill at open (gap up).
    - crosses_below: threshold = ema*(1-delta%). If open < threshold, fill at open (gap down).
    Falls back to close price for non-crossing rules.
    """
    for rule in rules:
        if rule.comparator not in ("crosses_above", "crosses_below"):
            continue
        comp_val = get_comparison_value(row, rule.value)
        if pd.isna(comp_val):
            continue
        delta_pct = getattr(rule, "delta_pct", 0.0) or 0.0
        open_price = float(row["open"])
        if rule.comparator == "crosses_above":
            threshold = apply_delta(comp_val, delta_pct, "above")
            # Gap up: price already opened above threshold → fill at open
            return open_price if open_price >= threshold else threshold
        else:
            threshold = apply_delta(comp_val, delta_pct, "below")
            # Gap down: price already opened below threshold → fill at open
            return open_price if open_price <= threshold else threshold
    return fallback_price


def seed_states_after_buy(rules: list) -> list[bool | None]:
    """
    After entering a long, seed crossing states so same-candle sell detection works.
    crosses_below sell → was_above = True  (we're above the sell threshold after buying)
    crosses_above sell → was_above = False (we just went high; need to dip and re-cross)
    """
    return [
        True  if r.comparator == "crosses_below" else
        False if r.comparator == "crosses_above" else None
        for r in rules
    ]


def seed_states_after_sell(rules: list) -> list[bool | None]:
    """
    After closing a long, seed crossing states so same-candle buy detection works.
    crosses_above buy → was_above = False (we're below the buy threshold after selling)
    crosses_below buy → was_above = True  (we just went low; need to rise and re-cross)
    """
    return [
        False if r.comparator == "crosses_above" else
        True  if r.comparator == "crosses_below" else None
        for r in rules
    ]


def run_backtest(df: pd.DataFrame, config: StrategyConfig) -> BacktestResultResponse:
    """Run the backtesting simulation."""
    exchange = getattr(config, "exchange", "binance") or "binance"
    fee_rate = EXCHANGE_FEES.get(exchange.lower(), EXCHANGE_FEES["binance"])
    position_size_pct = getattr(config, "position_size_pct", 100.0) or 100.0

    balance = config.initial_balance
    position: Position | None = None
    trades: list[TradeRecord] = []
    equity_curve: list[EquityPoint] = []
    total_fees = 0.0

    peak_equity = balance
    max_drawdown = 0.0
    first_trade_ts: str | None = None

    # Crossing state: None = uninitialised, True = was above threshold at last close
    buy_states: list[bool | None] = [None] * len(config.buy_rules)
    sell_states: list[bool | None] = [None] * len(config.sell_rules)
    filter_states: list[bool | None] = [None] * len(config.filters)

    for i in range(len(df)):
        row = df.iloc[i]
        timestamp = str(row["timestamp"])
        price = float(row["close"])

        # Equity = cash balance + current value of open position
        current_equity = balance + (position.qty * price if position else 0.0)

        # Only record equity curve from the first trade onward
        if first_trade_ts is not None:
            equity_curve.append(EquityPoint(timestamp=timestamp, equity=round(current_equity, 2)))

        # Track max drawdown
        if current_equity > peak_equity:
            peak_equity = current_equity
        drawdown = (peak_equity - current_equity) / peak_equity if peak_equity > 0 else 0
        if drawdown > max_drawdown:
            max_drawdown = drawdown

        # Evaluate filters (always update state)
        filter_triggered, filter_states = evaluate_rules_stateful(row, config.filters, filter_states)
        if config.filters and not filter_triggered:
            continue

        # Candle direction determines intra-candle order of HIGH and LOW:
        # bearish (close < open)  → HIGH first, LOW second  → buy then sell possible
        # bullish (close >= open) → LOW first, HIGH second  → sell then buy possible
        candle_is_bearish = float(row["close"]) < float(row["open"])

        # If not in position, check buy rules
        if position is None:
            buy_triggered, buy_states = evaluate_rules_stateful(row, config.buy_rules, buy_states)
            if buy_triggered:
                exec_price = get_execution_price(row, config.buy_rules, price)
                allocated = balance * (position_size_pct / 100.0)
                fee = allocated * fee_rate
                total_fees += fee
                invested = allocated - fee
                qty = invested / exec_price
                position = Position(
                    entry_price=exec_price,
                    entry_date=timestamp,
                    qty=qty,
                    highest_price=float(row["high"]),
                )
                balance -= allocated
                if first_trade_ts is None:
                    first_trade_ts = timestamp
                    equity_curve.append(EquityPoint(timestamp=timestamp, equity=round(balance + qty * exec_price, 2)))

                # Same-candle sell only valid on bearish candles (HIGH hit first → LOW hit second)
                if candle_is_bearish:
                    sell_states = seed_states_after_buy(config.sell_rules)
                    sell_triggered, sell_states = evaluate_rules_stateful(row, config.sell_rules, sell_states)
                    if sell_triggered:
                        sell_exec = get_execution_price(row, config.sell_rules, price)
                        gross = position.qty * sell_exec
                        sell_fee = gross * fee_rate
                        total_fees += sell_fee
                        proceeds = gross - sell_fee
                        balance += proceeds

                        entry_cost = position.entry_price * position.qty
                        pnl = proceeds - entry_cost * (1 + fee_rate)
                        pnl_pct = ((sell_exec / position.entry_price) - 1) * 100 - (fee_rate * 2 * 100)

                        trades.append(TradeRecord(
                            entry_date=position.entry_date,
                            exit_date=timestamp,
                            entry_price=round(position.entry_price, 2),
                            exit_price=round(sell_exec, 2),
                            pnl=round(pnl, 2),
                            pnl_pct=round(pnl_pct, 2),
                            exit_reason="sell_rule",
                        ))
                        position = None
                        buy_states = seed_states_after_sell(config.buy_rules)
                else:
                    # Bullish: LOW came first, HIGH came after buy — seed sell for next candle
                    sell_states = seed_states_after_buy(config.sell_rules)

        # If in position, check trailing stop and sell rules
        elif position is not None:
            # Update trailing stop high watermark
            position.highest_price = max(position.highest_price, float(row["high"]))

            # Check trailing stop
            trailing_stop_hit = False
            trailing_stop_price = None
            if config.trailing_stop_atr:
                atr_col = f"atr_{config.trailing_stop_atr_period}"
                atr_val = row.get(atr_col)
                if atr_val is not None and not pd.isna(atr_val):
                    stop_level = position.highest_price - config.trailing_stop_atr * float(atr_val)
                    if float(row["low"]) <= stop_level:
                        trailing_stop_hit = True
                        open_price = float(row["open"])
                        trailing_stop_price = open_price if open_price <= stop_level else stop_level

            sell_triggered, sell_states = evaluate_rules_stateful(row, config.sell_rules, sell_states)

            if trailing_stop_hit or sell_triggered:
                # Determine exit price and reason
                if trailing_stop_hit and sell_triggered:
                    rule_exec = get_execution_price(row, config.sell_rules, price)
                    exec_price = min(trailing_stop_price, rule_exec)
                    exit_reason = "trailing_stop" if exec_price == trailing_stop_price else "sell_rule"
                elif trailing_stop_hit:
                    exec_price = trailing_stop_price
                    exit_reason = "trailing_stop"
                else:
                    exec_price = get_execution_price(row, config.sell_rules, price)
                    exit_reason = "sell_rule"

                gross = position.qty * exec_price
                fee = gross * fee_rate
                total_fees += fee
                proceeds = gross - fee
                balance += proceeds

                entry_cost = position.entry_price * position.qty
                pnl = proceeds - entry_cost * (1 + fee_rate)
                pnl_pct = ((exec_price / position.entry_price) - 1) * 100 - (fee_rate * 2 * 100)

                trades.append(TradeRecord(
                    entry_date=position.entry_date,
                    exit_date=timestamp,
                    entry_price=round(position.entry_price, 2),
                    exit_price=round(exec_price, 2),
                    pnl=round(pnl, 2),
                    pnl_pct=round(pnl_pct, 2),
                    exit_reason=exit_reason,
                ))
                position = None

                # Same-candle re-buy only valid on bullish candles (LOW hit first → HIGH hit second)
                if not candle_is_bearish:
                    buy_states = seed_states_after_sell(config.buy_rules)
                    buy_triggered, buy_states = evaluate_rules_stateful(row, config.buy_rules, buy_states)
                    if buy_triggered:
                        buy_exec = get_execution_price(row, config.buy_rules, price)
                        allocated = balance * (position_size_pct / 100.0)
                        buy_fee = allocated * fee_rate
                        total_fees += buy_fee
                        invested = allocated - buy_fee
                        qty = invested / buy_exec
                        position = Position(
                            entry_price=buy_exec,
                            entry_date=timestamp,
                            qty=qty,
                            highest_price=float(row["high"]),
                        )
                        balance -= allocated
                        sell_states = seed_states_after_buy(config.sell_rules)
                else:
                    # Bearish: HIGH came first (sell already happened at LOW) — seed buy for next candle
                    buy_states = seed_states_after_sell(config.buy_rules)

    # If still in a position at the end, close at last price
    if position is not None:
        last_row = df.iloc[-1]
        price = float(last_row["close"])
        gross = position.qty * price
        fee = gross * fee_rate
        total_fees += fee
        proceeds = gross - fee
        balance += proceeds

        entry_cost = position.entry_price * position.qty
        pnl = proceeds - entry_cost * (1 + fee_rate)
        pnl_pct = ((price / position.entry_price) - 1) * 100 - (fee_rate * 2 * 100)

        trades.append(TradeRecord(
            entry_date=position.entry_date,
            exit_date=str(last_row["timestamp"]),
            entry_price=round(position.entry_price, 2),
            exit_price=round(price, 2),
            pnl=round(pnl, 2),
            pnl_pct=round(pnl_pct, 2),
            exit_reason="end_of_data",
        ))
        position = None

    final_balance = balance
    roi_pct = ((final_balance - config.initial_balance) / config.initial_balance) * 100
    winning = sum(1 for t in trades if t.pnl > 0)
    win_rate = (winning / len(trades) * 100) if trades else 0.0

    return BacktestResultResponse(
        final_balance=round(final_balance, 2),
        roi_pct=round(roi_pct, 2),
        win_rate=round(win_rate, 2),
        total_trades=len(trades),
        max_drawdown=round(max_drawdown * 100, 2),
        total_fees=round(total_fees, 2),
        trades=trades,
        equity_curve=equity_curve,
    )

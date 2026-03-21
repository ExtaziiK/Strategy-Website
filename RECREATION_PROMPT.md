# BTC Backtester — Full Recreation Prompt

Build a full-stack BTC trading strategy backtesting web application with the following architecture. Run the backend and frontend directly on the host machine (no Docker/containers).

---

## Tech Stack

**Backend:** Python 3.11+ with FastAPI, Uvicorn, Pandas, NumPy, `ta` (technical analysis library), CCXT (for fetching Binance data), Supabase Python client, Pydantic Settings, python-dotenv, pytest, httpx.

**Frontend:** Next.js 16+ (React 19, TypeScript 5), Tailwind CSS 4 (with `@tailwindcss/postcss`), Axios, `lightweight-charts` 5+ (TradingView charting library). Uses Geist and Geist_Mono Google fonts.

**Database:** Supabase (PostgreSQL). Requires `SUPABASE_URL` and `SUPABASE_KEY` environment variables in a `.env` file at the project root.

**Running locally:**
- Backend: `uvicorn app.main:app --reload --port 8000` (from the `backend/` directory)
- Frontend: `npm run dev` (from the `frontend/` directory, runs on port 3000)
- Frontend uses `NEXT_PUBLIC_API_URL` env var (defaults to `http://localhost:8000`)

---

## Project Structure

```
project-root/
├── .env                          # SUPABASE_URL, SUPABASE_KEY
├── .env.example
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models.py
│       ├── routers/
│       │   ├── strategies.py
│       │   └── backtest.py
│       ├── services/
│       │   ├── backtester.py
│       │   ├── data_fetcher.py
│       │   └── indicators.py
│       └── tests/
│           └── test_backtester.py
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── globals.css
│       │   └── strategy/
│       │       ├── new/page.tsx
│       │       └── [id]/
│       │           ├── edit/page.tsx
│       │           └── results/page.tsx
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── StrategyCard.tsx
│       │   ├── StrategyForm.tsx
│       │   ├── RuleRow.tsx
│       │   ├── BacktestChart.tsx
│       │   ├── EquityCurve.tsx
│       │   ├── MetricsPanel.tsx
│       │   └── TradeTable.tsx
│       └── lib/
│           ├── api.ts
│           └── types.ts
```

---

## Supabase Database Schema

Create these three tables in Supabase:

### `strategies`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, not auto-generated (app generates UUIDs) |
| name | text | |
| config | jsonb | Stores the full StrategyConfig object |
| created_at | timestamptz | Default: `now()` |

### `backtest_results`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| strategy_id | uuid | FK to strategies (nullable, for inline backtests) |
| final_balance | float8 | |
| roi_pct | float8 | |
| win_rate | float8 | |
| total_trades | int4 | |
| max_drawdown | float8 | |
| total_fees | float8 | |
| trades | jsonb | Array of TradeRecord objects |
| equity_curve | jsonb | Array of EquityPoint objects |
| created_at | timestamptz | Default: `now()` |

### `candles`
| Column | Type | Notes |
|--------|------|-------|
| timestamp | timestamptz | Part of composite PK |
| timeframe | text | Part of composite PK ("1h", "4h", "1d", "1w") |
| open | float8 | |
| high | float8 | |
| low | float8 | |
| close | float8 | |
| volume | float8 | |

Composite primary key on `(timestamp, timeframe)` for the candles table.

---

## Backend Details

### `app/main.py`
FastAPI app titled "BTC Backtester API". CORS middleware allowing origin `http://localhost:3000` with credentials, all methods, all headers. Includes two routers: `strategies` (prefix `/strategies`) and `backtest` (prefix `/backtest`). Has a `/health` endpoint returning `{"status": "ok"}`.

### `app/config.py`
Uses `pydantic_settings.BaseSettings` to load `supabase_url` and `supabase_key` from `.env` file. Both default to empty string.

### `app/database.py`
Singleton pattern: `get_supabase()` creates a Supabase client on first call using `create_client(settings.supabase_url, settings.supabase_key)` and caches it in a module-level `_client` variable.

### `app/models.py` — Pydantic Models

**StrategyRule:**
- `indicator: str` — one of: "ema", "rsi", "macd", "macd_signal", "macd_hist", "price"
- `params: dict = {}` — e.g. `{"period": 14}`
- `comparator: str` — one of: ">", "<", "crosses_above", "crosses_below"
- `value: float | str` — numeric threshold OR indicator reference like "ema_200", "price"
- `delta_pct: float = 0.0` — percentage offset applied to comparison value

**StrategyConfig:**
- `buy_rules: list[StrategyRule]`
- `sell_rules: list[StrategyRule]`
- `filters: list[StrategyRule] = []`
- `timeframe: str = "1h"` — one of "1h", "4h", "1d", "1w"
- `initial_balance: float = 10000.0`
- `exchange: str = "binance"` — one of "binance", "kraken", "hyperliquid"
- `position_size_pct: float = 100.0` — percentage of available balance per trade (1-100)
- `lookback_days: int = 365` — how many days of history

**StrategyCreate:** `name: str`, `config: StrategyConfig`

**StrategyLastResult:** Optional fields: `final_balance`, `roi_pct`, `win_rate`, `total_trades`, `max_drawdown`, `total_fees`

**StrategyResponse:** `id: str`, `name: str`, `config: StrategyConfig`, `created_at: Optional[str]`, `last_result: Optional[StrategyLastResult]`

**TradeRecord:** `entry_date: str`, `exit_date: str`, `entry_price: float`, `exit_price: float`, `pnl: float`, `pnl_pct: float`

**EquityPoint:** `timestamp: str`, `equity: float`

**BacktestRequest:** `strategy_id: Optional[str] = None`, `config: Optional[StrategyConfig] = None`

**BacktestResultResponse:** `id: Optional[str]`, `strategy_id: Optional[str]`, `final_balance`, `roi_pct`, `win_rate`, `total_trades: int`, `max_drawdown`, `total_fees`, `trades: list[TradeRecord]`, `equity_curve: list[EquityPoint]`

**CandleData:** `timestamp: str`, `open`, `high`, `low`, `close`, `volume` (all floats)

### `app/routers/strategies.py` — CRUD Endpoints

- `GET /strategies/` — Lists all strategies ordered by `created_at` desc. Also fetches the latest backtest result for each strategy from `backtest_results` table (non-fatal if this fails) and attaches as `last_result`.
- `GET /strategies/{strategy_id}` — Single strategy by ID.
- `POST /strategies/` — Creates strategy with app-generated UUID.
- `PUT /strategies/{strategy_id}` — Updates name and config.
- `DELETE /strategies/{strategy_id}` — Deletes strategy.

### `app/routers/backtest.py` — Backtest Endpoint

**`POST /backtest/`** — Accepts `BacktestRequest` (either `strategy_id` to load from DB, or inline `config`). Flow:
1. Resolve config (from DB if strategy_id provided, or use inline config)
2. Fetch BTC/USDT data via `get_btc_data()` (tries Supabase cache first, then Binance)
3. Compute indicators needed by all rules
4. Run backtest engine
5. Save result to `backtest_results` table (non-fatal if fails)
6. Return `{ result, candles, indicators }` where:
   - `result` is the BacktestResultResponse
   - `candles` is array of OHLCV data
   - `indicators` is a dict mapping column names (e.g. "ema_20", "rsi_14", "macd") to arrays of `{timestamp, value}` (NaN values filtered out)

**`GET /backtest/{strategy_id}`** — Returns the most recent backtest result for a strategy from `backtest_results` table.

### `app/services/data_fetcher.py`

**`fetch_btc_data(timeframe, lookback_days)`** — Fetches BTC/USDT OHLCV from Binance via CCXT with pagination (1000 candles per request, loops until all data fetched). Returns a DataFrame with columns: timestamp (datetime UTC), open, high, low, close, volume. Deduplicates and sorts by timestamp.

**`try_load_from_supabase(supabase_client, timeframe, lookback_days)`** — Tries to load cached candles from Supabase `candles` table. Returns DataFrame if >100 rows found, else None.

**`cache_to_supabase(supabase_client, df, timeframe)`** — Upserts candle data to Supabase with `on_conflict="timestamp,timeframe"`.

**`get_btc_data(timeframe, lookback_days, supabase_client)`** — Orchestrator: tries cache first, falls back to live fetch, caches result.

### `app/services/indicators.py`

Uses the `ta` library:
- `add_ema(df, period)` — Adds `ema_{period}` column using `ta.trend.EMAIndicator`
- `add_rsi(df, period)` — Adds `rsi_{period}` column using `ta.momentum.RSIIndicator`
- `add_macd(df)` — Adds `macd`, `macd_signal`, `macd_hist` columns using `ta.trend.MACD`
- `compute_indicators(df, rules)` — Scans all rules (including their `value` fields for indicator references) and adds only the needed indicator columns. Tracks which indicators have been added to avoid duplicates.

### `app/services/backtester.py` — Core Engine

This is the most complex part. Key behaviors:

**Exchange fee rates (taker/market order):**
- Binance: 0.10% (0.001)
- Kraken: 0.26% (0.0026)
- Hyperliquid: 0.035% (0.00035)

**Indicator value resolution:**
- `price` → uses `close` price
- `ema` → uses `ema_{period}` column
- `rsi` → uses `rsi_{period}` column
- `macd`/`macd_signal`/`macd_hist` → uses respective columns

**Comparison value resolution:** Can be a number or a string reference to another indicator (e.g. "ema_200", "price", "macd_signal"). Parsed dynamically.

**Delta % offset:** For `>` comparator, shifts the comparison value UP by delta%. For `<` comparator, shifts DOWN. For `crosses_above`, shifts UP. For `crosses_below`, shifts DOWN. Formula: `comp_val * (1 ± delta_pct / 100)`.

**Stateful crossing detection:**
- Each crossing rule maintains a state (`was_above`: True/False/None)
- `None` = first candle, initialize state without triggering
- `crosses_above`: triggers when state was False (below) and current trigger value >= threshold
- `crosses_below`: triggers when state was True (above) and current trigger value <= threshold
- State is updated at each candle close
- For price indicator crossing: trigger value uses `max(open, high)` for crosses_above, `min(open, low)` for crosses_below. For other indicators: uses the close-based indicator value.
- Close state is always based on the close-based indicator value (or close price for price indicator)

**Execution price logic:**
- For crossing rules: fills at the threshold price, OR at the open price if it gapped past the threshold
  - `crosses_above`: if open >= threshold, fill at open (gap up); else fill at threshold
  - `crosses_below`: if open <= threshold, fill at open (gap down); else fill at threshold
- For non-crossing rules (`>`, `<`): fills at close price

**Intra-candle (same-candle) execution:**
- Candle direction determines HIGH/LOW order within a candle:
  - Bearish candle (close < open): HIGH hit first, then LOW → allows buy-then-sell on same candle
  - Bullish candle (close >= open): LOW hit first, then HIGH → allows sell-then-buy on same candle
- After buying, sell states are seeded: `crosses_below` → `was_above=True`, `crosses_above` → `was_above=False`
- After selling, buy states are seeded: `crosses_above` → `was_above=False`, `crosses_below` → `was_above=True`

**Position management:**
- Only one position at a time (long only)
- Position size = `balance * (position_size_pct / 100)`
- Entry fee deducted from allocated amount: `fee = allocated * fee_rate`, `invested = allocated - fee`, `qty = invested / exec_price`
- Exit: `gross = qty * exec_price`, `fee = gross * fee_rate`, `proceeds = gross - fee`
- PnL: `proceeds - entry_cost * (1 + fee_rate)`
- PnL%: `((exit_price / entry_price) - 1) * 100 - (fee_rate * 2 * 100)`

**Equity curve:** Only recorded from the first trade onward. Equity = cash balance + (qty * current_close_price).

**Max drawdown:** Tracked as `(peak_equity - current_equity) / peak_equity`, reported as percentage.

**End-of-data:** If still in a position at the last candle, force-close at last close price (with exit fee).

**Filters:** Evaluated every candle (always update state). If filters exist and aren't all triggered, skip the candle entirely (no buy/sell evaluation).

**Return value:** `BacktestResultResponse` with final_balance, roi_pct, win_rate, total_trades, max_drawdown (as %), total_fees, trades list, equity_curve list.

---

## Frontend Details

### Global Styling
- Dark theme: `bg-gray-950 text-white` on body, `<html className="dark">`
- Tailwind CSS 4 with `@import "tailwindcss"` in globals.css
- Custom CSS variables for background/foreground with dark mode media query
- Geist and Geist_Mono fonts from Google Fonts
- Layout: Navbar at top, main content in `max-w-7xl mx-auto px-6 py-8`

### `lib/types.ts` — TypeScript Interfaces & Constants

Mirrors the backend models. Also exports:
- `INDICATORS = ["price", "ema", "rsi", "macd", "macd_signal", "macd_hist"]`
- `COMPARATORS = [">", "<", "crosses_above", "crosses_below"]`
- `TIMEFRAMES = ["1h", "4h", "1d", "1w"]`
- `EXCHANGES = [{ value: "binance", label: "Binance (0.10%)" }, { value: "kraken", label: "Kraken (0.26%)" }, { value: "hyperliquid", label: "Hyperliquid (0.035%)" }]`
- `LOOKBACK_OPTIONS = [6mo (182d), 1y (365d), 2y (730d), 3y (1095d), 4y (1460d), 5y (1825d), 6y (2190d), 7y (2555d), 8y (2920d)]`
- `emptyRule()` — returns default RSI < 30 rule
- `emptyConfig()` — returns default config with RSI<30 buy, RSI>70 sell, 1h, $10k, binance, 100%, 1 year

### `lib/api.ts` — Axios API Client

Base URL from `NEXT_PUBLIC_API_URL` env var, defaults to `http://localhost:8000`. Functions:
- `getStrategies()` — GET /strategies/
- `getStrategy(id)` — GET /strategies/{id}
- `createStrategy(name, config)` — POST /strategies/
- `updateStrategy(id, name, config)` — PUT /strategies/{id}
- `deleteStrategy(id)` — DELETE /strategies/{id}
- `runBacktest({ strategy_id?, config? })` — POST /backtest/
- `getBacktestResult(strategyId)` — GET /backtest/{strategyId}

### Pages

**Dashboard (`/`):** Lists all saved strategies as cards in a 2-column grid. Each card shows strategy name, timeframe, balance, rule counts, creation date, and last backtest results (final balance, ROI, win rate, trades, max drawdown, fees). Cards have View Results, Edit, Delete buttons. "+ New Strategy" button at top. Shows loading state, error state, and empty state.

**Create Strategy (`/strategy/new`):** Contains a StrategyForm and optional compare mode. Compare mode shows two forms side-by-side (Strategy A and Strategy B). Each has a "Run Backtest" button that runs an inline backtest (without saving) and displays results below. Strategy A also has a "Save Strategy" button that saves and redirects to results page. Results include MetricsPanel, BacktestChart, EquityCurve, and TradeTable.

**Edit Strategy (`/strategy/[id]/edit`):** Loads existing strategy, pre-fills StrategyForm. "Update Strategy" saves changes and redirects to dashboard. Has inline backtest preview.

**Results (`/strategy/[id]/results`):** Loads strategy and immediately runs a backtest. Shows loading spinner, then displays strategy name, timeframe, initial balance, MetricsPanel, Price Chart (BacktestChart), Equity Curve, and Trade History table. Has Edit Strategy and Back links.

### Components

**Navbar:** Simple top bar with "BTC Backtester" brand link, Dashboard and New Strategy nav links. Dark styling with `border-b border-gray-800 bg-gray-950`.

**StrategyCard:** Card for dashboard. Shows strategy name, timeframe, balance, rule counts, created date. If `last_result` exists, shows a 3×2 grid of metrics (Final Balance, ROI, Win Rate, Total Trades, Max Drawdown, Fees Paid) with color coding. Note: win_rate from the backend is 0-100 but the card displays `(r.win_rate * 100).toFixed(1)%` — this is a known display quirk. Action buttons: View Results, Edit, Delete.

**StrategyForm:** The main rule-builder form. Fields:
- Strategy Name (text input)
- 5-column grid: Timeframe (select), Initial Balance (number), Exchange/Fees (select), Position Size % (number, clamped 1-100), Backtest Period (select from LOOKBACK_OPTIONS)
- Buy Rules section (green heading) with add/remove rule buttons
- Sell Rules section (red heading) with add/remove rule buttons
- Strategy Filters section (yellow heading) with add/remove rule buttons
- Action buttons: Save Strategy (blue, if `onSubmit` provided) and Run Backtest (green, if `onRunBacktest` provided)

**RuleRow:** A single rule configuration row with inline controls:
- Indicator dropdown (PRICE, EMA, RSI, MACD, MACD_SIGNAL, MACD_HIST)
- Period input (only for EMA/RSI)
- Comparator dropdown (>, <, crosses above, crosses below)
- Value: For crossing comparators → dropdown with preset refs (ema_10, ema_20, ema_50, ema_100, ema_200, price) plus "Custom EMA..." option (shows additional period input). For non-crossing → plain text/number input.
- Delta % input (only for crossing comparators, step 0.1, min 0)
- Remove button (×)

**BacktestChart:** TradingView-style candlestick chart using `lightweight-charts`. Features:
- Dark theme (bg #111827, text #9ca3af, grid #1f2937)
- 500px height, responsive width
- Green/red candlesticks
- EMA overlay lines with color mapping: ema_10=#f59e0b (amber), ema_20=#3b82f6 (blue), ema_50=#8b5cf6 (purple), ema_100=#ec4899 (pink), ema_200=#ef4444 (red). Other EMAs get #6b7280 (gray).
- Trade markers: Buy arrows (green, arrowUp, "inBar" position) on invisible line series at entry prices. Sell arrows (red, arrowDown) on separate invisible line series at exit prices. Uses `createSeriesMarkers()` API. Both series are deduplicated by timestamp and sorted.
- Time scale: timeVisible, fits content

**EquityCurve:** Area chart using `lightweight-charts`. 250px height. Color is green if final equity >= initial balance, red otherwise. Shows a dashed baseline line at initial balance. Same dark theme.

**MetricsPanel:** 6-column responsive grid of metric cards:
- Final Balance (green if >= initial, red if less)
- ROI (green if positive, red if negative, shows +/- prefix)
- Win Rate (green if >= 50%, yellow otherwise)
- Total Trades (white)
- Max Drawdown (red if > 20%, yellow otherwise)
- Total Fees Paid (orange)

**TradeTable:** Full trade history table with columns: #, Entry Date, Exit Date, Entry Price, Exit Price, P&L, P&L %. Best trade (highest PnL) highlighted with green border/background and ▲ marker. Worst trade highlighted with red border/background and ▼ marker. P&L values color-coded green/red. Legend at top showing best/worst indicators. Shows "No trades were executed." if empty.

---

## Key Implementation Notes

1. All "use client" components — the app is mostly client-rendered.
2. The backend `.env` file should be at the project root (not inside `backend/`). The `config.py` resolves it via `env_file = ".env"`.
3. The Supabase client is optional for the backtest endpoint — if it can't connect, it just skips caching and result saving.
4. CCXT uses Binance public API (no API key needed for OHLCV data). Rate limiting is enabled.
5. The backtester is long-only (no shorting). One position at a time.
6. All timestamps are UTC.
7. The frontend converts timestamps to Unix seconds for lightweight-charts (`Math.floor(new Date(dateStr).getTime() / 1000)`).

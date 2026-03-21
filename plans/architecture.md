# BTC Trading Strategy Backtesting Web App

A Next.js frontend with FastAPI + Pandas backend for backtesting BTC strategies on historical Binance data.

## User Review Required

> [!TIP]
> **Historical Data Strategy**
> For the MVP, it's best to fetch historical Binance data on-demand if missing and cache it locally or in Supabase, reducing API friction and making subsequent backtests blazing fast. I plan to use the `ccxt` library for fetching Binance data. Does this approach work for you?

## Proposed Architecture

1. **Frontend**: Next.js (App Router), React, TailwindCSS.
2. **Charts**: TradingView Lightweight Charts. Free, fast, and optimized for overlaying indicators and buy/sell signals on candlesticks.
3. **Backend**: FastAPI (Python) for API handling.
4. **Data Analytics engine**: Pandas, NumPy, and `ta` (Technical Analysis library) for fast vectorized indicator calculation and backtesting simulation.
5. **Database**: **Supabase** (Managed PostgreSQL). This is an excellent choice for a side project as it provides a generous free tier, saving hosting costs while still offering all the power of PostgreSQL. We will use the Supabase Python client in the FastAPI backend to read/write data.

## Proposed Changes

We will divide the project `c:\Users\ExtaziK\Documents\backtesting website` into two main directories: `backend/` and `frontend/`.

### 1. Database Schema (Supabase)
- **`Strategy` table**: Stores user's configured strategy rules (JSON), timeframe, initial balance.
- **`BacktestResult` table**: Stores the output of a backtest linked to a Strategy, including final balance, ROI%, win rate, and list of trades.

### 2. Backend Engine (FastAPI + Pandas)
- **Data Ingestion**: A module pulling `BTC/USDT` data from Binance API (`1h`, `4h`, `1D`, `1W`).
- **Indicator Module**: Calculates EMA, RSI, and MACD on the fetched pandas DataFrames.
- **Simulation Engine**: 
  - Iterates over the dataframe to evaluate *Buy Conditions*, *Sell Conditions*, and *Strategy Filters* (e.g., BTC > EMA 200).
  - Simulates opening/closing long spot trades with a 0.1% fee.
- **API**: Endpoints for Strategy CRUD operations, communicating with Supabase, and triggering backtesting.

### 3. Frontend App (Next.js)
- **`Dashboard`**: Homepage listing past strategies and quick results.
- **`Strategy Builder`**: The no-code visual interface containing blocks for Buy Rules, Sell Rules, and the additional "Strategy Filters" you requested.
- **`Results Page`**: Uses TradingView Lightweight charts to show candles, indicator overlays, and trade entry/exit markers. Features a trade breakdown table beneath the chart.

### 4. Deployment Setup
- A `docker-compose.yml` file configuring the Next.js service and the FastAPI service. Supabase handles the database remotely, so we don't need a local DB service in the docker-compose for production (though we can use Supabase CLI for local dev if needed, or just point to a remote dev project).

## Verification Plan

### Automated Tests
- Short localized tests inside the python backend against a static mocked dataset to ensure the backtest logic (win-rate, fees, conditions) works correctly mathematically.

### Manual Verification
- We will boot the full stack via Docker.
- Create an example strategy: BUY when MACD crosses above signal AND Strategy Filter: Price > 200 EMA. 
- Ensure the results populate clearly in the UI, math checks out with expected ROI, and chart indicators plot natively.

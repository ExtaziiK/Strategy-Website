"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getStrategy, runBacktest } from "@/lib/api";
import { Strategy, BacktestResponse } from "@/lib/types";
import MetricsPanel from "@/components/MetricsPanel";
import BacktestChart from "@/components/BacktestChart";
import EquityCurve from "@/components/EquityCurve";
import TradeTable from "@/components/TradeTable";

export default function ResultsPage() {
  const params = useParams();
  const id = params.id as string;
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndRun = async () => {
      try {
        const strat = await getStrategy(id);
        setStrategy(strat);
        const result = await runBacktest({ strategy_id: id });
        setData(result);
      } catch (err: any) {
        setError(err?.response?.data?.detail || "Failed to run backtest");
      } finally {
        setLoading(false);
      }
    };
    fetchAndRun();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="mt-4 text-gray-400">Running backtest...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-6 text-red-400">
        <p className="font-semibold">Error</p>
        <p>{error}</p>
        <Link href="/" className="mt-4 inline-block text-blue-400 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!data || !strategy) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{strategy.name}</h1>
          <p className="mt-1 text-gray-400">
            Timeframe: {strategy.config.timeframe.toUpperCase()} &middot; Initial Balance: $
            {strategy.config.initial_balance.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/strategy/${id}/edit`}
            className="rounded bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600 transition"
          >
            Edit Strategy
          </Link>
          <Link
            href="/"
            className="rounded bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition"
          >
            Back
          </Link>
        </div>
      </div>

      <MetricsPanel
        result={data.result}
        initialBalance={strategy.config.initial_balance}
      />

      <div>
        <h2 className="text-xl font-semibold mb-4">Price Chart</h2>
        <BacktestChart
          candles={data.candles}
          indicators={data.indicators}
          trades={data.result.trades}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Equity Curve</h2>
        <EquityCurve
          data={data.result.equity_curve}
          initialBalance={strategy.config.initial_balance}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">
          Trade History ({data.result.total_trades} trades)
        </h2>
        <TradeTable trades={data.result.trades} />
      </div>
    </div>
  );
}

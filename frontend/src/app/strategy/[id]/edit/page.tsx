"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StrategyForm from "@/components/StrategyForm";
import { getStrategy, updateStrategy, runBacktest } from "@/lib/api";
import { Strategy, StrategyConfig, BacktestResponse } from "@/lib/types";
import MetricsPanel from "@/components/MetricsPanel";
import BacktestChart from "@/components/BacktestChart";
import EquityCurve from "@/components/EquityCurve";
import TradeTable from "@/components/TradeTable";

export default function EditStrategyPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [backtestData, setBacktestData] = useState<BacktestResponse | null>(null);
  const [backtestConfig, setBacktestConfig] = useState<StrategyConfig | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [showTrades, setShowTrades] = useState(false);

  useEffect(() => {
    getStrategy(id)
      .then(setStrategy)
      .catch(() => alert("Strategy not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (name: string, config: StrategyConfig) => {
    await updateStrategy(id, name, config);
    router.push("/");
  };

  const handleRunBacktest = async (name: string, config: StrategyConfig) => {
    const data = await runBacktest({ config });
    setBacktestData(data);
    setBacktestConfig(config);
  };

  if (loading) return <p className="text-gray-400">Loading strategy...</p>;
  if (!strategy) return <p className="text-red-400">Strategy not found</p>;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Edit Strategy</h1>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 transition"
        >
          {panelOpen ? "Hide Config" : "Show Config"}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Results area */}
        <div className="flex-1 min-w-0">
          {backtestData && backtestConfig ? (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold">Backtest Preview</h2>
              <MetricsPanel
                result={backtestData.result}
                initialBalance={backtestConfig.initial_balance}
              />
              <BacktestChart
                candles={backtestData.candles}
                indicators={backtestData.indicators}
                trades={backtestData.result.trades}
              />
              <div>
                <h3 className="text-xl font-semibold mb-4">Equity Curve</h3>
                <EquityCurve
                  data={backtestData.result.equity_curve}
                  initialBalance={backtestConfig.initial_balance}
                />
              </div>
              <div>
                <button
                  onClick={() => setShowTrades(!showTrades)}
                  className="flex items-center gap-2 text-xl font-semibold mb-4 hover:text-gray-300 transition"
                >
                  <span
                    className="inline-block transition-transform"
                    style={{ transform: showTrades ? "rotate(90deg)" : "rotate(0deg)" }}
                  >
                    &#9654;
                  </span>
                  Trade History ({backtestData.result.trades.length})
                </button>
                {showTrades && <TradeTable trades={backtestData.result.trades} />}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-800 p-12 text-center text-gray-500">
              Run a backtest to see results here.
            </div>
          )}
        </div>

        {/* Side panel */}
        <div
          className={`shrink-0 transition-all duration-300 overflow-hidden ${
            panelOpen ? "w-[420px] opacity-100" : "w-0 opacity-0"
          }`}
        >
          <div className="w-[420px] h-[calc(100vh-140px)] sticky top-24">
            <div className="h-full rounded-lg border border-gray-800 bg-gray-900/30 p-4 overflow-hidden">
              <StrategyForm
                initialName={strategy.name}
                initialConfig={strategy.config}
                onSubmit={handleSubmit}
                onRunBacktest={handleRunBacktest}
                submitLabel="Update Strategy"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

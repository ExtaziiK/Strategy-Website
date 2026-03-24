"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import StrategyForm from "@/components/StrategyForm";
import { createStrategy, runBacktest } from "@/lib/api";
import { StrategyConfig, BacktestResponse } from "@/lib/types";
import MetricsPanel from "@/components/MetricsPanel";
import BacktestChart from "@/components/BacktestChart";
import EquityCurve from "@/components/EquityCurve";
import TradeTable from "@/components/TradeTable";

interface BacktestSlot {
  data: BacktestResponse;
  config: StrategyConfig;
  name: string;
}

function BacktestResults({
  slot,
  label,
  showTrades,
  onToggleTrades,
}: {
  slot: BacktestSlot;
  label?: string;
  showTrades: boolean;
  onToggleTrades: () => void;
}) {
  return (
    <div className="space-y-6">
      {label && <h3 className="text-xl font-bold text-white">{label}</h3>}
      <MetricsPanel result={slot.data.result} initialBalance={slot.config.initial_balance} />
      <BacktestChart
        candles={slot.data.candles}
        indicators={slot.data.indicators}
        trades={slot.data.result.trades}
      />
      <div>
        <h4 className="text-lg font-semibold mb-3">Equity Curve</h4>
        <EquityCurve data={slot.data.result.equity_curve} initialBalance={slot.config.initial_balance} />
      </div>
      <div>
        <button
          onClick={onToggleTrades}
          className="flex items-center gap-2 text-lg font-semibold mb-3 hover:text-gray-300 transition"
        >
          <span
            className="inline-block transition-transform"
            style={{ transform: showTrades ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            &#9654;
          </span>
          Trade History ({slot.data.result.trades.length})
        </button>
        {showTrades && <TradeTable trades={slot.data.result.trades} />}
      </div>
    </div>
  );
}

export default function NewStrategyPage() {
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [showTradesA, setShowTradesA] = useState(false);
  const [showTradesB, setShowTradesB] = useState(false);

  // Strategy A
  const [slotA, setSlotA] = useState<BacktestSlot | null>(null);
  // Strategy B (compare only)
  const [slotB, setSlotB] = useState<BacktestSlot | null>(null);

  const handleSubmit = async (name: string, config: StrategyConfig) => {
    const strategy = await createStrategy(name, config);
    router.push(`/strategy/${strategy.id}/results`);
  };

  const handleRunBacktestA = async (name: string, config: StrategyConfig) => {
    const data = await runBacktest({ config });
    setSlotA({ data, config, name });
  };

  const handleRunBacktestB = async (name: string, config: StrategyConfig) => {
    const data = await runBacktest({ config });
    setSlotB({ data, config, name });
  };

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create Strategy</h1>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setCompareMode((v) => !v);
              setSlotB(null);
            }}
            className={`rounded px-4 py-2 text-sm font-medium transition ${
              compareMode
                ? "bg-purple-700 text-white hover:bg-purple-600"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {compareMode ? "Exit Compare" : "Compare"}
          </button>
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 transition"
          >
            {panelOpen ? "Hide Config" : "Show Config"}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex gap-6">
        {/* Results area — takes full width when panel is closed */}
        <div className={`flex-1 min-w-0 transition-all duration-300 ${panelOpen ? "mr-0" : ""}`}>
          {compareMode ? (
            (slotA || slotB) ? (
              <div>
                <h2 className="text-2xl font-bold mb-6">Comparison</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    {slotA ? (
                      <BacktestResults
                        slot={slotA}
                        label={`A — ${slotA.name}`}
                        showTrades={showTradesA}
                        onToggleTrades={() => setShowTradesA(!showTradesA)}
                      />
                    ) : (
                      <div className="rounded-lg border border-gray-800 p-8 text-center text-gray-500">
                        Run backtest for Strategy A
                      </div>
                    )}
                  </div>
                  <div>
                    {slotB ? (
                      <BacktestResults
                        slot={slotB}
                        label={`B — ${slotB.name}`}
                        showTrades={showTradesB}
                        onToggleTrades={() => setShowTradesB(!showTradesB)}
                      />
                    ) : (
                      <div className="rounded-lg border border-gray-800 p-8 text-center text-gray-500">
                        Run backtest for Strategy B
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-800 p-12 text-center text-gray-500">
                Configure your strategies in the panel and run backtests to see results here.
              </div>
            )
          ) : slotA ? (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold">Backtest Preview</h2>
              <BacktestResults
                slot={slotA}
                showTrades={showTradesA}
                onToggleTrades={() => setShowTradesA(!showTradesA)}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-gray-800 p-12 text-center text-gray-500">
              Configure your strategy in the panel and run a backtest to see results here.
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
            {compareMode ? (
              <div className="h-full flex flex-col gap-4">
                {/* Strategy A panel */}
                <div className="flex-1 rounded-lg border border-gray-800 bg-gray-900/30 p-4 overflow-hidden">
                  <h2 className="text-sm font-semibold text-purple-400 mb-3">Strategy A</h2>
                  <StrategyForm
                    onSubmit={handleSubmit}
                    onRunBacktest={handleRunBacktestA}
                    submitLabel="Save A"
                  />
                </div>
                {/* Strategy B panel */}
                <div className="flex-1 rounded-lg border border-gray-800 bg-gray-900/30 p-4 overflow-hidden">
                  <h2 className="text-sm font-semibold text-yellow-400 mb-3">Strategy B</h2>
                  <StrategyForm onRunBacktest={handleRunBacktestB} />
                </div>
              </div>
            ) : (
              <div className="h-full rounded-lg border border-gray-800 bg-gray-900/30 p-4 overflow-hidden">
                <StrategyForm
                  onSubmit={handleSubmit}
                  onRunBacktest={handleRunBacktestA}
                  submitLabel="Save Strategy"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

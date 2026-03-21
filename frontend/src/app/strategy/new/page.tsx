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

function BacktestResults({ slot, label }: { slot: BacktestSlot; label?: string }) {
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
        <h4 className="text-lg font-semibold mb-3">Trade History</h4>
        <TradeTable trades={slot.data.result.trades} />
      </div>
    </div>
  );
}

export default function NewStrategyPage() {
  const router = useRouter();
  const [compareMode, setCompareMode] = useState(false);

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
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Create Strategy</h1>
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
          {compareMode ? "Exit Compare Mode" : "Compare Strategies"}
        </button>
      </div>

      {compareMode ? (
        /* ── Compare mode: two forms side by side ── */
        <div className="grid grid-cols-2 gap-6">
          {/* Strategy A */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-purple-400">Strategy A</h2>
            <StrategyForm
              onSubmit={handleSubmit}
              onRunBacktest={handleRunBacktestA}
              submitLabel="Save Strategy A"
            />
          </div>
          {/* Strategy B */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-yellow-400">Strategy B</h2>
            <StrategyForm onRunBacktest={handleRunBacktestB} />
          </div>
        </div>
      ) : (
        /* ── Normal mode ── */
        <StrategyForm
          onSubmit={handleSubmit}
          onRunBacktest={handleRunBacktestA}
          submitLabel="Save Strategy"
        />
      )}

      {/* ── Results ── */}
      {compareMode ? (
        (slotA || slotB) && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Comparison</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                {slotA ? (
                  <BacktestResults slot={slotA} label={`A — ${slotA.name}`} />
                ) : (
                  <div className="rounded-lg border border-gray-800 p-8 text-center text-gray-500">
                    Run backtest for Strategy A
                  </div>
                )}
              </div>
              <div>
                {slotB ? (
                  <BacktestResults slot={slotB} label={`B — ${slotB.name}`} />
                ) : (
                  <div className="rounded-lg border border-gray-800 p-8 text-center text-gray-500">
                    Run backtest for Strategy B
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        slotA && (
          <div className="mt-12 space-y-8">
            <h2 className="text-2xl font-bold">Backtest Preview</h2>
            <BacktestResults slot={slotA} />
          </div>
        )
      )}
    </div>
  );
}

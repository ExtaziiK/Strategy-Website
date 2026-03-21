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
    <div>
      <h1 className="text-3xl font-bold mb-8">Edit Strategy</h1>
      <StrategyForm
        initialName={strategy.name}
        initialConfig={strategy.config}
        onSubmit={handleSubmit}
        onRunBacktest={handleRunBacktest}
        submitLabel="Update Strategy"
      />

      {backtestData && backtestConfig && (
        <div className="mt-12 space-y-8">
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
            <h3 className="text-xl font-semibold mb-4">Trade History</h3>
            <TradeTable trades={backtestData.result.trades} />
          </div>
        </div>
      )}
    </div>
  );
}

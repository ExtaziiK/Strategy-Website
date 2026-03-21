"use client";
import { BacktestResult } from "@/lib/types";

interface Props {
  result: BacktestResult;
  initialBalance: number;
}

export default function MetricsPanel({ result, initialBalance }: Props) {
  const metrics = [
    {
      label: "Final Balance",
      value: `$${result.final_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      color: result.final_balance >= initialBalance ? "text-green-400" : "text-red-400",
    },
    {
      label: "ROI",
      value: `${result.roi_pct >= 0 ? "+" : ""}${result.roi_pct.toFixed(2)}%`,
      color: result.roi_pct >= 0 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Win Rate",
      value: `${result.win_rate.toFixed(1)}%`,
      color: result.win_rate >= 50 ? "text-green-400" : "text-yellow-400",
    },
    {
      label: "Total Trades",
      value: result.total_trades.toString(),
      color: "text-white",
    },
    {
      label: "Max Drawdown",
      value: `${result.max_drawdown.toFixed(2)}%`,
      color: result.max_drawdown > 20 ? "text-red-400" : "text-yellow-400",
    },
    {
      label: "Total Fees Paid",
      value: `$${result.total_fees.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      color: "text-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">{m.label}</p>
          <p className={`mt-1 text-2xl font-bold ${m.color}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}

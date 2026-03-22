"use client";
import Link from "next/link";
import { Strategy } from "@/lib/types";

interface Props {
  strategy: Strategy;
  onDelete: (id: string) => void;
}

export default function StrategyCard({ strategy, onDelete }: Props) {
  const r = strategy.last_result;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white">{strategy.name}</h3>
          <p className="mt-1 text-sm text-gray-400">
            Timeframe: {strategy.config.timeframe.toUpperCase()} &middot;{" "}
            Balance: ${strategy.config.initial_balance.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {strategy.config.buy_rules.length} buy rule(s) &middot;{" "}
            {strategy.config.sell_rules.length} sell rule(s) &middot;{" "}
            {strategy.config.filters.length} filter(s)
          </p>
          {strategy.created_at && (
            <p className="mt-2 text-xs text-gray-600">
              Created: {new Date(strategy.created_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {r ? (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-gray-800 bg-gray-950 p-3">
          <div>
            <p className="text-xs text-gray-500">Final Balance</p>
            <p className="text-sm font-semibold text-white">${r.final_balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">ROI</p>
            <p className={`text-sm font-semibold ${r.roi_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
              {r.roi_pct >= 0 ? "+" : ""}{r.roi_pct.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Win Rate</p>
            <p className="text-sm font-semibold text-white">{r.win_rate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Trades</p>
            <p className="text-sm font-semibold text-white">{r.total_trades}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Max Drawdown</p>
            <p className="text-sm font-semibold text-red-400">-{r.max_drawdown.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fees Paid</p>
            <p className="text-sm font-semibold text-orange-400">
              {r.total_fees != null ? `$${r.total_fees.toFixed(2)}` : "—"}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-gray-600 italic">No backtest run yet</p>
      )}

      <div className="mt-4 flex gap-3">
        <Link
          href={`/strategy/${strategy.id}/results`}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition"
        >
          View Results
        </Link>
        <Link
          href={`/strategy/${strategy.id}/edit`}
          className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 transition"
        >
          Edit
        </Link>
        <button
          onClick={() => onDelete(strategy.id)}
          className="rounded bg-red-900/50 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

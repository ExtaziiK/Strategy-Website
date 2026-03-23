"use client";
import { TradeRecord } from "@/lib/types";

interface Props {
  trades: TradeRecord[];
}

export default function TradeTable({ trades }: Props) {
  if (trades.length === 0) {
    return <p className="text-gray-500 italic">No trades were executed.</p>;
  }

  const maxPnlIndex = trades.reduce((best, t, i) => t.pnl > trades[best].pnl ? i : best, 0);
  const maxDrawdownIndex = trades.reduce((worst, t, i) => t.pnl < trades[worst].pnl ? i : worst, 0);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 mb-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500/30 border border-green-500"></span>
          Best trade
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500/30 border border-red-500"></span>
          Worst trade
        </span>
      </div>
      <table className="w-full text-sm text-left">
        <thead className="border-b border-gray-800 text-gray-400">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Entry Date</th>
            <th className="px-4 py-3">Exit Date</th>
            <th className="px-4 py-3 text-right">Entry Price</th>
            <th className="px-4 py-3 text-right">Exit Price</th>
            <th className="px-4 py-3 text-right">P&L</th>
            <th className="px-4 py-3 text-right">P&L %</th>
            <th className="px-4 py-3">Exit Reason</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, i) => {
            const isBest = i === maxPnlIndex;
            const isWorst = i === maxDrawdownIndex;
            const rowClass = isBest
              ? "border border-green-500/60 bg-green-500/10"
              : isWorst
              ? "border border-red-500/60 bg-red-500/10"
              : "border-b border-gray-800/50 hover:bg-gray-800/30";

            return (
              <tr key={i} className={rowClass}>
                <td className="px-4 py-3 text-gray-400">
                  {i + 1}
                  {isBest && <span className="ml-2 text-green-400 font-bold" title="Highest PnL">▲</span>}
                  {isWorst && <span className="ml-2 text-red-400 font-bold" title="Max Drawdown">▼</span>}
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {new Date(trade.entry_date).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {new Date(trade.exit_date).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-white">
                  ${trade.entry_price.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-white">
                  ${trade.exit_price.toLocaleString()}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${trade.pnl_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {trade.pnl_pct >= 0 ? "+" : ""}{trade.pnl_pct.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {trade.exit_reason === "trailing_stop" ? (
                    <span className="text-orange-400">Trailing Stop</span>
                  ) : trade.exit_reason === "end_of_data" ? (
                    <span className="text-gray-500">End of Data</span>
                  ) : trade.exit_reason === "sell_rule" ? (
                    "Sell Rule"
                  ) : (
                    ""
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";
import { useState } from "react";
import { StrategyConfig, StrategyRule, TIMEFRAMES, EXCHANGES, LOOKBACK_OPTIONS, emptyRule, emptyConfig } from "@/lib/types";
import RuleRow from "./RuleRow";

interface Props {
  initialName?: string;
  initialConfig?: StrategyConfig;
  onSubmit?: (name: string, config: StrategyConfig) => Promise<void>;
  onRunBacktest?: (name: string, config: StrategyConfig) => Promise<void>;
  submitLabel?: string;
}

export default function StrategyForm({
  initialName = "",
  initialConfig,
  onSubmit,
  onRunBacktest,
  submitLabel = "Save Strategy",
}: Props) {
  const [name, setName] = useState(initialName);
  const [config, setConfig] = useState<StrategyConfig>(initialConfig || emptyConfig());
  const [loading, setLoading] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRules = (
    section: "buy_rules" | "sell_rules" | "filters",
    index: number,
    rule: StrategyRule
  ) => {
    const updated = [...config[section]];
    updated[index] = rule;
    setConfig({ ...config, [section]: updated });
  };

  const addRule = (section: "buy_rules" | "sell_rules" | "filters") => {
    setConfig({ ...config, [section]: [...config[section], emptyRule()] });
  };

  const removeRule = (section: "buy_rules" | "sell_rules" | "filters", index: number) => {
    const updated = config[section].filter((_, i) => i !== index);
    setConfig({ ...config, [section]: updated });
  };

  const handleSubmit = async () => {
    if (!onSubmit) return;
    if (!name.trim()) return alert("Please enter a strategy name");
    if (config.buy_rules.length === 0) return alert("Add at least one buy rule");
    if (config.sell_rules.length === 0) return alert("Add at least one sell rule");
    setLoading(true);
    setError(null);
    try {
      await onSubmit(name, config);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to save strategy";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBacktest = async () => {
    if (!onRunBacktest) return;
    if (config.buy_rules.length === 0) return alert("Add at least one buy rule");
    if (config.sell_rules.length === 0) return alert("Add at least one sell rule");
    setBacktestLoading(true);
    try {
      await onRunBacktest(name || "Unnamed Strategy", config);
    } finally {
      setBacktestLoading(false);
    }
  };

  const renderSection = (
    title: string,
    section: "buy_rules" | "sell_rules" | "filters",
    color: string
  ) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${color}`}>{title}</h3>
        <button
          onClick={() => addRule(section)}
          className="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-600 transition"
        >
          + Add Rule
        </button>
      </div>
      {config[section].length === 0 && (
        <p className="text-sm text-gray-500 italic">No rules. Click &quot;+ Add Rule&quot; to add one.</p>
      )}
      {config[section].map((rule, i) => (
        <RuleRow
          key={i}
          rule={rule}
          onChange={(r) => updateRules(section, i, r)}
          onRemove={() => removeRule(section, i)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Strategy name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Strategy Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded bg-gray-800 border border-gray-700 px-4 py-2 text-white"
          placeholder="My Strategy"
        />
      </div>

      {/* Timeframe, Balance, Exchange, Position Size & Lookback */}
      <div className="grid grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Timeframe</label>
          <select
            value={config.timeframe}
            onChange={(e) => setConfig({ ...config, timeframe: e.target.value })}
            className="w-full rounded bg-gray-800 border border-gray-700 px-4 py-2 text-white"
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>
                {tf.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Initial Balance (USDT)</label>
          <input
            type="number"
            value={config.initial_balance}
            onChange={(e) => setConfig({ ...config, initial_balance: Number(e.target.value) })}
            className="w-full rounded bg-gray-800 border border-gray-700 px-4 py-2 text-white"
            min={1}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Exchange (Fees)</label>
          <select
            value={config.exchange}
            onChange={(e) => setConfig({ ...config, exchange: e.target.value })}
            className="w-full rounded bg-gray-800 border border-gray-700 px-4 py-2 text-white"
          >
            {EXCHANGES.map((ex) => (
              <option key={ex.value} value={ex.value}>
                {ex.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Position Size (%)</label>
          <input
            type="number"
            value={config.position_size_pct}
            onChange={(e) => setConfig({ ...config, position_size_pct: Math.min(100, Math.max(1, Number(e.target.value))) })}
            className="w-full rounded bg-gray-800 border border-gray-700 px-4 py-2 text-white"
            min={1}
            max={100}
            step={1}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Backtest Period</label>
          <select
            value={config.lookback_days}
            onChange={(e) => setConfig({ ...config, lookback_days: Number(e.target.value) })}
            className="w-full rounded bg-gray-800 border border-gray-700 px-4 py-2 text-white"
          >
            {LOOKBACK_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rules sections */}
      <div className="space-y-6 rounded-lg border border-gray-800 bg-gray-900/50 p-6">
        {renderSection("Buy Rules", "buy_rules", "text-green-400")}
      </div>

      <div className="space-y-6 rounded-lg border border-gray-800 bg-gray-900/50 p-6">
        {renderSection("Sell Rules", "sell_rules", "text-red-400")}
      </div>

      <div className="space-y-6 rounded-lg border border-gray-800 bg-gray-900/50 p-6">
        {renderSection("Strategy Filters", "filters", "text-yellow-400")}
      </div>

      {/* Save error */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-4">
        {onSubmit && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition"
          >
            {loading ? "Saving..." : submitLabel}
          </button>
        )}
        {onRunBacktest && (
          <button
            onClick={handleBacktest}
            disabled={backtestLoading}
            className="rounded bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500 disabled:opacity-50 transition"
          >
            {backtestLoading ? "Running Backtest..." : "Run Backtest"}
          </button>
        )}
      </div>
    </div>
  );
}

"use client";
import { useState, useRef } from "react";
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
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [useCustomDates, setUseCustomDates] = useState(!!initialConfig?.start_date);

  // Stable keys for each rule to avoid React index-as-key bugs
  const nextKey = useRef(0);
  const makeKey = () => String(nextKey.current++);
  const [ruleKeys, setRuleKeys] = useState<{
    buy_rules: string[];
    sell_rules: string[];
    filters: string[];
  }>(() => {
    const cfg = initialConfig || emptyConfig();
    return {
      buy_rules: cfg.buy_rules.map(() => makeKey()),
      sell_rules: cfg.sell_rules.map(() => makeKey()),
      filters: cfg.filters.map(() => makeKey()),
    };
  });

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
    setRuleKeys(prev => ({ ...prev, [section]: [...prev[section], makeKey()] }));
  };

  const removeRule = (section: "buy_rules" | "sell_rules" | "filters", index: number) => {
    const updated = config[section].filter((_, i) => i !== index);
    setConfig({ ...config, [section]: updated });
    setRuleKeys(prev => ({ ...prev, [section]: prev[section].filter((_, i) => i !== index) }));
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
    setBacktestError(null);
    try {
      await onRunBacktest(name || "Unnamed Strategy", config);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setBacktestError(msg);
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
        <h3 className={`text-sm font-semibold ${color}`}>{title}</h3>
        <button
          onClick={() => addRule(section)}
          className="rounded bg-gray-700 px-2 py-0.5 text-xs text-white hover:bg-gray-600 transition"
        >
          + Add
        </button>
      </div>
      {config[section].length === 0 && (
        <p className="text-xs text-gray-500 italic">No rules added.</p>
      )}
      {config[section].map((rule, i) => (
        <RuleRow
          key={ruleKeys[section][i]}
          rule={rule}
          onChange={(r) => updateRules(section, i, r)}
          onRemove={() => removeRule(section, i)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-5 h-full overflow-y-auto pr-1">
      {/* Strategy name */}
      <div>
        <label className="block text-xs font-medium text-gray-300 mb-1">Strategy Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white"
          placeholder="My Strategy"
        />
      </div>

      {/* Settings grid */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Timeframe</label>
          <select
            value={config.timeframe}
            onChange={(e) => setConfig({ ...config, timeframe: e.target.value })}
            className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white"
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>{tf.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Balance (USDT)</label>
          <input
            type="number"
            value={config.initial_balance}
            onChange={(e) => setConfig({ ...config, initial_balance: Number(e.target.value) })}
            className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white"
            min={1}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Exchange</label>
          <select
            value={config.exchange}
            onChange={(e) => setConfig({ ...config, exchange: e.target.value })}
            className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white"
          >
            {EXCHANGES.map((ex) => (
              <option key={ex.value} value={ex.value}>{ex.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Position Size (%)</label>
          <input
            type="number"
            value={config.position_size_pct}
            onChange={(e) => setConfig({ ...config, position_size_pct: Math.min(100, Math.max(1, Number(e.target.value))) })}
            className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white"
            min={1} max={100} step={1}
          />
        </div>
      </div>

      {/* Backtest Period */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-300">Backtest Period</label>
          <button
            onClick={() => {
              setUseCustomDates(!useCustomDates);
              if (!useCustomDates) {
                setConfig({ ...config, start_date: null, end_date: null });
              } else {
                setConfig({ ...config, start_date: null, end_date: null });
              }
            }}
            className="text-xs text-blue-400 hover:text-blue-300 transition"
          >
            {useCustomDates ? "Use Preset" : "Custom Dates"}
          </button>
        </div>
        {useCustomDates ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={config.start_date || ""}
                onChange={(e) => setConfig({ ...config, start_date: e.target.value || null })}
                className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={config.end_date || ""}
                onChange={(e) => setConfig({ ...config, end_date: e.target.value || null })}
                className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white [color-scheme:dark]"
              />
            </div>
          </div>
        ) : (
          <select
            value={config.lookback_days}
            onChange={(e) => setConfig({ ...config, lookback_days: Number(e.target.value) })}
            className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white"
          >
            {LOOKBACK_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>{opt.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Rules sections */}
      <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        {renderSection("Buy Rules", "buy_rules", "text-green-400")}
      </div>

      <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        {renderSection("Sell Rules", "sell_rules", "text-red-400")}
      </div>

      <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        {renderSection("Strategy Filters", "filters", "text-yellow-400")}
      </div>

      {/* Trailing Stop */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.trailing_stop_atr !== null}
            onChange={(e) =>
              setConfig({ ...config, trailing_stop_atr: e.target.checked ? 2.0 : null })
            }
            className="rounded border-gray-700 bg-gray-800 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-sm font-semibold text-orange-400">Trailing Stop (ATR)</span>
        </label>
        {config.trailing_stop_atr !== null && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Multiplier</label>
              <input
                type="number"
                value={config.trailing_stop_atr}
                onChange={(e) => setConfig({ ...config, trailing_stop_atr: Number(e.target.value) })}
                className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white"
                min={0.1} step={0.1}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">ATR Period</label>
              <input
                type="number"
                value={config.trailing_stop_atr_period}
                onChange={(e) => setConfig({ ...config, trailing_stop_atr_period: Number(e.target.value) })}
                className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white"
                min={1}
              />
            </div>
          </div>
        )}
      </div>

      {/* Save error */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {onSubmit && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition"
          >
            {loading ? "Saving..." : submitLabel}
          </button>
        )}
        {onRunBacktest && (
          <button
            onClick={handleBacktest}
            disabled={backtestLoading}
            className="flex-1 rounded bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition"
          >
            {backtestLoading ? "Running..." : "Run Backtest"}
          </button>
        )}
      </div>
      {backtestError && (
        <p className="text-red-400 text-xs">Backtest failed: {backtestError}</p>
      )}
    </div>
  );
}

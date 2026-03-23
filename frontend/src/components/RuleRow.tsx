"use client";
import { useState } from "react";
import { StrategyRule, INDICATORS, COMPARATORS } from "@/lib/types";

interface Props {
  rule: StrategyRule;
  onChange: (rule: StrategyRule) => void;
  onRemove: () => void;
}

const NEEDS_PERIOD = ["ema", "rsi", "atr"];
const CROSS_COMPARATORS = ["crosses_above", "crosses_below"];
const PRESET_REFS = ["ema_10", "ema_20", "ema_50", "ema_100", "ema_200", "price"];

function isCustomEma(value: string | number): boolean {
  if (typeof value !== "string") return false;
  if (value === "price") return false;
  if (PRESET_REFS.includes(value)) return false;
  return value.startsWith("ema_");
}

export default function RuleRow({ rule, onChange, onRemove }: Props) {
  const isCross = CROSS_COMPARATORS.includes(rule.comparator);

  // Derive whether custom EMA is selected and its current period
  const valueStr = typeof rule.value === "string" ? rule.value : "ema_20";
  const custom = isCustomEma(valueStr);
  const customPeriod = custom ? parseInt(valueStr.split("_")[1]) || 20 : 20;

  const [showCustom, setShowCustom] = useState(custom);

  const handleValueDropdown = (val: string) => {
    if (val === "__custom__") {
      setShowCustom(true);
      onChange({ ...rule, value: `ema_${customPeriod}` });
    } else {
      setShowCustom(false);
      onChange({ ...rule, value: val });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Indicator */}
      <select
        value={rule.indicator}
        onChange={(e) => {
          const ind = e.target.value;
          const params: Record<string, number> = NEEDS_PERIOD.includes(ind)
            ? { period: rule.params.period || (ind === "rsi" ? 14 : 20) }
            : {};
          onChange({ ...rule, indicator: ind, params });
        }}
        className="rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
      >
        {INDICATORS.map((ind) => (
          <option key={ind} value={ind}>
            {ind.toUpperCase()}
          </option>
        ))}
      </select>

      {/* Period input for EMA/RSI indicator */}
      {NEEDS_PERIOD.includes(rule.indicator) && (
        <input
          type="number"
          value={rule.params.period || 14}
          onChange={(e) =>
            onChange({ ...rule, params: { ...rule.params, period: Number(e.target.value) } })
          }
          className="w-20 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
          placeholder="Period"
          min={1}
        />
      )}

      {/* Comparator */}
      <select
        value={rule.comparator}
        onChange={(e) => {
          const newComparator = e.target.value;
          const newIsCross = CROSS_COMPARATORS.includes(newComparator);
          const newValue = newIsCross && typeof rule.value === "number" ? "ema_20" : rule.value;
          setShowCustom(isCustomEma(String(newValue)));
          onChange({ ...rule, comparator: newComparator, value: newValue });
        }}
        className="rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
      >
        {COMPARATORS.map((c) => (
          <option key={c} value={c}>
            {c.replace("_", " ")}
          </option>
        ))}
      </select>

      {/* Value — dropdown + optional custom period for cross comparators */}
      {isCross ? (
        <>
          <select
            value={showCustom ? "__custom__" : valueStr}
            onChange={(e) => handleValueDropdown(e.target.value)}
            className="rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
          >
            {PRESET_REFS.map((ref) => (
              <option key={ref} value={ref}>
                {ref.toUpperCase()}
              </option>
            ))}
            <option value="__custom__">Custom EMA...</option>
          </select>

          {showCustom && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400 text-sm">EMA</span>
              <input
                type="number"
                value={customPeriod}
                min={1}
                onChange={(e) => onChange({ ...rule, value: `ema_${e.target.value}` })}
                className="w-20 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
                placeholder="Period"
              />
            </div>
          )}
        </>
      ) : (
        <input
          value={rule.value}
          onChange={(e) => {
            const val = e.target.value;
            const numVal = Number(val);
            onChange({ ...rule, value: isNaN(numVal) || val === "" ? val : numVal });
          }}
          className="w-32 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
          placeholder="Value"
        />
      )}

      {/* Delta % — only shown for cross comparators */}
      {isCross && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={rule.delta_pct}
            onChange={(e) => onChange({ ...rule, delta_pct: Number(e.target.value) })}
            className="w-20 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
            placeholder="0"
            min={0}
            step={0.1}
          />
          <span className="text-gray-400 text-sm">%</span>
        </div>
      )}

      <button
        onClick={onRemove}
        className="rounded p-2 text-red-400 hover:bg-red-900/30 transition"
        title="Remove rule"
      >
        &times;
      </button>
    </div>
  );
}

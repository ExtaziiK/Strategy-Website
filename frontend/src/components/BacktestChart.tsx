"use client";
import { useEffect, useRef, useState } from "react";
import {
  createChart, IChartApi, ColorType,
  CandlestickSeries, LineSeries, HistogramSeries,
  createSeriesMarkers, LineStyle,
} from "lightweight-charts";
import { CandleData, IndicatorData, TradeRecord } from "@/lib/types";

interface Props {
  candles: CandleData[];
  indicators: IndicatorData;
  trades: TradeRecord[];
}

const EMA_COLORS: Record<string, string> = {
  ema_10: "#f59e0b",
  ema_20: "#3b82f6",
  ema_50: "#8b5cf6",
  ema_100: "#ec4899",
  ema_200: "#ef4444",
};

const CHART_THEME = {
  layout: {
    background: { type: ColorType.Solid, color: "#111827" },
    textColor: "#9ca3af",
  },
  grid: {
    vertLines: { color: "#1f2937" },
    horzLines: { color: "#1f2937" },
  },
  crosshair: { mode: 0 },
};

function toTimestamp(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

export default function BacktestChart({ candles, indicators, trades }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesRefs = useRef<Map<string, any>>(new Map());
  const [hiddenIndicators, setHiddenIndicators] = useState<Set<string>>(new Set());

  const emaKeys = Object.keys(indicators).filter((k) => k.startsWith("ema_"));
  const rsiKeys = Object.keys(indicators).filter((k) => k.startsWith("rsi_"));
  const hasMacd = "macd" in indicators;
  const hasRsi = rsiKeys.length > 0;

  const toggleIndicator = (key: string) => {
    setHiddenIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Main chart + oscillator panes ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    seriesRefs.current.clear();

    const emaKeysLocal = Object.keys(indicators).filter((k) => k.startsWith("ema_"));
    const rsiKeysLocal = Object.keys(indicators).filter((k) => k.startsWith("rsi_"));
    const hasMacdLocal = "macd" in indicators;
    const hasRsiLocal = rsiKeysLocal.length > 0;

    // Count panes: main (0) + RSI (1?) + MACD (1?)
    const paneCount = 1 + (hasRsiLocal ? 1 : 0) + (hasMacdLocal ? 1 : 0);
    const rsiPane = hasRsiLocal ? 1 : -1;
    const macdPane = hasMacdLocal ? (hasRsiLocal ? 2 : 1) : -1;

    // Adjust chart height: main 500 + sub-panels
    const subPanelHeight = 150;
    const totalHeight = 500 + (paneCount - 1) * subPanelHeight;

    // Collect trade timestamps for vertical lines
    const buyTimestamps = new Set<number>();
    const sellTimestamps = new Set<number>();
    for (const t of trades) {
      buyTimestamps.add(toTimestamp(t.entry_date));
      sellTimestamps.add(toTimestamp(t.exit_date));
    }

    // ── Create single chart ──────────────────────────────────────────────────
    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: totalHeight,
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    // ── Pane 0: Main price chart ─────────────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      wickUpColor: "#22c55e",
    });
    candleSeries.setData(
      candles.map((c) => ({
        time: toTimestamp(c.timestamp) as any,
        open: c.open, high: c.high, low: c.low, close: c.close,
      }))
    );

    // EMA overlays (pane 0)
    for (const [key, values] of Object.entries(indicators)) {
      if (key.startsWith("ema_")) {
        const lineSeries = chart.addSeries(LineSeries, {
          color: EMA_COLORS[key] || "#6b7280",
          lineWidth: 1,
          title: key.replace("_", " ").toUpperCase(),
        });
        lineSeries.setData(
          values.map((v) => ({ time: toTimestamp(v.timestamp) as any, value: v.value }))
        );
        seriesRefs.current.set(key, lineSeries);
      }
    }

    // Trade markers on invisible series at exact execution prices
    if (trades.length > 0) {
      const buyPriceMap = new Map<number, number>();
      const sellPriceMap = new Map<number, number>();
      for (const t of trades) {
        buyPriceMap.set(toTimestamp(t.entry_date), t.entry_price);
        sellPriceMap.set(toTimestamp(t.exit_date), t.exit_price);
      }

      const buySeries = chart.addSeries(LineSeries, {
        color: "transparent", lineWidth: 0 as any,
        crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false,
      });
      buySeries.setData(
        Array.from(buyPriceMap.entries()).sort((a, b) => a[0] - b[0])
          .map(([time, value]) => ({ time: time as any, value }))
      );
      createSeriesMarkers(buySeries,
        trades.map((t) => ({
          time: toTimestamp(t.entry_date) as any,
          position: "belowBar" as const, color: "#06b6d4", shape: "circle" as const,
          text: `$${Math.round(t.entry_price).toLocaleString("en-US")}`,
        })).sort((a, b) => a.time - b.time)
      );

      const sellSeries = chart.addSeries(LineSeries, {
        color: "transparent", lineWidth: 0 as any,
        crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false,
      });
      sellSeries.setData(
        Array.from(sellPriceMap.entries()).sort((a, b) => a[0] - b[0])
          .map(([time, value]) => ({ time: time as any, value }))
      );
      createSeriesMarkers(sellSeries,
        trades.map((t) => ({
          time: toTimestamp(t.exit_date) as any,
          position: "aboveBar" as const, color: "#f97316", shape: "circle" as const,
          text: `$${Math.round(t.exit_price).toLocaleString("en-US")}`,
        })).sort((a, b) => a.time - b.time)
      );

      // ── Vertical trade lines on main chart ──
      const buyLineSeries = chart.addSeries(HistogramSeries, {
        color: "#06b6d440",
        priceFormat: { type: "volume" },
        priceScaleId: "trade-lines",
        lastValueVisible: false,
      });
      chart.priceScale("trade-lines").applyOptions({ visible: false });

      const candleData = candles.map((c) => ({
        time: toTimestamp(c.timestamp),
        high: c.high,
        low: c.low,
      }));
      const maxHigh = Math.max(...candleData.map((c) => c.high));

      buyLineSeries.setData(
        candleData.map((c) => ({
          time: c.time as any,
          value: buyTimestamps.has(c.time) ? maxHigh * 2 : 0,
          color: buyTimestamps.has(c.time) ? "#06b6d450" : "transparent",
        }))
      );

      const sellLineSeries = chart.addSeries(HistogramSeries, {
        color: "#f9731640",
        priceFormat: { type: "volume" },
        priceScaleId: "trade-lines",
        lastValueVisible: false,
      });
      sellLineSeries.setData(
        candleData.map((c) => ({
          time: c.time as any,
          value: sellTimestamps.has(c.time) ? maxHigh * 2 : 0,
          color: sellTimestamps.has(c.time) ? "#f9731650" : "transparent",
        }))
      );
    }

    // ── RSI pane ─────────────────────────────────────────────────────────────
    if (hasRsiLocal && rsiPane > 0) {
      for (const key of rsiKeysLocal) {
        const rsiSeries = chart.addSeries(LineSeries, {
          color: "#a78bfa",
          lineWidth: 1,
          title: key.replace("_", " ").toUpperCase(),
        }, rsiPane);
        rsiSeries.setData(
          indicators[key].map((v) => ({ time: toTimestamp(v.timestamp) as any, value: v.value }))
        );
        rsiSeries.createPriceLine({
          price: 70, color: "#ef444480", lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "70",
        });
        rsiSeries.createPriceLine({
          price: 50, color: "#6b728060", lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "",
        });
        rsiSeries.createPriceLine({
          price: 30, color: "#22c55e80", lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "30",
        });
      }

      // Vertical trade lines on RSI pane
      if (trades.length > 0) {
        const rsiData = rsiKeysLocal.length > 0
          ? indicators[rsiKeysLocal[0]].map((v) => toTimestamp(v.timestamp))
          : [];

        const rsiLinesBuy = chart.addSeries(HistogramSeries, {
          color: "#06b6d440",
          priceFormat: { type: "volume" },
          priceScaleId: "rsi-trade-lines",
          lastValueVisible: false,
        }, rsiPane);
        chart.priceScale("rsi-trade-lines", rsiPane).applyOptions({ visible: false });

        rsiLinesBuy.setData(
          rsiData.map((time) => ({
            time: time as any,
            value: buyTimestamps.has(time) ? 200 : 0,
            color: buyTimestamps.has(time) ? "#06b6d450" : "transparent",
          }))
        );

        const rsiLinesSell = chart.addSeries(HistogramSeries, {
          color: "#f9731640",
          priceFormat: { type: "volume" },
          priceScaleId: "rsi-trade-lines",
          lastValueVisible: false,
        }, rsiPane);
        rsiLinesSell.setData(
          rsiData.map((time) => ({
            time: time as any,
            value: sellTimestamps.has(time) ? 200 : 0,
            color: sellTimestamps.has(time) ? "#f9731650" : "transparent",
          }))
        );
      }
    }

    // ── MACD pane ────────────────────────────────────────────────────────────
    if (hasMacdLocal && macdPane > 0) {
      if (indicators["macd_hist"]) {
        const histSeries = chart.addSeries(HistogramSeries, {
          color: "#22c55e",
          priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        }, macdPane);
        histSeries.setData(
          indicators["macd_hist"].map((v) => ({
            time: toTimestamp(v.timestamp) as any,
            value: v.value,
            color: v.value >= 0 ? "#22c55e80" : "#ef444480",
          }))
        );
      }

      if (indicators["macd"]) {
        const macdLine = chart.addSeries(LineSeries, {
          color: "#3b82f6", lineWidth: 1, title: "MACD",
        }, macdPane);
        macdLine.setData(
          indicators["macd"].map((v) => ({ time: toTimestamp(v.timestamp) as any, value: v.value }))
        );
      }

      if (indicators["macd_signal"]) {
        const signalLine = chart.addSeries(LineSeries, {
          color: "#f97316", lineWidth: 1, title: "Signal",
        }, macdPane);
        signalLine.setData(
          indicators["macd_signal"].map((v) => ({ time: toTimestamp(v.timestamp) as any, value: v.value }))
        );
      }

      // Vertical trade lines on MACD pane
      if (trades.length > 0) {
        const macdKey = indicators["macd_hist"] ? "macd_hist" : indicators["macd"] ? "macd" : null;
        if (macdKey) {
          const macdTimeData = indicators[macdKey].map((v) => toTimestamp(v.timestamp));
          const macdMaxVal = Math.max(...indicators[macdKey].map((v) => Math.abs(v.value)), 1);

          const macdLinesBuy = chart.addSeries(HistogramSeries, {
            color: "#06b6d440",
            priceFormat: { type: "volume" },
            priceScaleId: "macd-trade-lines",
            lastValueVisible: false,
          }, macdPane);
          chart.priceScale("macd-trade-lines", macdPane).applyOptions({ visible: false });

          macdLinesBuy.setData(
            macdTimeData.map((time) => ({
              time: time as any,
              value: buyTimestamps.has(time) ? macdMaxVal * 4 : 0,
              color: buyTimestamps.has(time) ? "#06b6d450" : "transparent",
            }))
          );

          const macdLinesSell = chart.addSeries(HistogramSeries, {
            color: "#f9731640",
            priceFormat: { type: "volume" },
            priceScaleId: "macd-trade-lines",
            lastValueVisible: false,
          }, macdPane);
          macdLinesSell.setData(
            macdTimeData.map((time) => ({
              time: time as any,
              value: sellTimestamps.has(time) ? macdMaxVal * 4 : 0,
              color: sellTimestamps.has(time) ? "#f9731650" : "transparent",
            }))
          );
        }
      }
    }

    chart.timeScale().fitContent();

    // ── Resize ──────────────────────────────────────────────────────────────
    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [candles, indicators, trades]);

  // ── Update EMA visibility without recreating the chart ───────────────────
  useEffect(() => {
    for (const [key, series] of seriesRefs.current) {
      series.applyOptions({ visible: !hiddenIndicators.has(key) });
    }
  }, [hiddenIndicators]);

  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      {/* Legend / toggle bar */}
      {(emaKeys.length > 0 || hasRsi || hasMacd) && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900/50">
          {emaKeys.map((key) => (
            <button
              key={key}
              onClick={() => toggleIndicator(key)}
              title={hiddenIndicators.has(key) ? `Show ${key.replace("_", " ").toUpperCase()}` : `Hide ${key.replace("_", " ").toUpperCase()}`}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-gray-700 hover:border-gray-500 transition-all ${
                hiddenIndicators.has(key) ? "opacity-40" : "opacity-100"
              }`}
            >
              <span
                className="w-5 h-0.5 inline-block rounded-full"
                style={{ backgroundColor: EMA_COLORS[key] || "#6b7280" }}
              />
              <span className="text-gray-300">{key.replace("_", " ").toUpperCase()}</span>
            </button>
          ))}

          {hasRsi && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-gray-700">
              <span className="w-5 h-0.5 inline-block rounded-full bg-violet-400" />
              <span className="text-gray-400">RSI</span>
            </span>
          )}
          {hasMacd && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-gray-700">
              <span className="w-5 h-0.5 inline-block rounded-full bg-blue-400" />
              <span className="text-gray-400">MACD</span>
            </span>
          )}

          <div className="ml-auto flex gap-2">
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-gray-700">
              <span className="w-2 h-2 rounded-full inline-block bg-cyan-400" />
              <span className="text-gray-400">Buy</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-gray-700">
              <span className="w-2 h-2 rounded-full inline-block bg-orange-400" />
              <span className="text-gray-400">Sell</span>
            </span>
          </div>
        </div>
      )}

      {/* Single chart with all panes */}
      <div ref={containerRef} />
    </div>
  );
}

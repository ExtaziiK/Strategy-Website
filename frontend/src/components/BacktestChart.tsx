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
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);
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

  // ── Main chart + oscillator panels ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    seriesRefs.current.clear();

    const emaKeysLocal = Object.keys(indicators).filter((k) => k.startsWith("ema_"));
    const rsiKeysLocal = Object.keys(indicators).filter((k) => k.startsWith("rsi_"));
    const hasMacdLocal = "macd" in indicators;
    const hasRsiLocal = rsiKeysLocal.length > 0;

    // Collect trade timestamps for vertical lines
    const buyTimestamps = new Set<number>();
    const sellTimestamps = new Set<number>();
    for (const t of trades) {
      buyTimestamps.add(toTimestamp(t.entry_date));
      sellTimestamps.add(toTimestamp(t.exit_date));
    }

    // ── Main price chart ────────────────────────────────────────────────────
    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: 500,
      timeScale: { timeVisible: true, secondsVisible: false },
    });

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

    // EMA overlays
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
      // Buy lines (cyan, dashed)
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

      // Sell lines (orange, dashed)
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

    chart.timeScale().fitContent();

    // ── RSI sub-panel ───────────────────────────────────────────────────────
    let rsiChart: IChartApi | null = null;
    if (hasRsiLocal && rsiContainerRef.current) {
      rsiChart = createChart(rsiContainerRef.current, {
        ...CHART_THEME,
        width: rsiContainerRef.current.clientWidth,
        height: 150,
        timeScale: { visible: false },
        rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.1 } },
      });

      for (const key of rsiKeysLocal) {
        const rsiSeries = rsiChart.addSeries(LineSeries, {
          color: "#a78bfa",
          lineWidth: 1,
        });
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

      // ── Vertical trade lines on RSI chart ──
      if (trades.length > 0) {
        const rsiData = rsiKeysLocal.length > 0
          ? indicators[rsiKeysLocal[0]].map((v) => toTimestamp(v.timestamp))
          : [];
        const rsiTimeSet = new Set(rsiData);

        const rsiLinesBuy = rsiChart.addSeries(HistogramSeries, {
          color: "#06b6d440",
          priceFormat: { type: "volume" },
          priceScaleId: "rsi-trade-lines",
          lastValueVisible: false,
        });
        rsiChart.priceScale("rsi-trade-lines").applyOptions({ visible: false });

        rsiLinesBuy.setData(
          rsiData.map((time) => ({
            time: time as any,
            value: buyTimestamps.has(time) ? 200 : 0,
            color: buyTimestamps.has(time) ? "#06b6d450" : "transparent",
          }))
        );

        const rsiLinesSell = rsiChart.addSeries(HistogramSeries, {
          color: "#f9731640",
          priceFormat: { type: "volume" },
          priceScaleId: "rsi-trade-lines",
          lastValueVisible: false,
        });
        rsiLinesSell.setData(
          rsiData.map((time) => ({
            time: time as any,
            value: sellTimestamps.has(time) ? 200 : 0,
            color: sellTimestamps.has(time) ? "#f9731650" : "transparent",
          }))
        );
      }
    }

    // ── MACD sub-panel ──────────────────────────────────────────────────────
    let macdChart: IChartApi | null = null;
    if (hasMacdLocal && macdContainerRef.current) {
      macdChart = createChart(macdContainerRef.current, {
        ...CHART_THEME,
        width: macdContainerRef.current.clientWidth,
        height: 150,
        timeScale: { visible: false },
      });

      if (indicators["macd_hist"]) {
        const histSeries = macdChart.addSeries(HistogramSeries, {
          color: "#22c55e",
          priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        });
        histSeries.setData(
          indicators["macd_hist"].map((v) => ({
            time: toTimestamp(v.timestamp) as any,
            value: v.value,
            color: v.value >= 0 ? "#22c55e80" : "#ef444480",
          }))
        );
      }

      if (indicators["macd"]) {
        const macdLine = macdChart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1 });
        macdLine.setData(
          indicators["macd"].map((v) => ({ time: toTimestamp(v.timestamp) as any, value: v.value }))
        );
      }

      if (indicators["macd_signal"]) {
        const signalLine = macdChart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1 });
        signalLine.setData(
          indicators["macd_signal"].map((v) => ({ time: toTimestamp(v.timestamp) as any, value: v.value }))
        );
      }

      // ── Vertical trade lines on MACD chart ──
      if (trades.length > 0) {
        const macdKey = indicators["macd_hist"] ? "macd_hist" : indicators["macd"] ? "macd" : null;
        if (macdKey) {
          const macdTimeData = indicators[macdKey].map((v) => toTimestamp(v.timestamp));
          const macdMaxVal = Math.max(...indicators[macdKey].map((v) => Math.abs(v.value)), 1);

          const macdLinesBuy = macdChart.addSeries(HistogramSeries, {
            color: "#06b6d440",
            priceFormat: { type: "volume" },
            priceScaleId: "macd-trade-lines",
            lastValueVisible: false,
          });
          macdChart.priceScale("macd-trade-lines").applyOptions({ visible: false });

          macdLinesBuy.setData(
            macdTimeData.map((time) => ({
              time: time as any,
              value: buyTimestamps.has(time) ? macdMaxVal * 4 : 0,
              color: buyTimestamps.has(time) ? "#06b6d450" : "transparent",
            }))
          );

          const macdLinesSell = macdChart.addSeries(HistogramSeries, {
            color: "#f9731640",
            priceFormat: { type: "volume" },
            priceScaleId: "macd-trade-lines",
            lastValueVisible: false,
          });
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

    // ── Time scale sync ─────────────────────────────────────────────────────
    const subCharts = [rsiChart, macdChart].filter(Boolean) as IChartApi[];
    if (subCharts.length > 0) {
      let syncing = false;
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (syncing || !range) return;
        syncing = true;
        subCharts.forEach((sc) => sc.timeScale().setVisibleLogicalRange(range));
        syncing = false;
      });
      subCharts.forEach((sc) => {
        sc.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (syncing || !range) return;
          syncing = true;
          chart.timeScale().setVisibleLogicalRange(range);
          subCharts.forEach((other) => {
            if (other !== sc) other.timeScale().setVisibleLogicalRange(range);
          });
          syncing = false;
        });
      });
    }

    // ── Resize ──────────────────────────────────────────────────────────────
    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
      if (rsiChart && rsiContainerRef.current) rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth });
      if (macdChart && macdContainerRef.current) macdChart.applyOptions({ width: macdContainerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      rsiChart?.remove();
      macdChart?.remove();
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

      {/* Main price chart */}
      <div ref={containerRef} />

      {/* RSI sub-panel */}
      {hasRsi && (
        <div className="border-t border-gray-800">
          <div className="px-3 pt-1 pb-0 text-xs text-gray-500 font-medium tracking-wide bg-gray-900/30">
            RSI &nbsp;
            <span className="text-gray-600">— 70 overbought · 30 oversold</span>
          </div>
          <div ref={rsiContainerRef} />
        </div>
      )}

      {/* MACD sub-panel */}
      {hasMacd && (
        <div className="border-t border-gray-800">
          <div className="px-3 pt-1 pb-0 text-xs font-medium tracking-wide bg-gray-900/30">
            <span className="text-gray-500">MACD &nbsp;</span>
            <span className="text-blue-400">MACD</span>
            <span className="text-gray-600"> · </span>
            <span className="text-orange-400">Signal</span>
            <span className="text-gray-600"> · </span>
            <span className="text-gray-500">Histogram</span>
          </div>
          <div ref={macdContainerRef} />
        </div>
      )}
    </div>
  );
}

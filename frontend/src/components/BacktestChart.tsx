"use client";
import { useEffect, useRef } from "react";
import { createChart, IChartApi, ColorType, CandlestickSeries, LineSeries, createSeriesMarkers } from "lightweight-charts";
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

function toTimestamp(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

export default function BacktestChart({ candles, indicators, trades }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#111827" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      width: containerRef.current.clientWidth,
      height: 500,
      timeScale: { timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      wickUpColor: "#22c55e",
    });

    const candleData = candles.map((c) => ({
      time: toTimestamp(c.timestamp) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    // EMA overlays
    for (const [key, values] of Object.entries(indicators)) {
      if (key.startsWith("ema_")) {
        const lineSeries = chart.addSeries(LineSeries, {
          color: EMA_COLORS[key] || "#6b7280",
          lineWidth: 1,
          title: key.toUpperCase(),
        });
        lineSeries.setData(
          values.map((v) => ({ time: toTimestamp(v.timestamp) as any, value: v.value }))
        );
      }
    }

    // Trade markers on invisible series at exact execution prices
    if (trades.length > 0) {
      // Build deduplicated series data (unique timestamps) for buy/sell
      const buyPriceMap = new Map<number, number>();
      const sellPriceMap = new Map<number, number>();
      for (const t of trades) {
        buyPriceMap.set(toTimestamp(t.entry_date), t.entry_price);
        sellPriceMap.set(toTimestamp(t.exit_date), t.exit_price);
      }

      const buySeriesData = Array.from(buyPriceMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({ time: time as any, value }));

      const sellSeriesData = Array.from(sellPriceMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({ time: time as any, value }));

      // Invisible buy series — markers appear at entry_price on y-axis
      const buySeries = chart.addSeries(LineSeries, {
        color: "transparent",
        lineWidth: 0 as any,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      buySeries.setData(buySeriesData);

      const buyMarkers = trades
        .map((t) => ({
          time: toTimestamp(t.entry_date) as any,
          position: "inBar" as const,
          color: "#22c55e",
          shape: "arrowUp" as const,
          text: `Buy $${Math.round(t.entry_price).toLocaleString()}`,
        }))
        .sort((a, b) => a.time - b.time);
      createSeriesMarkers(buySeries, buyMarkers);

      // Invisible sell series — markers appear at exit_price on y-axis
      const sellSeries = chart.addSeries(LineSeries, {
        color: "transparent",
        lineWidth: 0 as any,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      sellSeries.setData(sellSeriesData);

      const sellMarkers = trades
        .map((t) => ({
          time: toTimestamp(t.exit_date) as any,
          position: "inBar" as const,
          color: "#ef4444",
          shape: "arrowDown" as const,
          text: `Sell $${Math.round(t.exit_price).toLocaleString()}`,
        }))
        .sort((a, b) => a.time - b.time);
      createSeriesMarkers(sellSeries, sellMarkers);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [candles, indicators, trades]);

  return <div ref={containerRef} className="rounded-lg border border-gray-800" />;
}

"use client";
import { useEffect, useRef } from "react";
import { createChart, ColorType, AreaSeries, LineSeries } from "lightweight-charts";
import { EquityPoint } from "@/lib/types";

interface Props {
  data: EquityPoint[];
  initialBalance: number;
}

export default function EquityCurve({ data, initialBalance }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

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
      height: 250,
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 2, fixLeftEdge: true, fixRightEdge: true },
    });

    const lastEquity = data[data.length - 1]?.equity || initialBalance;
    const color = lastEquity >= initialBalance ? "#22c55e" : "#ef4444";

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: color + "40",
      bottomColor: color + "05",
      lineWidth: 2,
      title: "Equity",
    });

    areaSeries.setData(
      data.map((d) => ({
        time: (Math.floor(new Date(d.timestamp).getTime() / 1000)) as any,
        value: d.equity,
      }))
    );

    // Baseline at initial balance
    const baselineSeries = chart.addSeries(LineSeries, {
      color: "#6b728080",
      lineWidth: 1,
      lineStyle: 2,
      title: "Initial",
    });
    baselineSeries.setData(
      data.map((d) => ({
        time: (Math.floor(new Date(d.timestamp).getTime() / 1000)) as any,
        value: initialBalance,
      }))
    );

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
  }, [data, initialBalance]);

  return <div ref={containerRef} className="rounded-lg border border-gray-800" />;
}

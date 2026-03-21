import axios from "axios";
import { Strategy, StrategyConfig, BacktestResponse } from "./types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
});

export async function getStrategies(): Promise<Strategy[]> {
  const res = await api.get("/strategies/");
  return res.data;
}

export async function getStrategy(id: string): Promise<Strategy> {
  const res = await api.get(`/strategies/${id}`);
  return res.data;
}

export async function createStrategy(name: string, config: StrategyConfig): Promise<Strategy> {
  const res = await api.post("/strategies/", { name, config });
  return res.data;
}

export async function updateStrategy(id: string, name: string, config: StrategyConfig): Promise<Strategy> {
  const res = await api.put(`/strategies/${id}`, { name, config });
  return res.data;
}

export async function deleteStrategy(id: string): Promise<void> {
  await api.delete(`/strategies/${id}`);
}

export async function runBacktest(params: {
  strategy_id?: string;
  config?: StrategyConfig;
}): Promise<BacktestResponse> {
  const res = await api.post("/backtest/", params);
  return res.data;
}

export async function getBacktestResult(strategyId: string) {
  const res = await api.get(`/backtest/${strategyId}`);
  return res.data;
}

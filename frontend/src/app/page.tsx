"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Strategy } from "@/lib/types";
import { getStrategies, deleteStrategy } from "@/lib/api";
import StrategyCard from "@/components/StrategyCard";

export default function Dashboard() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = async () => {
    try {
      const data = await getStrategies();
      setStrategies(data);
      setError(null);
    } catch (err: any) {
      setError("Failed to load strategies. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this strategy?")) return;
    try {
      await deleteStrategy(id);
      setStrategies((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("Failed to delete strategy");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-gray-400">Your BTC trading strategies</p>
        </div>
        <Link
          href="/strategy/new"
          className="rounded bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-500 transition"
        >
          + New Strategy
        </Link>
      </div>

      {loading && <p className="text-gray-400">Loading strategies...</p>}
      {error && (
        <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 p-4 text-yellow-400">
          {error}
        </div>
      )}

      {!loading && !error && strategies.length === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="text-gray-400 text-lg">No strategies yet.</p>
          <p className="mt-2 text-gray-500">
            Create your first strategy to start backtesting.
          </p>
          <Link
            href="/strategy/new"
            className="mt-4 inline-block rounded bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-500 transition"
          >
            Create Strategy
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {strategies.map((s) => (
          <StrategyCard key={s.id} strategy={s} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}

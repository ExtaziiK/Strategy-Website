"use client";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="border-b border-gray-800 bg-gray-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold text-white">
          BTC Backtester
        </Link>
        <div className="flex gap-6">
          <Link href="/" className="text-gray-400 hover:text-white transition">
            Dashboard
          </Link>
          <Link href="/strategy/new" className="text-gray-400 hover:text-white transition">
            New Strategy
          </Link>
        </div>
      </div>
    </nav>
  );
}

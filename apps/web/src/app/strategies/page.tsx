"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Strategy } from "@/lib/types";
import { api } from "@/lib/api";

const ARCHETYPE_COLORS: Record<string, string> = {
  aggressive: "#FF0051",
  conservative: "#00BFFF",
  social: "#FFD700",
  whale_follower: "#9B59B6",
  sniper: "#00FF41",
  momentum: "#FF6B35",
};

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"fitness" | "pnl" | "winRate" | "trades">("fitness");
  const [filterArchetype, setFilterArchetype] = useState<string>("all");

  useEffect(() => {
    async function fetch() {
      try {
        const data = await api.strategies.getAll();
        setStrategies(data);
      } catch (error) {
        console.error("Failed to fetch strategies:", error);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  const sortedStrategies = [...strategies]
    .filter((s) => filterArchetype === "all" || s.archetype === filterArchetype)
    .sort((a, b) => {
      switch (sortBy) {
        case "fitness":
          return b.performance.fitnessScore - a.performance.fitnessScore;
        case "pnl":
          return b.performance.totalPnL - a.performance.totalPnL;
        case "winRate":
          return b.performance.winRate - a.performance.winRate;
        case "trades":
          return b.performance.tradesExecuted - a.performance.tradesExecuted;
        default:
          return 0;
      }
    });

  const archetypes = ["all", ...new Set(strategies.map((s) => s.archetype).filter(Boolean))];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-roman-dark animate-pulse" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-roman-dark animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-xl text-roman-gold text-glow">
          ALL LEGIONS
        </h1>
        <span className="font-serif text-[8px] text-roman-marble/50">
          {strategies.length} TOTAL
        </span>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="font-serif text-[7px] text-roman-marble/50">SORT:</span>
          {(["fitness", "pnl", "winRate", "trades"] as const).map((sort) => (
            <button
              key={sort}
              onClick={() => setSortBy(sort)}
              className={`font-serif text-[7px] px-2 py-1 border transition-colors ${
                sortBy === sort
                  ? "border-roman-gold text-roman-gold bg-roman-gold/10"
                  : "border-roman-marble/30 text-roman-marble/50 hover:border-roman-marble"
              }`}
            >
              {sort.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-serif text-[7px] text-roman-marble/50">FILTER:</span>
          {archetypes.map((arch) => (
            <button
              key={arch}
              onClick={() => setFilterArchetype(arch as string)}
              className={`font-serif text-[7px] px-2 py-1 border transition-colors ${
                filterArchetype === arch
                  ? "border-roman-gold text-roman-gold bg-roman-gold/10"
                  : "border-roman-marble/30 text-roman-marble/50 hover:border-roman-marble"
              }`}
              style={{
                borderColor: arch !== "all" ? ARCHETYPE_COLORS[arch as string] + "80" : undefined,
                color: arch !== "all" && filterArchetype === arch ? ARCHETYPE_COLORS[arch as string] : undefined,
              }}
            >
              {(arch as string).toUpperCase().replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-roman-dark border-2 border-roman-marble">
        <div className="grid grid-cols-12 gap-2 p-3 border-b border-roman-marble/30 font-serif text-[6px] text-roman-marble/50">
          <div className="col-span-1">#</div>
          <div className="col-span-3">NAME</div>
          <div className="col-span-2">ARCHETYPE</div>
          <div className="col-span-1 text-right">FITNESS</div>
          <div className="col-span-2 text-right">PNL</div>
          <div className="col-span-1 text-right">WIN %</div>
          <div className="col-span-1 text-right">TRADES</div>
          <div className="col-span-1 text-right">GEN</div>
        </div>

        {sortedStrategies.map((strategy, index) => (
          <Link
            key={strategy.id}
            href={`/strategy/${strategy.id}`}
            className="grid grid-cols-12 gap-2 p-3 border-b border-roman-marble/10 hover:bg-roman-marble/5 transition-colors"
          >
            <div className="col-span-1 font-serif text-[7px] text-roman-marble/50">
              {index + 1}
            </div>
            <div className="col-span-3 font-serif text-[7px] text-roman-marble truncate">
              {strategy.name || `STRATEGY-${strategy.id.slice(0, 8)}`}
            </div>
            <div
              className="col-span-2 font-serif text-[7px]"
              style={{ color: ARCHETYPE_COLORS[strategy.archetype ?? "momentum"] }}
            >
              {strategy.archetype?.toUpperCase().replace("_", " ")}
            </div>
            <div className="col-span-1 font-serif text-[7px] text-roman-gold text-right">
              {strategy.performance.fitnessScore.toFixed(1)}
            </div>
            <div
              className={`col-span-2 font-serif text-[7px] text-right ${
                strategy.performance.totalPnL >= 0 ? "text-roman-laurel" : "text-roman-blood"
              }`}
            >
              {strategy.performance.totalPnL >= 0 ? "+" : ""}
              {strategy.performance.totalPnL.toFixed(4)} SOL
            </div>
            <div className="col-span-1 font-serif text-[7px] text-roman-navy text-right">
              {(strategy.performance.winRate * 100).toFixed(0)}%
            </div>
            <div className="col-span-1 font-serif text-[7px] text-roman-marble/70 text-right">
              {strategy.performance.tradesExecuted}
            </div>
            <div className="col-span-1 font-serif text-[7px] text-roman-marble/50 text-right">
              {strategy.generation}
            </div>
          </Link>
        ))}

        {sortedStrategies.length === 0 && (
          <div className="p-8 text-center">
            <p className="font-serif text-[8px] text-roman-marble/50">
              NO LEGIONS FOUND
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Treasury, TradingStats, EvolutionState, Trade } from "@/lib/types";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  color?: "green" | "cyan" | "red" | "gold";
  animate?: boolean;
}

function StatCard({ label, value, subValue, color = "green", animate = true }: StatCardProps) {
  const colorClasses = {
    green: "text-meta-green border-meta-green",
    cyan: "text-meta-cyan border-meta-cyan",
    red: "text-meta-red border-meta-red",
    gold: "text-meta-gold border-meta-gold",
  };

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-meta-bg-card p-4 border-2 ${colorClasses[color]} pixel-border`}
    >
      <p className="font-pixel text-[6px] text-meta-green/70 mb-2">{label}</p>
      <p className={`font-pixel text-lg ${colorClasses[color]} text-glow`}>{value}</p>
      {subValue && (
        <p className="font-pixel text-[6px] text-meta-green/50 mt-1">{subValue}</p>
      )}
    </motion.div>
  );
}

export function Stats() {
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [stats, setStats] = useState<TradingStats | null>(null);
  const [evolution, setEvolution] = useState<EvolutionState | null>(null);
  const [loading, setLoading] = useState(true);

  const { subscribe, isConnected } = useWebSocket({ channels: ["treasury", "trades", "evolution"] });

  const fetchData = useCallback(async () => {
    try {
      const [treasuryData, statsData, evolutionData] = await Promise.all([
        api.treasury.get(),
        api.trades.getStats(),
        api.evolution.getCurrent(),
      ]);

      setTreasury(treasuryData);
      setStats(statsData);
      setEvolution(evolutionData);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const unsubTreasury = subscribe("treasury:updated", (treasuryData: Treasury) => {
      setTreasury(treasuryData);
    });

    const unsubTradeOpen = subscribe("trade:opened", (trade: Trade) => {
      setStats((prev) => prev ? {
        ...prev,
        totalTrades: prev.totalTrades + 1,
        openPositions: prev.openPositions + 1,
        totalVolumeSol: prev.totalVolumeSol + trade.amountSol,
      } : prev);
    });

    const unsubTradeClose = subscribe("trade:closed", (trade: Trade) => {
      const pnl = trade.pnlSol ?? 0;
      const isWin = pnl > 0;
      setStats((prev) => {
        if (!prev) return prev;
        const newWinning = prev.winningTrades + (isWin ? 1 : 0);
        const newLosing = prev.losingTrades + (isWin ? 0 : 1);
        const newClosed = prev.closedPositions + 1;
        return {
          ...prev,
          openPositions: Math.max(0, prev.openPositions - 1),
          closedPositions: newClosed,
          winningTrades: newWinning,
          losingTrades: newLosing,
          winRate: newClosed > 0 ? newWinning / newClosed : 0,
          totalPnL: prev.totalPnL + pnl,
          bestTrade: Math.max(prev.bestTrade, pnl),
          worstTrade: Math.min(prev.worstTrade, pnl),
        };
      });
    });

    const unsubStrategiesLoaded = subscribe("strategies:loaded", (data) => {
      setEvolution((prev) => prev ? {
        ...prev,
        activeStrategies: data.count,
      } : prev);
    });

    return () => {
      unsubTreasury();
      unsubTradeOpen();
      unsubTradeClose();
      unsubStrategiesLoaded();
    };
  }, [subscribe]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="bg-meta-bg-card p-4 border-2 border-meta-green/30 animate-pulse h-24"
          />
        ))}
      </div>
    );
  }

  const formatSol = (value: number) => `${value.toFixed(4)} SOL`;
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="space-y-4">
      <h2 className="font-pixel text-sm text-meta-cyan">LIVE STATS</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="TREASURY"
          value={formatSol(treasury?.totalSol ?? 0)}
          subValue={`Available: ${formatSol(treasury?.availableToTrade ?? 0)}`}
          color="gold"
        />

        <StatCard
          label="TOTAL PNL"
          value={formatSol(treasury?.totalPnl ?? 0)}
          color={(treasury?.totalPnl ?? 0) >= 0 ? "green" : "red"}
        />

        <StatCard
          label="ACTIVE STRATEGIES"
          value={evolution?.activeStrategies ?? 0}
          subValue={`GEN ${evolution?.generation ?? 0}`}
          color="cyan"
        />

        <StatCard
          label="OPEN POSITIONS"
          value={stats?.openPositions ?? 0}
          subValue={`Locked: ${formatSol(treasury?.lockedInPositions ?? 0)}`}
          color="green"
        />

        <StatCard
          label="TOTAL TRADES"
          value={stats?.totalTrades ?? 0}
          subValue={`Vol: ${formatSol(stats?.totalVolumeSol ?? 0)}`}
        />

        <StatCard
          label="WIN RATE"
          value={formatPercent(stats?.winRate ?? 0)}
          subValue={`W: ${stats?.winningTrades ?? 0} / L: ${stats?.losingTrades ?? 0}`}
          color={(stats?.winRate ?? 0) >= 0.5 ? "green" : "red"}
        />

        <StatCard
          label="AVG FITNESS"
          value={(evolution?.avgFitness ?? 0).toFixed(1)}
          subValue={`Best: ${(evolution?.bestFitness ?? 0).toFixed(1)}`}
          color="cyan"
        />

        <StatCard
          label="BEST TRADE"
          value={formatSol(stats?.bestTrade ?? 0)}
          subValue={`Worst: ${formatSol(stats?.worstTrade ?? 0)}`}
          color="gold"
        />
      </div>
    </div>
  );
}

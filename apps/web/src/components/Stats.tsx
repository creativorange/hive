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
  color?: "positive" | "negative" | "neutral" | "accent";
  animate?: boolean;
}

function StatCard({ label, value, subValue, color = "neutral", animate = true }: StatCardProps) {
  const valueColors = {
    positive: "text-emerald-700",
    negative: "text-red-800",
    neutral: "text-roman-text",
    accent: "text-amber-700",
  };

  const borderColors = {
    positive: "border-emerald-600",
    negative: "border-red-700",
    neutral: "border-roman-stone",
    accent: "border-amber-600",
  };

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      className={`roman-tablet p-3 sm:p-4 min-h-[90px] sm:min-h-[100px] border-2 ${borderColors[color]}`}
    >
      <p className="font-serif text-xs sm:text-sm text-roman-stone mb-1 sm:mb-2 tracking-wider uppercase">{label}</p>
      
      <p className={`font-serif text-lg sm:text-2xl md:text-3xl ${valueColors[color]} font-bold break-all`}>
        {value}
      </p>
      
      {subValue && (
        <p className="font-sans text-xs sm:text-sm text-roman-stone mt-1 sm:mt-2">{subValue}</p>
      )}
    </motion.div>
  );
}

export function Stats() {
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [stats, setStats] = useState<TradingStats | null>(null);
  const [evolution, setEvolution] = useState<EvolutionState | null>(null);
  const [loading, setLoading] = useState(true);

  const { subscribe } = useWebSocket({ channels: ["treasury", "trades", "evolution"] });

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
            className="roman-tablet p-4 border-2 border-roman-stone/30 animate-pulse min-h-[100px]"
          />
        ))}
      </div>
    );
  }

  const formatSol = (value: number | null | undefined) => {
    const num = value ?? 0;
    return isNaN(num) ? "0.0000 SOL" : `${num.toFixed(4)} SOL`;
  };
  const formatPercent = (value: number | null | undefined) => {
    const num = value ?? 0;
    return isNaN(num) ? "0.0%" : `${(num * 100).toFixed(1)}%`;
  };
  const safeNumber = (value: number | null | undefined, fallback = 0) => {
    const num = value ?? fallback;
    return isNaN(num) ? fallback : num;
  };

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl text-roman-text tracking-wider">IMPERIAL TREASURY</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="TREASURY"
          value={formatSol(treasury?.totalSol ?? 0)}
          subValue={`Available: ${formatSol(treasury?.availableToTrade ?? 0)}`}
          color="accent"
        />

        <StatCard
          label="TOTAL PNL"
          value={formatSol(treasury?.totalPnl ?? 0)}
          color={(treasury?.totalPnl ?? 0) >= 0 ? "positive" : "negative"}
        />

        <StatCard
          label="TOTAL LEGIONS"
          value={safeNumber(evolution?.activeStrategies)}
          subValue={`GEN ${safeNumber(evolution?.generation)}`}
          color="neutral"
        />

        <StatCard
          label="OPEN POSITIONS"
          value={safeNumber(stats?.openPositions)}
          subValue={`Locked: ${formatSol(treasury?.lockedInPositions)}`}
          color="neutral"
        />

        <StatCard
          label="TOTAL TRADES"
          value={safeNumber(stats?.totalTrades)}
          subValue={`Vol: ${formatSol(stats?.totalVolumeSol)}`}
          color="neutral"
        />

        <StatCard
          label="WIN RATE"
          value={formatPercent(stats?.winRate)}
          subValue={`W: ${safeNumber(stats?.winningTrades)} / L: ${safeNumber(stats?.losingTrades)}`}
          color={safeNumber(stats?.winRate) >= 0.5 ? "positive" : "negative"}
        />

        <StatCard
          label="AVG FITNESS"
          value={safeNumber(evolution?.avgFitness).toFixed(1)}
          subValue={`Best: ${safeNumber(evolution?.bestFitness).toFixed(1)}`}
          color="neutral"
        />

        <StatCard
          label="BEST TRADE"
          value={formatSol(stats?.bestTrade)}
          subValue={`Worst: ${formatSol(stats?.worstTrade)}`}
          color="accent"
        />
      </div>
    </div>
  );
}

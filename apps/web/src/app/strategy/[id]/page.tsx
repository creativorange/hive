"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Strategy, Trade } from "@/lib/types";
import { api } from "@/lib/api";
import { ARCHETYPE_COLORS } from "@/lib/sprites";

interface StrategyDetail extends Strategy {
  trades?: Trade[];
  stats?: {
    totalTrades: number;
    winRate: number;
    avgPnL: number;
  };
}

export default function StrategyPage() {
  const params = useParams();
  const id = params.id as string;

  const [strategy, setStrategy] = useState<StrategyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStrategy() {
      try {
        const data = await api.strategies.getById(id);
        setStrategy(data as StrategyDetail);
      } catch (err) {
        setError("Failed to load strategy");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchStrategy();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-meta-bg-card animate-pulse" />
        <div className="h-64 bg-meta-bg-card animate-pulse" />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="text-center py-16">
        <p className="font-pixel text-meta-red">
          {error || "Strategy not found"}
        </p>
      </div>
    );
  }

  const archetypeColor = ARCHETYPE_COLORS[strategy.archetype ?? "momentum"];
  const totalPnL = strategy.performance?.totalPnL ?? 0;
  const pnlColor = totalPnL >= 0 ? "#00FF41" : "#FF0051";

  const pnlData =
    strategy.trades?.map((trade, i) => ({
      trade: i + 1,
      pnl: trade.pnlSol ?? 0,
      cumulative:
        strategy.trades
          ?.slice(0, i + 1)
          .reduce((sum, t) => sum + (t.pnlSol ?? 0), 0) ?? 0,
    })) ?? [];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-meta-bg-card border-2 p-6"
        style={{ borderColor: archetypeColor }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-pixel text-xl text-meta-green text-glow">
              {strategy.name || `STRATEGY-${strategy.id.slice(0, 8)}`}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="font-pixel text-[8px] px-2 py-1"
                style={{ backgroundColor: archetypeColor, color: "#0a0a0f" }}
              >
                {strategy.archetype?.toUpperCase()}
              </span>
              <span className="font-pixel text-[8px] text-meta-green/50">
                GEN {strategy.generation}
              </span>
              <span
                className={`font-pixel text-[8px] px-2 py-1 ${
                  strategy.status === "active"
                    ? "bg-meta-green text-meta-bg"
                    : strategy.status === "dead"
                    ? "bg-meta-red text-meta-bg"
                    : "bg-meta-cyan text-meta-bg"
                }`}
              >
                {strategy.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="text-right">
            <p className="font-pixel text-[8px] text-meta-green/50">
              TOTAL PNL
            </p>
            <p
              className="font-pixel text-2xl text-glow"
              style={{ color: pnlColor }}
            >
              {totalPnL >= 0 ? "+" : ""}
              {totalPnL.toFixed(4)} SOL
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox
            label="FITNESS"
            value={(strategy.performance?.fitnessScore ?? 0).toFixed(1)}
            color="gold"
          />
          <StatBox
            label="WIN RATE"
            value={`${((strategy.performance?.winRate ?? 0) * 100).toFixed(1)}%`}
            color="cyan"
          />
          <StatBox
            label="TRADES"
            value={strategy.performance?.tradesExecuted ?? 0}
            color="green"
          />
          <StatBox
            label="SHARPE"
            value={(strategy.performance?.sharpeRatio ?? 0).toFixed(2)}
            color="green"
          />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-meta-bg-card border-2 border-meta-green p-4"
        >
          <h2 className="font-pixel text-sm text-meta-cyan mb-4">GENES</h2>
          <div className="grid grid-cols-2 gap-3 text-[7px]">
            <GeneRow
              label="MCAP RANGE"
              value={`$${(strategy.genes.entryMcapMin ?? 0).toFixed(0)} - $${(strategy.genes.entryMcapMax ?? 0).toFixed(0)}`}
            />
            <GeneRow
              label="MIN VOLUME"
              value={`$${(strategy.genes.entryVolumeMin ?? 0).toFixed(0)}`}
            />
            <GeneRow
              label="TAKE PROFIT"
              value={`${(strategy.genes.takeProfitMultiplier ?? 0).toFixed(1)}x`}
            />
            <GeneRow
              label="STOP LOSS"
              value={`${((strategy.genes.stopLossMultiplier ?? 0) * 100).toFixed(0)}%`}
            />
            <GeneRow
              label="TIME EXIT"
              value={`${strategy.genes.timeBasedExit ?? 0}min`}
            />
            <GeneRow
              label="VOLUME DROP"
              value={`${((strategy.genes.volumeDropExit ?? 0) * 100).toFixed(0)}%`}
            />
            <GeneRow
              label="INVESTMENT"
              value={`${((strategy.genes.investmentPercent ?? 0) * 100).toFixed(1)}%`}
            />
            <GeneRow
              label="MAX POSITIONS"
              value={strategy.genes.maxSimultaneousPositions ?? 0}
            />
          </div>

          <div className="mt-4">
            <p className="font-pixel text-[6px] text-meta-cyan mb-2">
              BUY PATTERNS
            </p>
            <div className="flex flex-wrap gap-1">
              {strategy.genes.buyPatterns.map((pattern) => (
                <span
                  key={pattern}
                  className="font-pixel text-[5px] px-1 py-0.5 bg-meta-bg-light border border-meta-green/30 text-meta-green"
                >
                  {pattern}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="font-pixel text-[6px] text-meta-cyan mb-2">
              TOKEN KEYWORDS
            </p>
            <div className="flex flex-wrap gap-1">
              {strategy.genes.tokenNameKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="font-pixel text-[5px] px-1 py-0.5 bg-meta-bg-light border border-meta-cyan/30 text-meta-cyan"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-meta-bg-card border-2 border-meta-green p-4"
        >
          <h2 className="font-pixel text-sm text-meta-cyan mb-4">
            PNL HISTORY
          </h2>
          {pnlData.length === 0 ? (
            <p className="font-pixel text-[8px] text-meta-green/50 text-center py-8">
              NO TRADES YET
            </p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlData}>
                  <XAxis
                    dataKey="trade"
                    stroke="#00FF41"
                    tick={{ fill: "#00FF41", fontSize: 8 }}
                  />
                  <YAxis
                    stroke="#00FF41"
                    tick={{ fill: "#00FF41", fontSize: 8 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a24",
                      border: "1px solid #00FF41",
                      fontFamily: '"Press Start 2P"',
                      fontSize: 8,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#00D9FF"
                    strokeWidth={2}
                    dot={false}
                    name="Cumulative PnL"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      </div>

      {strategy.trades && strategy.trades.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-meta-bg-card border-2 border-meta-green p-4"
        >
          <h2 className="font-pixel text-sm text-meta-cyan mb-4">
            TRADE HISTORY
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[6px]">
              <thead>
                <tr className="text-meta-green/50 text-left">
                  <th className="p-2">TOKEN</th>
                  <th className="p-2">ENTRY</th>
                  <th className="p-2">EXIT</th>
                  <th className="p-2">AMOUNT</th>
                  <th className="p-2">PNL</th>
                  <th className="p-2">REASON</th>
                </tr>
              </thead>
              <tbody>
                {strategy.trades.slice(0, 20).map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-t border-meta-green/20"
                  >
                    <td className="p-2 text-meta-green">{trade.tokenSymbol}</td>
                    <td className="p-2 text-meta-green/70">
                      ${trade.entryPrice.toFixed(8)}
                    </td>
                    <td className="p-2 text-meta-green/70">
                      {trade.exitPrice ? `$${trade.exitPrice.toFixed(8)}` : "-"}
                    </td>
                    <td className="p-2 text-meta-green/70">
                      {trade.amountSol.toFixed(4)} SOL
                    </td>
                    <td
                      className="p-2"
                      style={{
                        color: (trade.pnlSol ?? 0) >= 0 ? "#00FF41" : "#FF0051",
                      }}
                    >
                      {trade.pnlSol !== undefined
                        ? `${trade.pnlSol >= 0 ? "+" : ""}${trade.pnlSol.toFixed(4)}`
                        : "-"}
                    </td>
                    <td className="p-2 text-meta-green/50">
                      {trade.exitReason?.toUpperCase() || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {strategy.parentIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-meta-bg-card border-2 border-meta-gold/50 p-4"
        >
          <h2 className="font-pixel text-sm text-meta-gold mb-4">LINEAGE</h2>
          <div className="flex items-center gap-4">
            {strategy.parentIds.map((parentId, i) => (
              <div key={parentId} className="flex items-center gap-2">
                <a
                  href={`/strategy/${parentId}`}
                  className="font-pixel text-[8px] text-meta-cyan hover:text-meta-cyan/70"
                >
                  PARENT {i + 1}: {parentId.slice(0, 8)}
                </a>
                {i < strategy.parentIds.length - 1 && (
                  <span className="text-meta-green/30">+</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "green" | "cyan" | "gold" | "red";
}) {
  const colorClasses = {
    green: "text-meta-green",
    cyan: "text-meta-cyan",
    gold: "text-meta-gold",
    red: "text-meta-red",
  };

  return (
    <div className="bg-meta-bg-light p-3 border border-meta-green/30">
      <p className="font-pixel text-[6px] text-meta-green/50 mb-1">{label}</p>
      <p className={`font-pixel text-sm ${colorClasses[color]}`}>{value}</p>
    </div>
  );
}

function GeneRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-meta-green/50">{label}</span>
      <span className="text-meta-green">{value}</span>
    </div>
  );
}

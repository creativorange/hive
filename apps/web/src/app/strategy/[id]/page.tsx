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
import type { Strategy, Trade, Position } from "@/lib/types";
import { api } from "@/lib/api";
import { ARCHETYPE_COLORS } from "@/lib/sprites";

interface WalletInfo {
  allocation: number;
  locked: number;
  available: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
}

interface StrategyDetail extends Strategy {
  trades?: Trade[];
  topTrades?: Trade[];
  openTrades?: Trade[];
  positions?: Position[];
  wallet?: WalletInfo;
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
  const [funding, setFunding] = useState(false);
  const [fundAmount, setFundAmount] = useState(1);

  const fetchStrategy = async () => {
    try {
      const data = await api.strategies.getById(id);
      setStrategy(data as StrategyDetail);
    } catch (err) {
      setError("Failed to load strategy");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchStrategy();
    }
  }, [id]);

  const handleFund = async () => {
    if (funding || fundAmount <= 0) return;
    setFunding(true);
    try {
      await api.strategies.fund(id, fundAmount);
      await fetchStrategy();
    } catch (err) {
      console.error("Failed to fund strategy:", err);
    } finally {
      setFunding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-roman-bg-card animate-pulse" />
        <div className="h-64 bg-roman-bg-card animate-pulse" />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="text-center py-16">
        <p className="font-serif text-red-800">
          {error || "Strategy not found"}
        </p>
      </div>
    );
  }

  const archetypeColor = ARCHETYPE_COLORS[strategy.archetype ?? "momentum"];
  const totalPnL = strategy.performance?.totalPnL ?? 0;
  const pnlColor = totalPnL >= 0 ? "rgb(4, 120, 87)" : "rgb(153, 27, 27)";

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
        className="bg-roman-bg-card border-2 p-6"
        style={{ borderColor: archetypeColor }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-serif text-xl text-roman-text">
              {strategy.name || `STRATEGY-${strategy.id.slice(0, 8)}`}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="font-serif text-sm px-2 py-1"
                style={{ backgroundColor: archetypeColor, color: "#0a0a0f" }}
              >
                {strategy.archetype?.toUpperCase()}
              </span>
              <span className="font-serif text-sm text-roman-text/50">
                GEN {strategy.generation}
              </span>
              <span
                className={`font-serif text-sm px-2 py-1 ${
                  strategy.status === "active"
                    ? "bg-emerald-700 text-white"
                    : strategy.status === "dead"
                    ? "bg-red-800 text-white"
                    : strategy.status === "needs_funding"
                    ? "bg-roman-gold text-roman-bg-card animate-pulse"
                    : "bg-roman-purple text-white"
                }`}
              >
                {strategy.status === "needs_funding" ? "NEEDS FUNDING" : strategy.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="text-right">
            <p className="font-serif text-sm text-roman-text/50">
              TOTAL PNL
            </p>
            <p
              className="font-serif text-2xl"
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
            color="purple"
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

      {/* Needs Funding Alert */}
      {strategy.status === "needs_funding" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-roman-bg-card border-2 border-roman-gold p-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-lg text-roman-gold mb-2">⚠️ AGENT NEEDS FUNDING</h2>
              <p className="font-serif text-sm text-roman-text/70">
                This agent has depleted its wallet. Fund it to reactivate trading.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(parseFloat(e.target.value) || 0)}
                  className="w-20 bg-roman-bg-card border border-roman-gold/50 text-roman-gold font-serif text-sm px-2 py-1 text-center"
                />
                <span className="font-serif text-sm text-roman-gold">SOL</span>
              </div>
              <button
                onClick={handleFund}
                disabled={funding || fundAmount <= 0}
                className={`font-serif text-sm px-4 py-2 border-2 transition-all whitespace-nowrap ${
                  funding
                    ? "border-roman-gold/50 text-roman-gold/50 cursor-wait"
                    : "border-roman-gold text-roman-gold hover:bg-roman-gold hover:text-roman-bg-card"
                }`}
              >
                {funding ? "FUNDING..." : "FUND AGENT"}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Wallet Stats */}
      {strategy.wallet && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-roman-bg-card border-2 border-roman-gold p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-sm text-roman-gold">AGENT WALLET</h2>
            {strategy.status === "active" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(parseFloat(e.target.value) || 0)}
                  className="w-16 bg-roman-bg-card border border-roman-stone text-roman-text font-serif text-sm px-2 py-1 text-center"
                />
                <button
                  onClick={handleFund}
                  disabled={funding || fundAmount <= 0}
                  className={`font-serif text-sm px-3 py-1 border transition-all ${
                    funding
                      ? "border-roman-stone text-roman-text/30 cursor-wait"
                      : "border-roman-stone text-roman-text/70 hover:border-roman-text hover:text-roman-text"
                  }`}
                >
                  {funding ? "..." : "+ ADD"}
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <StatBox
              label="ALLOCATION"
              value={`${strategy.wallet.allocation.toFixed(2)} SOL`}
              color="gold"
            />
            <StatBox
              label="LOCKED"
              value={`${strategy.wallet.locked.toFixed(4)} SOL`}
              color="purple"
            />
            <StatBox
              label="AVAILABLE"
              value={`${strategy.wallet.available.toFixed(4)} SOL`}
              color="green"
            />
            <StatBox
              label="REALIZED PNL"
              value={`${strategy.wallet.realizedPnL >= 0 ? "+" : ""}${strategy.wallet.realizedPnL.toFixed(4)} SOL`}
              color={strategy.wallet.realizedPnL >= 0 ? "green" : "red"}
            />
            <StatBox
              label="UNREALIZED PNL"
              value={`${strategy.wallet.unrealizedPnL >= 0 ? "+" : ""}${strategy.wallet.unrealizedPnL.toFixed(4)} SOL`}
              color={strategy.wallet.unrealizedPnL >= 0 ? "green" : "red"}
            />
            <StatBox
              label="TOTAL PNL"
              value={`${strategy.wallet.totalPnL >= 0 ? "+" : ""}${strategy.wallet.totalPnL.toFixed(4)} SOL`}
              color={strategy.wallet.totalPnL >= 0 ? "green" : "red"}
            />
          </div>
        </motion.div>
      )}

      {/* Open Positions */}
      {strategy.positions && strategy.positions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-roman-bg-card border-2 border-roman-purple p-4"
        >
          <h2 className="font-serif text-sm text-roman-purple mb-4">
            OPEN POSITIONS ({strategy.positions.length})
          </h2>
          {/* Mobile card layout */}
          <div className="md:hidden space-y-3">
            {strategy.positions.map((position) => {
              const holdTimeMs = Date.now() - position.openedAt;
              const holdMins = Math.floor(holdTimeMs / 60000);
              const pnlPositionColor = position.unrealizedPnL >= 0 ? "rgb(4, 120, 87)" : "rgb(153, 27, 27)";
              const tokenSymbol = position.tokenSymbol ?? position.token?.symbol ?? "???";
              const tokenAddress = position.tokenAddress ?? position.token?.address ?? "";
              
              return (
                <div key={position.id} className="p-3 border border-roman-purple/20 rounded">
                  <div className="flex items-start justify-between mb-2">
                    <a
                      href={`https://pump.fun/${tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-roman-purple hover:text-roman-text hover:underline font-medium"
                    >
                      {tokenSymbol}
                    </a>
                    <div className="text-right">
                      <span style={{ color: pnlPositionColor }} className="font-medium">
                        {position.unrealizedPnL >= 0 ? "+" : ""}{position.unrealizedPnL.toFixed(4)} SOL
                      </span>
                      <span className="text-xs ml-1" style={{ color: pnlPositionColor }}>
                        ({position.unrealizedPnLPercent >= 0 ? "+" : ""}{(position.unrealizedPnLPercent * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-roman-text/50">Entry: </span>
                      <span className="text-roman-text">${position.entryPrice.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-roman-text/50">Current: </span>
                      <span className="text-roman-text">${position.currentPrice.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-roman-text/50">Invested: </span>
                      <span className="text-roman-text">{position.amountSol.toFixed(4)} SOL</span>
                    </div>
                    <div>
                      <span className="text-roman-text/50">Hold: </span>
                      <span className="text-roman-text">{holdMins}min</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Desktop table layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="text-roman-text/50 text-left">
                  <th className="p-2">TOKEN</th>
                  <th className="p-2">ENTRY PRICE</th>
                  <th className="p-2">CURRENT PRICE</th>
                  <th className="p-2">INVESTED</th>
                  <th className="p-2">UNREALIZED PNL</th>
                  <th className="p-2">HOLD TIME</th>
                </tr>
              </thead>
              <tbody>
                {strategy.positions.map((position) => {
                  const holdTimeMs = Date.now() - position.openedAt;
                  const holdMins = Math.floor(holdTimeMs / 60000);
                  const pnlPositionColor = position.unrealizedPnL >= 0 ? "rgb(4, 120, 87)" : "rgb(153, 27, 27)";
                  const tokenSymbol = position.tokenSymbol ?? position.token?.symbol ?? "???";
                  const tokenAddress = position.tokenAddress ?? position.token?.address ?? "";
                  
                  return (
                    <tr key={position.id} className="border-t border-roman-purple/20">
                      <td className="p-2">
                        <a
                          href={`https://pump.fun/${tokenAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-roman-purple hover:text-roman-text hover:underline"
                        >
                          {tokenSymbol}
                        </a>
                      </td>
                      <td className="p-2 text-roman-text/70">
                        ${position.entryPrice.toFixed(8)}
                      </td>
                      <td className="p-2 text-roman-text/70">
                        ${position.currentPrice.toFixed(8)}
                      </td>
                      <td className="p-2 text-roman-text">
                        {position.amountSol.toFixed(4)} SOL
                      </td>
                      <td className="p-2" style={{ color: pnlPositionColor }}>
                        {position.unrealizedPnL >= 0 ? "+" : ""}
                        {position.unrealizedPnL.toFixed(4)} SOL
                        <span className="text-xs ml-1">
                          ({position.unrealizedPnLPercent >= 0 ? "+" : ""}
                          {(position.unrealizedPnLPercent * 100).toFixed(1)}%)
                        </span>
                      </td>
                      <td className="p-2 text-roman-text/50">
                        {holdMins}min
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-roman-bg-card border-2 border-roman-stone p-4"
        >
          <h2 className="font-serif text-sm text-roman-purple mb-4">GENES</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
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
            <p className="font-serif text-xs text-roman-purple mb-2">
              BUY PATTERNS
            </p>
            <div className="flex flex-wrap gap-1">
              {strategy.genes.buyPatterns.map((pattern) => (
                <span
                  key={pattern}
                  className="font-serif text-xs px-2 py-1 bg-roman-bg-card border border-roman-stone text-roman-text"
                >
                  {pattern}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="font-serif text-xs text-roman-purple mb-2">
              TOKEN KEYWORDS
            </p>
            <div className="flex flex-wrap gap-1">
              {strategy.genes.tokenNameKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="font-serif text-xs px-2 py-1 bg-roman-bg-card border border-roman-purple/30 text-roman-purple"
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
          className="bg-roman-bg-card border-2 border-roman-stone p-4"
        >
          <h2 className="font-serif text-sm text-roman-purple mb-4">
            PNL HISTORY
          </h2>
          {pnlData.length === 0 ? (
            <p className="font-serif text-sm text-roman-text/50 text-center py-8">
              NO TRADES YET
            </p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlData}>
                  <XAxis
                    dataKey="trade"
                    stroke="rgb(68, 64, 60)"
                    tick={{ fill: "rgb(68, 64, 60)", fontSize: 12 }}
                  />
                  <YAxis
                    stroke="rgb(68, 64, 60)"
                    tick={{ fill: "rgb(68, 64, 60)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#f5f0e8",
                      border: "1px solid rgb(68, 64, 60)",
                      fontFamily: "serif",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="rgb(88, 28, 135)"
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

      {strategy.topTrades && strategy.topTrades.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-roman-bg-card border-2 border-roman-stone p-4"
        >
          <h2 className="font-serif text-sm text-roman-purple mb-4">
            TOP 20 MOST PROFITABLE TRADES
          </h2>
          {/* Mobile card layout */}
          <div className="md:hidden space-y-3">
            {strategy.topTrades.map((trade, index) => (
              <div key={trade.id} className="p-3 border border-roman-stone/20 rounded">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-roman-gold font-bold">#{index + 1}</span>
                    <a
                      href={`https://pump.fun/${trade.tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-roman-text hover:text-roman-purple hover:underline font-medium"
                    >
                      {trade.tokenSymbol}
                    </a>
                  </div>
                  <span
                    className="font-medium"
                    style={{
                      color: (trade.pnlSol ?? 0) >= 0 ? "rgb(4, 120, 87)" : "rgb(153, 27, 27)",
                    }}
                  >
                    {trade.pnlSol != null
                      ? `${trade.pnlSol >= 0 ? "+" : ""}${trade.pnlSol.toFixed(4)} SOL`
                      : "-"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-roman-text/50">Entry: </span>
                    <span className="text-roman-text">${(trade.entryPrice ?? 0).toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-roman-text/50">Exit: </span>
                    <span className="text-roman-text">{trade.exitPrice ? `$${trade.exitPrice.toFixed(6)}` : "-"}</span>
                  </div>
                  <div>
                    <span className="text-roman-text/50">Bought: </span>
                    <span className="text-roman-text">{(trade.amountSol ?? 0).toFixed(4)} SOL</span>
                  </div>
                  <div>
                    <span className="text-roman-text/50">Reason: </span>
                    <span className="text-roman-text">{trade.exitReason?.toUpperCase() || "-"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="text-roman-text/50 text-left">
                  <th className="p-2">#</th>
                  <th className="p-2">TOKEN</th>
                  <th className="p-2">ENTRY</th>
                  <th className="p-2">EXIT</th>
                  <th className="p-2">BOUGHT</th>
                  <th className="p-2">SOLD</th>
                  <th className="p-2">PNL</th>
                  <th className="p-2">REASON</th>
                </tr>
              </thead>
              <tbody>
                {strategy.topTrades.map((trade, index) => (
                  <tr
                    key={trade.id}
                    className="border-t border-roman-stone/20"
                  >
                    <td className="p-2 text-roman-gold font-bold">
                      {index + 1}
                    </td>
                    <td className="p-2">
                      <a
                        href={`https://pump.fun/${trade.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-roman-text hover:text-roman-purple hover:underline"
                      >
                        {trade.tokenSymbol}
                      </a>
                    </td>
                    <td className="p-2 text-roman-text/70">
                      ${(trade.entryPrice ?? 0).toFixed(8)}
                    </td>
                    <td className="p-2 text-roman-text/70">
                      {trade.exitPrice ? `$${trade.exitPrice.toFixed(8)}` : "-"}
                    </td>
                    <td className="p-2 text-roman-text/70">
                      {(trade.amountSol ?? 0).toFixed(4)} SOL
                    </td>
                    <td className="p-2 text-roman-text/70">
                      {trade.status === "closed"
                        ? `${((trade.amountSol ?? 0) + (trade.pnlSol ?? 0)).toFixed(4)} SOL`
                        : "-"}
                    </td>
                    <td
                      className="p-2"
                      style={{
                        color: (trade.pnlSol ?? 0) >= 0 ? "rgb(4, 120, 87)" : "rgb(153, 27, 27)",
                      }}
                    >
                      {trade.pnlSol != null
                        ? `${trade.pnlSol >= 0 ? "+" : ""}${trade.pnlSol.toFixed(4)}`
                        : "-"}
                    </td>
                    <td className="p-2 text-roman-text/50">
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
          className="bg-roman-bg-card border-2 border-roman-gold/50 p-4"
        >
          <h2 className="font-serif text-sm text-roman-gold mb-4">LINEAGE</h2>
          <div className="flex items-center gap-4">
            {strategy.parentIds.map((parentId, i) => (
              <div key={parentId} className="flex items-center gap-2">
                <a
                  href={`/strategy/${parentId}`}
                  className="font-serif text-sm text-roman-purple hover:text-roman-purple/70"
                >
                  PARENT {i + 1}: {parentId.slice(0, 8)}
                </a>
                {i < strategy.parentIds.length - 1 && (
                  <span className="text-roman-text/30">+</span>
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
  color: "green" | "purple" | "gold" | "red";
}) {
  const colorClasses = {
    green: "text-emerald-700",
    purple: "text-roman-purple",
    gold: "text-roman-gold",
    red: "text-red-800",
  };

  return (
    <div className="bg-roman-bg-card p-3 border border-roman-stone">
      <p className="font-serif text-xs text-roman-text/50 mb-1">{label}</p>
      <p className={`font-serif text-sm ${colorClasses[color]}`}>{value}</p>
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
      <span className="text-roman-text/50">{label}</span>
      <span className="text-roman-text">{value}</span>
    </div>
  );
}

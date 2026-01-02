"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { Strategy, Trade, Position, StrategyPerformance } from "@/lib/types";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ARCHETYPE_COLORS } from "@/lib/sprites";

interface AgentWithDetails extends Strategy {
  trades?: Trade[];
  openPositions?: Position[];
  allocation?: number;
  liveStats?: {
    totalTrades: number;
    openTrades: number;
    closedTrades: number;
    realizedPnL: number;
  };
}

interface LiveData {
  trades: Trade[];
  positions: Position[];
}

export function AgentsDashboard() {
  const [agents, setAgents] = useState<AgentWithDetails[]>([]);
  const [liveData, setLiveData] = useState<LiveData>({ trades: [], positions: [] });
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"pnl" | "fitness" | "trades" | "openPositions">("pnl");
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const { subscribe, isConnected } = useWebSocket({ channels: ["trades", "positions", "strategies"] });

  const fetchData = useCallback(async () => {
    try {
      const [strategiesWithTrades, live] = await Promise.all([
        api.strategies.getWithTrades(),
        api.trades.getLive(),
      ]);

      const agentsWithDetails: AgentWithDetails[] = strategiesWithTrades.map((s) => {
        const openPos = live.positions.filter((p) => p.strategyId === s.id);
        return {
          ...s,
          openPositions: openPos,
          liveStats: s.liveStats,
        };
      });

      setAgents(agentsWithDetails);
      setLiveData(live);
    } catch (error) {
      console.error("Failed to fetch agents data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsubTradeOpened = subscribe("trade:opened", (trade: Trade) => {
      setLiveData((prev) => ({
        ...prev,
        trades: [trade, ...prev.trades.filter((t) => t.id !== trade.id)],
      }));
      setAgents((prev) =>
        prev.map((a) =>
          a.id === trade.strategyId
            ? {
                ...a,
                trades: [trade, ...(a.trades ?? []).filter((t) => t.id !== trade.id)],
                liveStats: a.liveStats
                  ? {
                      ...a.liveStats,
                      totalTrades: a.liveStats.totalTrades + 1,
                      openTrades: a.liveStats.openTrades + 1,
                    }
                  : undefined,
              }
            : a
        )
      );
    });

    const unsubTradeClosed = subscribe("trade:closed", (trade: Trade) => {
      setLiveData((prev) => ({
        ...prev,
        trades: prev.trades.map((t) => (t.id === trade.id ? trade : t)),
      }));
      setAgents((prev) =>
        prev.map((a) =>
          a.id === trade.strategyId
            ? {
                ...a,
                trades: (a.trades ?? []).map((t) => (t.id === trade.id ? trade : t)),
                liveStats: a.liveStats
                  ? {
                      ...a.liveStats,
                      openTrades: Math.max(0, a.liveStats.openTrades - 1),
                      closedTrades: a.liveStats.closedTrades + 1,
                      realizedPnL: a.liveStats.realizedPnL + (trade.pnlSol ?? 0),
                    }
                  : undefined,
              }
            : a
        )
      );
    });

    const unsubPositionUpdated = subscribe("position:updated", (position: Position) => {
      setLiveData((prev) => ({
        ...prev,
        positions: prev.positions.map((p) => (p.id === position.id ? position : p)),
      }));
      setAgents((prev) =>
        prev.map((a) =>
          a.id === position.strategyId
            ? {
                ...a,
                openPositions: (a.openPositions ?? []).map((p) =>
                  p.id === position.id ? position : p
                ),
              }
            : a
        )
      );
    });

    const unsubPerfUpdated = subscribe(
      "strategy:performance_updated",
      (data: { strategyId: string; performance: StrategyPerformance }) => {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === data.strategyId ? { ...a, performance: data.performance } : a
          )
        );
      }
    );

    return () => {
      unsubTradeOpened();
      unsubTradeClosed();
      unsubPositionUpdated();
      unsubPerfUpdated();
    };
  }, [subscribe]);

  const filteredAgents = agents
    .filter((a) => !showOnlyActive || a.status === "active")
    .sort((a, b) => {
      switch (sortBy) {
        case "pnl":
          return (b.liveStats?.realizedPnL ?? b.performance.totalPnL) - (a.liveStats?.realizedPnL ?? a.performance.totalPnL);
        case "fitness":
          return b.performance.fitnessScore - a.performance.fitnessScore;
        case "trades":
          return (b.liveStats?.totalTrades ?? 0) - (a.liveStats?.totalTrades ?? 0);
        case "openPositions":
          return (b.liveStats?.openTrades ?? 0) - (a.liveStats?.openTrades ?? 0);
        default:
          return 0;
      }
    });

  const totalPnL = agents.reduce((sum, a) => sum + (a.liveStats?.realizedPnL ?? a.performance.totalPnL), 0);
  const totalOpenPositions = liveData.positions.length;
  const totalTrades = agents.reduce((sum, a) => sum + (a.liveStats?.totalTrades ?? 0), 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-meta-bg-card animate-pulse" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-meta-bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="TOTAL PNL"
          value={`${totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(4)} SOL`}
          color={totalPnL >= 0 ? "green" : "red"}
        />
        <SummaryCard label="ACTIVE AGENTS" value={agents.filter((a) => a.status === "active").length} color="cyan" />
        <SummaryCard label="OPEN POSITIONS" value={totalOpenPositions} color="gold" />
        <SummaryCard label="TOTAL TRADES" value={totalTrades} color="green" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[7px] text-meta-green/50">SORT:</span>
          {(["pnl", "fitness", "trades", "openPositions"] as const).map((sort) => (
            <button
              key={sort}
              onClick={() => setSortBy(sort)}
              className={`font-pixel text-[7px] px-2 py-1 border transition-colors ${
                sortBy === sort
                  ? "border-meta-cyan text-meta-cyan bg-meta-cyan/10"
                  : "border-meta-green/30 text-meta-green/50 hover:border-meta-green"
              }`}
            >
              {sort === "openPositions" ? "POSITIONS" : sort.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={(e) => setShowOnlyActive(e.target.checked)}
              className="hidden"
            />
            <div
              className={`w-4 h-4 border-2 flex items-center justify-center transition-colors ${
                showOnlyActive ? "border-meta-cyan bg-meta-cyan/20" : "border-meta-green/30"
              }`}
            >
              {showOnlyActive && <span className="text-meta-cyan text-[8px]">✓</span>}
            </div>
            <span className="font-pixel text-[7px] text-meta-green/70">ACTIVE ONLY</span>
          </label>

          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-meta-green animate-pulse" : "bg-meta-red"
              }`}
            />
            <span className="font-pixel text-[6px] text-meta-green/50">
              {isConnected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-meta-bg-card border-2 border-meta-green">
        <div className="grid grid-cols-12 gap-2 p-3 border-b border-meta-green/30 font-pixel text-[6px] text-meta-green/50">
          <div className="col-span-3">AGENT</div>
          <div className="col-span-1 text-center">TYPE</div>
          <div className="col-span-2 text-right">PNL</div>
          <div className="col-span-1 text-right">WIN %</div>
          <div className="col-span-1 text-right">TRADES</div>
          <div className="col-span-1 text-right">OPEN</div>
          <div className="col-span-2 text-right">UNREALIZED</div>
          <div className="col-span-1 text-right">FITNESS</div>
        </div>

        <AnimatePresence>
          {filteredAgents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              isExpanded={expandedAgent === agent.id}
              onToggle={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
            />
          ))}
        </AnimatePresence>

        {filteredAgents.length === 0 && (
          <div className="p-8 text-center">
            <p className="font-pixel text-[8px] text-meta-green/50">NO AGENTS FOUND</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
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
    <div className="bg-meta-bg-card border-2 border-meta-green/30 p-4">
      <p className="font-pixel text-[6px] text-meta-green/50 mb-1">{label}</p>
      <p className={`font-pixel text-lg ${colorClasses[color]}`}>{value}</p>
    </div>
  );
}

function AgentRow({
  agent,
  isExpanded,
  onToggle,
}: {
  agent: AgentWithDetails;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [trades, setTrades] = useState<Trade[]>(agent.trades ?? []);
  const [loadingTrades, setLoadingTrades] = useState(false);

  const archetypeColor = ARCHETYPE_COLORS[agent.archetype ?? "momentum"] || "#00FF41";
  const realizedPnL = agent.liveStats?.realizedPnL ?? agent.performance.totalPnL;
  const pnlColor = realizedPnL >= 0 ? "#00FF41" : "#FF0051";
  const openPositions = agent.openPositions ?? [];
  const unrealizedPnL = openPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const totalTradesCount = agent.liveStats?.totalTrades ?? agent.performance.tradesExecuted;
  const openTradesCount = agent.liveStats?.openTrades ?? openPositions.length;

  useEffect(() => {
    if (isExpanded && trades.length === 0) {
      setLoadingTrades(true);
      api.trades
        .getByStrategy(agent.id)
        .then((data) => setTrades(data))
        .catch(console.error)
        .finally(() => setLoadingTrades(false));
    }
  }, [isExpanded, agent.id, trades.length]);

  return (
    <motion.div layout className="border-b border-meta-green/10">
      <div
        onClick={onToggle}
        className="grid grid-cols-12 gap-2 p-3 hover:bg-meta-green/5 transition-colors cursor-pointer"
      >
        <div className="col-span-3 flex items-center gap-2">
          <span
            className={`font-pixel text-[6px] transform transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
          <Link
            href={`/strategy/${agent.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-pixel text-[7px] text-meta-green hover:text-meta-cyan truncate"
          >
            {agent.name || `AGENT-${agent.id.slice(0, 8)}`}
          </Link>
          {agent.status !== "active" && (
            <span className="font-pixel text-[5px] px-1 py-0.5 bg-meta-red/20 text-meta-red">
              {agent.status.toUpperCase()}
            </span>
          )}
        </div>

        <div className="col-span-1 flex justify-center">
          <span
            className="font-pixel text-[6px] px-1 py-0.5"
            style={{ backgroundColor: archetypeColor, color: "#0a0a0f" }}
          >
            {agent.archetype?.slice(0, 3).toUpperCase()}
          </span>
        </div>

        <div className="col-span-2 font-pixel text-[7px] text-right" style={{ color: pnlColor }}>
          {realizedPnL >= 0 ? "+" : ""}
          {realizedPnL.toFixed(4)} SOL
        </div>

        <div className="col-span-1 font-pixel text-[7px] text-meta-cyan text-right">
          {(agent.performance.winRate * 100).toFixed(0)}%
        </div>

        <div className="col-span-1 font-pixel text-[7px] text-meta-green/70 text-right">
          {totalTradesCount}
        </div>

        <div className="col-span-1 font-pixel text-[7px] text-right">
          {openTradesCount > 0 ? (
            <span className="text-meta-gold">{openTradesCount}</span>
          ) : (
            <span className="text-meta-green/30">0</span>
          )}
        </div>

        <div
          className="col-span-2 font-pixel text-[7px] text-right"
          style={{ color: unrealizedPnL >= 0 ? "#00FF41" : "#FF0051" }}
        >
          {openPositions.length > 0 ? (
            <>
              {unrealizedPnL >= 0 ? "+" : ""}
              {unrealizedPnL.toFixed(4)} SOL
            </>
          ) : (
            <span className="text-meta-green/30">-</span>
          )}
        </div>

        <div className="col-span-1 font-pixel text-[7px] text-meta-gold text-right">
          {agent.performance.fitnessScore.toFixed(1)}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-meta-bg-light border-t border-meta-green/20"
          >
            {openPositions.length > 0 && (
              <div className="p-4 border-b border-meta-green/10">
                <h4 className="font-pixel text-[7px] text-meta-gold mb-3">OPEN POSITIONS</h4>
                <div className="space-y-2">
                  {openPositions.map((pos) => (
                    <PositionRow key={pos.id} position={pos} />
                  ))}
                </div>
              </div>
            )}

            <div className="p-4">
              <h4 className="font-pixel text-[7px] text-meta-cyan mb-3">RECENT TRADES</h4>
              {loadingTrades ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-8 bg-meta-bg-card animate-pulse" />
                  ))}
                </div>
              ) : trades.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {trades.slice(0, 15).map((trade) => (
                    <TradeRow key={trade.id} trade={trade} />
                  ))}
                </div>
              ) : (
                <p className="font-pixel text-[6px] text-meta-green/50">NO TRADES YET</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PositionRow({ position }: { position: Position }) {
  const pnlColor = position.unrealizedPnL >= 0 ? "#00FF41" : "#FF0051";
  const tokenAddress = position.token?.address ?? position.tokenAddress ?? position.trade?.tokenAddress;
  const tokenSymbol = position.token?.symbol ?? position.tokenSymbol ?? position.trade?.tokenSymbol ?? "???";
  const tokenName = position.token?.name ?? position.tokenName ?? position.trade?.tokenName ?? "";

  return (
    <div className="grid grid-cols-6 gap-2 p-2 bg-meta-bg-card border border-meta-gold/20">
      <div className="col-span-2">
        {tokenAddress ? (
          <a
            href={`https://pump.fun/${tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-pixel text-[7px] text-meta-green hover:text-meta-cyan"
          >
            {tokenSymbol}
          </a>
        ) : (
          <span className="font-pixel text-[7px] text-meta-green">{tokenSymbol}</span>
        )}
        <p className="font-pixel text-[5px] text-meta-green/50">{tokenName}</p>
      </div>
      <div className="text-right">
        <p className="font-pixel text-[5px] text-meta-green/50">ENTRY</p>
        <p className="font-pixel text-[6px] text-meta-green">${position.entryPrice.toFixed(8)}</p>
      </div>
      <div className="text-right">
        <p className="font-pixel text-[5px] text-meta-green/50">CURRENT</p>
        <p className="font-pixel text-[6px] text-meta-cyan">${position.currentPrice.toFixed(8)}</p>
      </div>
      <div className="text-right">
        <p className="font-pixel text-[5px] text-meta-green/50">SIZE</p>
        <p className="font-pixel text-[6px] text-meta-green">{position.amountSol.toFixed(4)} SOL</p>
      </div>
      <div className="text-right">
        <p className="font-pixel text-[5px] text-meta-green/50">UNREALIZED</p>
        <p className="font-pixel text-[7px]" style={{ color: pnlColor }}>
          {position.unrealizedPnL >= 0 ? "+" : ""}
          {position.unrealizedPnL.toFixed(4)} SOL
          <span className="text-[5px] ml-1">
            ({position.unrealizedPnLPercent >= 0 ? "+" : ""}
            {(position.unrealizedPnLPercent * 100).toFixed(1)}%)
          </span>
        </p>
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const isOpen = trade.status === "open";
  const pnl = trade.pnlSol ?? 0;
  const pnlColor = pnl >= 0 ? "#00FF41" : "#FF0051";

  return (
    <div className="grid grid-cols-8 gap-2 p-2 bg-meta-bg-card/50 border border-meta-green/10 text-[6px]">
      <div className="col-span-2 flex items-center gap-1">
        <span className={`font-pixel ${isOpen ? "text-meta-cyan" : pnl >= 0 ? "text-meta-green" : "text-meta-red"}`}>
          {isOpen ? "OPEN" : "CLOSED"}
        </span>
        <a
          href={`https://pump.fun/${trade.tokenAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-pixel text-meta-green hover:text-meta-cyan truncate"
        >
          {trade.tokenSymbol}
        </a>
      </div>
      <div className="text-right text-meta-green/70">${trade.entryPrice.toFixed(8)}</div>
      <div className="text-right text-meta-green/70">
        {trade.exitPrice ? `$${trade.exitPrice.toFixed(8)}` : "-"}
      </div>
      <div className="text-right text-meta-green">{trade.amountSol.toFixed(4)} SOL</div>
      <div className="text-right" style={{ color: isOpen ? "#888" : pnlColor }}>
        {isOpen ? "-" : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)}`}
      </div>
      <div className="text-right text-meta-green/50">{trade.exitReason?.toUpperCase() || "-"}</div>
      <div className="text-right text-meta-green/30">
        {new Date(trade.entryTimestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

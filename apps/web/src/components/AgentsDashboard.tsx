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
        <div className="h-24 bg-roman-bg-light animate-pulse rounded" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-roman-bg-light animate-pulse rounded" />
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
          positive={totalPnL >= 0}
        />
        <SummaryCard label="ACTIVE LEGIONS" value={agents.filter((a) => a.status === "active").length} />
        <SummaryCard label="OPEN POSITIONS" value={totalOpenPositions} />
        <SummaryCard label="TOTAL TRADES" value={totalTrades} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-sans text-sm text-roman-stone">SORT:</span>
          {(["pnl", "fitness", "trades", "openPositions"] as const).map((sort) => (
            <button
              key={sort}
              onClick={() => setSortBy(sort)}
              className={`font-sans text-sm px-3 py-2 border-2 rounded transition-colors min-h-[44px] ${
                sortBy === sort
                  ? "border-roman-stone text-roman-text bg-roman-bg-light"
                  : "border-roman-stone/30 text-roman-stone hover:border-roman-stone"
              }`}
            >
              {sort === "openPositions" ? "POSITIONS" : sort.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={(e) => setShowOnlyActive(e.target.checked)}
              className="hidden"
            />
            <div
              className={`w-5 h-5 border-2 flex items-center justify-center rounded transition-colors ${
                showOnlyActive ? "border-roman-stone bg-roman-stone/20" : "border-roman-stone/30"
              }`}
            >
              {showOnlyActive && <span className="text-roman-text text-sm">✓</span>}
            </div>
            <span className="font-sans text-sm text-roman-text">ACTIVE ONLY</span>
          </label>

          <div className="flex items-center gap-2 px-3 py-2 bg-roman-bg-light rounded border border-roman-stone/30">
            <div
              className={`h-3 w-3 rounded-full ${
                isConnected ? "bg-emerald-600 animate-pulse" : "bg-red-700"
              }`}
            />
            <span className="font-sans text-sm text-roman-stone">
              {isConnected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      <div className="roman-tablet overflow-hidden">
        {/* Desktop table header - hidden on mobile */}
        <div className="hidden md:grid grid-cols-12 gap-2 p-4 border-b-2 border-roman-stone/30 font-sans text-sm text-roman-stone font-medium">
          <div className="col-span-3">LEGION</div>
          <div className="col-span-1 text-center">TYPE</div>
          <div className="col-span-2 text-right">PNL</div>
          <div className="col-span-1 text-right">WIN%</div>
          <div className="col-span-1 text-right">TRADES</div>
          <div className="col-span-1 text-right">OPEN</div>
          <div className="col-span-2 text-right">UNREALIZED</div>
          <div className="col-span-1 text-right">FITNESS</div>
        </div>

        {filteredAgents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-sans text-lg text-roman-stone">NO LEGIONS FOUND</p>
          </div>
        ) : (
          filteredAgents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              isExpanded={expandedAgent === agent.id}
              onToggle={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string | number;
  positive?: boolean;
}) {
  const valueColor = positive === undefined ? "text-roman-text" : positive ? "text-emerald-700" : "text-red-800";

  return (
    <div className="roman-tablet p-3 sm:p-4 overflow-hidden">
      <p className="font-sans text-xs sm:text-sm text-roman-stone mb-1">{label}</p>
      <p className={`font-serif text-base sm:text-2xl font-bold ${valueColor} break-all`}>{value}</p>
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

  const archetypeColor = ARCHETYPE_COLORS[agent.archetype ?? "momentum"] || "#8B7355";
  const realizedPnL = agent.liveStats?.realizedPnL ?? agent.performance.totalPnL;
  const pnlPositive = realizedPnL >= 0;
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
    <motion.div layout className="border-b border-roman-stone/20">
      {/* Mobile card layout */}
      <div
        onClick={onToggle}
        className="md:hidden p-4 hover:bg-roman-bg-light/50 transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={`font-sans text-sm transform transition-transform flex-shrink-0 ${
                isExpanded ? "rotate-90" : ""
              }`}
            >
              ▶
            </span>
            <Link
              href={`/strategy/${agent.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-serif text-base text-roman-text hover:text-roman-stone truncate"
            >
              {agent.name || `AGENT-${agent.id.slice(0, 8)}`}
            </Link>
            {agent.status !== "active" && (
              <span className="font-sans text-xs px-2 py-1 bg-red-100 text-red-800 rounded flex-shrink-0">
                {agent.status.toUpperCase()}
              </span>
            )}
          </div>
          <div className={`font-sans text-sm font-medium flex-shrink-0 ${pnlPositive ? "text-emerald-700" : "text-red-800"}`}>
            {pnlPositive ? "+" : ""}{realizedPnL.toFixed(2)} SOL
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-roman-stone">Win: </span>
            <span className="text-roman-text">{(agent.performance.winRate * 100).toFixed(0)}%</span>
          </div>
          <div>
            <span className="text-roman-stone">Trades: </span>
            <span className="text-roman-text">{totalTradesCount}</span>
          </div>
          <div>
            <span className="text-roman-stone">Open: </span>
            <span className={openTradesCount > 0 ? "text-amber-700 font-medium" : "text-roman-stone"}>
              {openTradesCount}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop table row */}
      <div
        onClick={onToggle}
        className="hidden md:grid grid-cols-12 gap-2 p-4 hover:bg-roman-bg-light/50 transition-colors cursor-pointer min-h-[56px] items-center"
      >
        <div className="col-span-3 flex items-center gap-3">
          <span
            className={`font-sans text-sm transform transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
          <Link
            href={`/strategy/${agent.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-serif text-base text-roman-text hover:text-roman-stone truncate"
          >
            {agent.name || `AGENT-${agent.id.slice(0, 8)}`}
          </Link>
          {agent.status !== "active" && (
            <span className="font-sans text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
              {agent.status.toUpperCase()}
            </span>
          )}
        </div>

        <div className="col-span-1 flex justify-center">
          <span
            className="font-sans text-xs px-2 py-1 rounded text-white"
            style={{ backgroundColor: archetypeColor }}
          >
            {agent.archetype?.slice(0, 3).toUpperCase()}
          </span>
        </div>

        <div className={`col-span-2 font-sans text-base text-right font-medium ${pnlPositive ? "text-emerald-700" : "text-red-800"}`}>
          {pnlPositive ? "+" : ""}
          {realizedPnL.toFixed(4)} SOL
        </div>

        <div className="col-span-1 font-sans text-base text-roman-text text-right">
          {(agent.performance.winRate * 100).toFixed(0)}%
        </div>

        <div className="col-span-1 font-sans text-base text-roman-text text-right">
          {totalTradesCount}
        </div>

        <div className="col-span-1 font-sans text-base text-right">
          {openTradesCount > 0 ? (
            <span className="text-amber-700 font-medium">{openTradesCount}</span>
          ) : (
            <span className="text-roman-stone">0</span>
          )}
        </div>

        <div className={`col-span-2 font-sans text-base text-right ${unrealizedPnL >= 0 ? "text-emerald-700" : "text-red-800"}`}>
          {openPositions.length > 0 ? (
            <>
              {unrealizedPnL >= 0 ? "+" : ""}
              {unrealizedPnL.toFixed(4)} SOL
            </>
          ) : (
            <span className="text-roman-stone">-</span>
          )}
        </div>

        <div className="col-span-1 font-sans text-base text-roman-text text-right font-medium">
          {agent.performance.fitnessScore.toFixed(1)}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-roman-bg-light border-t-2 border-roman-stone/20"
          >
            {openPositions.length > 0 && (
              <div className="p-4 border-b border-roman-stone/20">
                <h4 className="font-serif text-lg text-roman-text mb-3">ACTIVE HOLDINGS</h4>
                <div className="space-y-2">
                  {openPositions.map((pos) => (
                    <PositionRow key={pos.id} position={pos} />
                  ))}
                </div>
              </div>
            )}

            <div className="p-4">
              <h4 className="font-serif text-lg text-roman-text mb-3">RECENT CAMPAIGNS</h4>
              {loadingTrades ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-roman-bg-card animate-pulse rounded" />
                  ))}
                </div>
              ) : trades.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {trades.slice(0, 15).map((trade) => (
                    <TradeRow key={trade.id} trade={trade} />
                  ))}
                </div>
              ) : (
                <p className="font-sans text-base text-roman-stone">NO CAMPAIGNS YET</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PositionRow({ position }: { position: Position }) {
  const pnlPositive = position.unrealizedPnL >= 0;
  const tokenAddress = position.token?.address ?? position.tokenAddress ?? position.trade?.tokenAddress;
  const tokenSymbol = position.token?.symbol ?? position.tokenSymbol ?? position.trade?.tokenSymbol ?? "???";
  const tokenName = position.token?.name ?? position.tokenName ?? position.trade?.tokenName ?? "";

  return (
    <div className="p-3 bg-roman-bg-card border border-roman-stone/30 rounded">
      {/* Mobile layout */}
      <div className="md:hidden space-y-2">
        <div className="flex items-start justify-between">
          <div>
            {tokenAddress ? (
              <a
                href={`https://pump.fun/${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-serif text-base text-roman-text hover:text-roman-stone font-medium"
              >
                {tokenSymbol}
              </a>
            ) : (
              <span className="font-serif text-base text-roman-text font-medium">{tokenSymbol}</span>
            )}
            <p className="font-sans text-sm text-roman-stone">{tokenName}</p>
          </div>
          <div className="text-right">
            <p className={`font-sans text-base font-medium ${pnlPositive ? "text-emerald-700" : "text-red-800"}`}>
              {pnlPositive ? "+" : ""}{position.unrealizedPnL.toFixed(4)} SOL
            </p>
            <p className={`font-sans text-xs ${pnlPositive ? "text-emerald-700" : "text-red-800"}`}>
              ({position.unrealizedPnLPercent >= 0 ? "+" : ""}{(position.unrealizedPnLPercent * 100).toFixed(1)}%)
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-roman-stone">Entry: </span>
            <span className="text-roman-text">${position.entryPrice.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-roman-stone">Now: </span>
            <span className="text-roman-text">${position.currentPrice.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-roman-stone">Size: </span>
            <span className="text-roman-text">{position.amountSol.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:grid grid-cols-6 gap-3">
        <div className="col-span-2">
          {tokenAddress ? (
            <a
              href={`https://pump.fun/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-serif text-base text-roman-text hover:text-roman-stone font-medium"
            >
              {tokenSymbol}
            </a>
          ) : (
            <span className="font-serif text-base text-roman-text font-medium">{tokenSymbol}</span>
          )}
          <p className="font-sans text-sm text-roman-stone">{tokenName}</p>
        </div>
        <div className="text-right">
          <p className="font-sans text-xs text-roman-stone">ENTRY</p>
          <p className="font-sans text-sm text-roman-text">${position.entryPrice.toFixed(8)}</p>
        </div>
        <div className="text-right">
          <p className="font-sans text-xs text-roman-stone">CURRENT</p>
          <p className="font-sans text-sm text-roman-text">${position.currentPrice.toFixed(8)}</p>
        </div>
        <div className="text-right">
          <p className="font-sans text-xs text-roman-stone">SIZE</p>
          <p className="font-sans text-sm text-roman-text">{position.amountSol.toFixed(4)} SOL</p>
        </div>
        <div className="text-right">
          <p className="font-sans text-xs text-roman-stone">UNREALIZED</p>
          <p className={`font-sans text-base font-medium ${pnlPositive ? "text-emerald-700" : "text-red-800"}`}>
            {pnlPositive ? "+" : ""}
            {position.unrealizedPnL.toFixed(4)} SOL
            <span className="text-sm ml-1">
              ({position.unrealizedPnLPercent >= 0 ? "+" : ""}
              {(position.unrealizedPnLPercent * 100).toFixed(1)}%)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const isOpen = trade.status === "open";
  const pnl = trade.pnlSol ?? 0;
  const pnlPositive = pnl >= 0;

  return (
    <div className="p-3 bg-roman-bg-card border border-roman-stone/20 rounded text-sm">
      {/* Mobile layout */}
      <div className="md:hidden space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className={`font-sans font-medium ${isOpen ? "text-amber-700" : pnlPositive ? "text-emerald-700" : "text-red-800"}`}>
              {isOpen ? "OPEN" : "CLOSED"}
            </span>
            <a
              href={`https://pump.fun/${trade.tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-roman-text hover:text-roman-stone"
            >
              {trade.tokenSymbol}
            </a>
          </div>
          <div className={`font-medium ${isOpen ? "text-roman-stone" : pnlPositive ? "text-emerald-700" : "text-red-800"}`}>
            {isOpen ? "-" : `${pnlPositive ? "+" : ""}${pnl.toFixed(4)} SOL`}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-roman-stone">Entry: </span>
            <span className="text-roman-text">${(trade.entryPrice ?? 0).toFixed(6)}</span>
          </div>
          <div>
            <span className="text-roman-stone">Size: </span>
            <span className="text-roman-text">{(trade.amountSol ?? 0).toFixed(4)} SOL</span>
          </div>
          <div>
            <span className="text-roman-stone">Time: </span>
            <span className="text-roman-text">{new Date(trade.entryTimestamp).toLocaleTimeString()}</span>
          </div>
          {trade.exitReason && (
            <div>
              <span className="text-roman-stone">Reason: </span>
              <span className="text-roman-text">{trade.exitReason.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:grid grid-cols-8 gap-2">
        <div className="col-span-2 flex items-center gap-2">
          <span className={`font-sans font-medium ${isOpen ? "text-amber-700" : pnlPositive ? "text-emerald-700" : "text-red-800"}`}>
            {isOpen ? "OPEN" : "CLOSED"}
          </span>
          <a
            href={`https://pump.fun/${trade.tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-roman-text hover:text-roman-stone truncate"
          >
            {trade.tokenSymbol}
          </a>
        </div>
        <div className="text-right text-roman-stone">${(trade.entryPrice ?? 0).toFixed(8)}</div>
        <div className="text-right text-roman-stone">
          {trade.exitPrice ? `$${trade.exitPrice.toFixed(8)}` : "-"}
        </div>
        <div className="text-right text-roman-text">{(trade.amountSol ?? 0).toFixed(4)} SOL</div>
        <div className={`text-right font-medium ${isOpen ? "text-roman-stone" : pnlPositive ? "text-emerald-700" : "text-red-800"}`}>
          {isOpen ? "-" : `${pnlPositive ? "+" : ""}${pnl.toFixed(4)}`}
        </div>
        <div className="text-right text-roman-stone">{trade.exitReason?.toUpperCase() || "-"}</div>
        <div className="text-right text-roman-stone">
          {new Date(trade.entryTimestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

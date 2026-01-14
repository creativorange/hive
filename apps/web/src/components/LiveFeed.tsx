"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Trade, EvolutionCycle, Strategy } from "@/lib/types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { api } from "@/lib/api";

interface FeedItem {
  id: string;
  type: "trade_opened" | "trade_closed" | "strategy_born" | "strategy_died" | "evolution_cycle";
  timestamp: number;
  data: Trade | EvolutionCycle | { strategyId: string; name?: string };
}

const MAX_FEED_ITEMS = 50;

export function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  const { subscribe, isConnected } = useWebSocket({ channels: ["trades", "evolution"] });

  const strategyMap = useMemo(() => {
    const map = new Map<string, Strategy>();
    strategies.forEach((s) => map.set(s.id, s));
    return map;
  }, [strategies]);

  const addItem = useCallback((item: FeedItem) => {
    setItems((prev) => [item, ...prev].slice(0, MAX_FEED_ITEMS));
  }, []);

  useEffect(() => {
    async function fetchInitial() {
      try {
        const [trades, strategiesData] = await Promise.all([
          api.trades.getRecent(),
          api.strategies.getAll(),
        ]);
        setStrategies(strategiesData);
        const initialItems: FeedItem[] = trades.slice(0, 20).map((trade) => ({
          id: trade.id,
          type: trade.status === "open" ? "trade_opened" : "trade_closed",
          timestamp: new Date(trade.entryTimestamp).getTime(),
          data: trade,
        }));
        setItems(initialItems);
      } catch (error) {
        console.error("Failed to fetch initial trades:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchInitial();
  }, []);

  useEffect(() => {
    const unsubOpen = subscribe("trade:opened", (trade: Trade) => {
      addItem({
        id: `open-${trade.id}`,
        type: "trade_opened",
        timestamp: Date.now(),
        data: trade,
      });
    });

    const unsubClose = subscribe("trade:closed", (trade: Trade) => {
      addItem({
        id: `close-${trade.id}`,
        type: "trade_closed",
        timestamp: Date.now(),
        data: trade,
      });
    });

    const unsubCycle = subscribe("evolution:cycle", (cycle: EvolutionCycle) => {
      addItem({
        id: `cycle-${cycle.id}`,
        type: "evolution_cycle",
        timestamp: Date.now(),
        data: cycle,
      });
    });

    return () => {
      unsubOpen();
      unsubClose();
      unsubCycle();
    };
  }, [subscribe, addItem]);

  return (
    <div className="bg-roman-bg-card border-2 border-roman-gold p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl text-roman-text">IMPERIAL CHRONICLE</h2>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-roman-gold animate-pulse" : "bg-roman-crimson"
            }`}
          />
          <span className="font-sans text-sm text-roman-stone">
            {isConnected ? "ACTIVE" : "INACTIVE"}
          </span>
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-roman-bg-light animate-pulse border border-roman-gold/20"
              />
            ))}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <FeedItemRow key={item.id} item={item} strategyMap={strategyMap} />
            ))}
          </AnimatePresence>
        )}

        {!loading && items.length === 0 && (
          <p className="font-sans text-lg text-roman-stone text-center py-8">
            AWAITING IMPERIAL DECREES...
          </p>
        )}
      </div>
    </div>
  );
}

function FeedItemRow({
  item,
  strategyMap,
}: {
  item: FeedItem;
  strategyMap: Map<string, Strategy>;
}) {
  const timeAgo = getTimeAgo(item.timestamp);

  const getStrategyName = (strategyId: string) => {
    const strategy = strategyMap.get(strategyId);
    return strategy?.name || `Agent ${strategyId.slice(0, 6)}`;
  };

  const renderTradeContent = (trade: Trade, isOpen: boolean) => {
    const pnl = trade.pnlSol ?? 0;
    const isProfit = pnl >= 0;
    const actionColor = isOpen ? "text-emerald-700" : isProfit ? "text-emerald-700" : "text-red-800";

    return (
      <div className="flex flex-col gap-1 min-w-0">
        {/* Row 1: Action + Agent */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-serif text-lg ${actionColor}`}>
            {isOpen ? "ACQUIRE" : "DIVEST"}
          </span>
          <span className="font-sans text-sm text-roman-stone truncate">
            {getStrategyName(trade.strategyId)}
          </span>
        </div>

        {/* Row 2: Token + Amount + PnL */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-sans text-base text-roman-text font-semibold truncate">
            {trade.tokenSymbol}
          </span>
          <span className="font-sans text-sm text-roman-stone">
            {trade.amountSol.toFixed(4)} SOL
          </span>
          {!isOpen && (
            <>
              <span className={`font-sans text-sm ${isProfit ? "text-emerald-700" : "text-red-800"}`}>
                {isProfit ? "+" : ""}{pnl.toFixed(4)} SOL
              </span>
              {trade.exitReason && (
                <span className="font-sans text-xs text-roman-stone">
                  ({trade.exitReason.toUpperCase()})
                </span>
              )}
            </>
          )}
        </div>

        {/* Row 3: Timestamp + PUMP link */}
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs text-roman-stone">{timeAgo}</span>
          <a
            href={`https://pump.fun/${trade.tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-xs px-1.5 py-0.5 bg-roman-gold/20 text-roman-text hover:bg-roman-gold/40 transition-colors"
          >
            PUMP
          </a>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (item.type) {
      case "trade_opened": {
        const trade = item.data as Trade;
        return renderTradeContent(trade, true);
      }

      case "trade_closed": {
        const trade = item.data as Trade;
        return renderTradeContent(trade, false);
      }

      case "evolution_cycle": {
        const cycle = item.data as EvolutionCycle;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg text-roman-text">SUCCESSION</span>
              <span className="font-sans text-base text-roman-text font-semibold">
                GEN {cycle.generation}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-sans text-sm text-roman-stone">
                +{cycle.newlyBorn.length} born / -{cycle.dead.length} dead
              </span>
              <span className="font-sans text-xs text-roman-stone">{timeAgo}</span>
            </div>
          </div>
        );
      }

      case "strategy_born": {
        const data = item.data as { strategyId: string; name?: string };
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg text-emerald-700">ASCENDED</span>
              <span className="font-sans text-base text-roman-text font-semibold truncate">
                {data.name || data.strategyId.slice(0, 8)}
              </span>
            </div>
            <span className="font-sans text-xs text-roman-stone">{timeAgo}</span>
          </div>
        );
      }

      case "strategy_died": {
        const data = item.data as { strategyId: string; name?: string };
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg text-red-800">FALLEN</span>
              <span className="font-sans text-base text-roman-stone line-through truncate">
                {data.name || data.strategyId.slice(0, 8)}
              </span>
            </div>
            <span className="font-sans text-xs text-roman-stone">{timeAgo}</span>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const getBorderColor = () => {
    switch (item.type) {
      case "trade_opened":
        return "border-roman-purple-light/30";
      case "trade_closed": {
        const trade = item.data as Trade;
        return (trade.pnlSol ?? 0) >= 0
          ? "border-roman-gold/30"
          : "border-roman-crimson/30";
      }
      case "evolution_cycle":
        return "border-roman-gold-light/30";
      case "strategy_born":
        return "border-roman-purple-light/30";
      case "strategy_died":
        return "border-roman-crimson/30";
      default:
        return "border-roman-gold/30";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, height: 0 }}
      animate={{ opacity: 1, x: 0, height: "auto" }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ duration: 0.2 }}
      className={`bg-roman-bg-light p-3 border ${getBorderColor()}`}
    >
      {renderContent()}
    </motion.div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

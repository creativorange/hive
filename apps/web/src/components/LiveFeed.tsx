"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Trade, EvolutionCycle } from "@/lib/types";
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
  const [loading, setLoading] = useState(true);

  const { subscribe, isConnected } = useWebSocket({ channels: ["trades", "evolution"] });

  const addItem = useCallback((item: FeedItem) => {
    setItems((prev) => [item, ...prev].slice(0, MAX_FEED_ITEMS));
  }, []);

  useEffect(() => {
    async function fetchInitial() {
      try {
        const trades = await api.trades.getRecent();
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
    <div className="bg-meta-bg-card border-2 border-meta-green p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-sm text-meta-cyan">LIVE FEED</h2>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-meta-green animate-pulse" : "bg-meta-red"
            }`}
          />
          <span className="font-pixel text-[6px] text-meta-green/50">
            {isConnected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-meta-bg-light animate-pulse border border-meta-green/20"
              />
            ))}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <FeedItemRow key={item.id} item={item} />
            ))}
          </AnimatePresence>
        )}

        {!loading && items.length === 0 && (
          <p className="font-pixel text-[8px] text-meta-green/50 text-center py-8">
            WAITING FOR ACTIVITY...
          </p>
        )}
      </div>
    </div>
  );
}

function FeedItemRow({ item }: { item: FeedItem }) {
  const timeAgo = getTimeAgo(item.timestamp);

  const renderContent = () => {
    switch (item.type) {
      case "trade_opened": {
        const trade = item.data as Trade;
        return (
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[8px] text-meta-cyan">BUY</span>
            <a
              href={`https://pump.fun/${trade.tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-pixel text-[7px] text-meta-green hover:text-meta-cyan transition-colors"
            >
              {trade.tokenSymbol}
            </a>
            <span className="font-pixel text-[6px] text-meta-green/50">
              {trade.amountSol.toFixed(4)} SOL
            </span>
            <a
              href={`https://pump.fun/${trade.tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-pixel text-[5px] px-1 py-0.5 bg-meta-green/20 text-meta-green hover:bg-meta-green/40 transition-colors"
            >
              PUMP
            </a>
          </div>
        );
      }

      case "trade_closed": {
        const trade = item.data as Trade;
        const pnl = trade.pnlSol ?? 0;
        const isProfit = pnl >= 0;
        return (
          <div className="flex items-center gap-2">
            <span
              className={`font-pixel text-[8px] ${
                isProfit ? "text-meta-green" : "text-meta-red"
              }`}
            >
              SELL
            </span>
            <a
              href={`https://pump.fun/${trade.tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-pixel text-[7px] text-meta-green hover:text-meta-cyan transition-colors"
            >
              {trade.tokenSymbol}
            </a>
            <span
              className={`font-pixel text-[6px] ${
                isProfit ? "text-meta-green" : "text-meta-red"
              }`}
            >
              {isProfit ? "+" : ""}
              {pnl.toFixed(4)} SOL
            </span>
            <span className="font-pixel text-[5px] text-meta-green/30">
              ({trade.exitReason?.toUpperCase()})
            </span>
            <a
              href={`https://pump.fun/${trade.tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-pixel text-[5px] px-1 py-0.5 bg-meta-green/20 text-meta-green hover:bg-meta-green/40 transition-colors"
            >
              PUMP
            </a>
          </div>
        );
      }

      case "evolution_cycle": {
        const cycle = item.data as EvolutionCycle;
        return (
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[8px] text-meta-gold">EVOLUTION</span>
            <span className="font-pixel text-[7px] text-meta-green">
              GEN {cycle.generation}
            </span>
            <span className="font-pixel text-[6px] text-meta-green/50">
              +{cycle.newlyBorn.length} born / -{cycle.dead.length} dead
            </span>
          </div>
        );
      }

      case "strategy_born": {
        const data = item.data as { strategyId: string; name?: string };
        return (
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[8px] text-meta-cyan">BORN</span>
            <span className="font-pixel text-[7px] text-meta-green">
              {data.name || data.strategyId.slice(0, 8)}
            </span>
          </div>
        );
      }

      case "strategy_died": {
        const data = item.data as { strategyId: string; name?: string };
        return (
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[8px] text-meta-red">DIED</span>
            <span className="font-pixel text-[7px] text-meta-green/50 line-through">
              {data.name || data.strategyId.slice(0, 8)}
            </span>
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
        return "border-meta-cyan/30";
      case "trade_closed": {
        const trade = item.data as Trade;
        return (trade.pnlSol ?? 0) >= 0
          ? "border-meta-green/30"
          : "border-meta-red/30";
      }
      case "evolution_cycle":
        return "border-meta-gold/30";
      case "strategy_born":
        return "border-meta-cyan/30";
      case "strategy_died":
        return "border-meta-red/30";
      default:
        return "border-meta-green/30";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, height: 0 }}
      animate={{ opacity: 1, x: 0, height: "auto" }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ duration: 0.2 }}
      className={`bg-meta-bg-light p-2 border ${getBorderColor()}`}
    >
      <div className="flex items-center justify-between">
        {renderContent()}
        <span className="font-pixel text-[5px] text-meta-green/30">{timeAgo}</span>
      </div>
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

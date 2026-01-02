"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Trade, Position, PumpFunToken, EvolutionCycle, WebSocketMessage, Treasury, TradingStats, StrategyPerformance } from "@/lib/types";

type SubscriptionChannel = "trades" | "evolution" | "strategies" | "prices" | "positions" | "treasury" | "all";

interface UseWebSocketOptions {
  url?: string;
  channels?: SubscriptionChannel[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface WebSocketState {
  isConnected: boolean;
  clientId: string | null;
  error: Error | null;
}

type EventCallback<T> = (data: T) => void;

interface WebSocketEvents {
  "trade:opened": Trade;
  "trade:closed": Trade;
  "position:updated": Position;
  "token:discovered": PumpFunToken;
  "signal:generated": { action: string; strategyId: string; tokenSymbol: string; confidence: number; score: number };
  "evolution:cycle": EvolutionCycle;
  "evolution:started": { timestamp: number; strategiesCount: number };
  "evolution:completed": { cycle: EvolutionCycle };
  "evolution:births": { count: number; ids: string[] };
  "evolution:deaths": { count: number; ids: string[] };
  "strategy:born": { strategy: unknown };
  "strategy:died": { strategyId: string };
  "strategy:performance_updated": { strategyId: string; performance: StrategyPerformance };
  "treasury:updated": Treasury;
  "strategies:loaded": { count: number; allocationPerStrategy: number; totalAllocated: number };
  "simulator:started": { timestamp: number; status: unknown };
  "simulator:stopped": { timestamp: number };
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws",
    channels = ["all"],
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    clientId: null,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listenersRef = useRef<Map<string, Set<EventCallback<unknown>>>>(new Map());

  const subscribe = useCallback(<K extends keyof WebSocketEvents>(
    event: K,
    callback: EventCallback<WebSocketEvents[K]>
  ) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback as EventCallback<unknown>);

    return () => {
      listenersRef.current.get(event)?.delete(callback as EventCallback<unknown>);
    };
  }, []);

  const emit = useCallback((event: string, data: unknown) => {
    const listeners = listenersRef.current.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }, []);

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribeToChannels = useCallback((newChannels: SubscriptionChannel[]) => {
    send({ type: "subscribe", channels: newChannels });
  }, [send]);

  const unsubscribeFromChannels = useCallback((channelsToRemove: SubscriptionChannel[]) => {
    send({ type: "unsubscribe", channels: channelsToRemove });
  }, [send]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true, error: null }));
        reconnectAttemptsRef.current = 0;

        if (channels.length > 0 && !channels.includes("all")) {
          subscribeToChannels(channels);
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage & { clientId?: string };

          if (message.type === "connected" && message.clientId) {
            setState((prev) => ({ ...prev, clientId: message.clientId ?? null }));
            return;
          }

          if (message.type === "pong") return;

          emit(message.type, message.data);
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err);
        }
      };

      wsRef.current.onclose = () => {
        setState((prev) => ({ ...prev, isConnected: false }));

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current.onerror = (event) => {
        console.error("[WebSocket] Error:", event);
        setState((prev) => ({ ...prev, error: new Error("WebSocket error") }));
      };
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err : new Error("Failed to connect"),
      }));
    }
  }, [url, channels, emit, subscribeToChannels, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = maxReconnectAttempts;
    wsRef.current?.close();
  }, [maxReconnectAttempts]);

  useEffect(() => {
    let isMounted = true;
    
    // Delay connection slightly to handle React Strict Mode double-mount
    const connectTimeout = setTimeout(() => {
      if (isMounted) {
        connect();
      }
    }, 100);

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearTimeout(connectTimeout);
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectAttemptsRef.current = maxReconnectAttempts;
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return {
    ...state,
    subscribe,
    send,
    subscribeToChannels,
    unsubscribeFromChannels,
    disconnect,
    reconnect: connect,
  };
}

export function useTradeUpdates(onTradeOpened?: (trade: Trade) => void, onTradeClosed?: (trade: Trade) => void) {
  const ws = useWebSocket({ channels: ["trades"] });

  useEffect(() => {
    const unsubOpen = onTradeOpened ? ws.subscribe("trade:opened", onTradeOpened) : undefined;
    const unsubClose = onTradeClosed ? ws.subscribe("trade:closed", onTradeClosed) : undefined;

    return () => {
      unsubOpen?.();
      unsubClose?.();
    };
  }, [ws, onTradeOpened, onTradeClosed]);

  return ws;
}

export function useEvolutionUpdates(onCycle?: (cycle: EvolutionCycle) => void) {
  const ws = useWebSocket({ channels: ["evolution"] });

  useEffect(() => {
    const unsub = onCycle ? ws.subscribe("evolution:cycle", onCycle) : undefined;
    return () => unsub?.();
  }, [ws, onCycle]);

  return ws;
}

export function usePositionUpdates(onUpdate?: (position: Position) => void) {
  const ws = useWebSocket({ channels: ["positions"] });

  useEffect(() => {
    const unsub = onUpdate ? ws.subscribe("position:updated", onUpdate) : undefined;
    return () => unsub?.();
  }, [ws, onUpdate]);

  return ws;
}

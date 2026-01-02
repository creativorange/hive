import type {
  StrategyGenome,
  PumpFunToken,
  Trade,
  Treasury,
} from "@meta/core";

export interface TradingConfig {
  slippage: number;
  maxPositionSize: number;
  minPositionSize: number; // Minimum SOL per trade
  maxConcurrentTrades: number;
  minLiquidity: number;
  paperTradingMode: boolean;
  monitoringIntervalMs: number;
  rpcEndpoint: string;
  privateKey?: string;
}

export interface Position {
  id: string;
  strategyId: string;
  token: PumpFunToken;
  trade: Trade;
  entryPrice: number;
  currentPrice: number;
  amountSol: number;
  tokenAmount: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  openedAt: number;
  lastUpdated: number;
}

export interface TradeSignal {
  action: "buy" | "sell" | "hold";
  strategyId: string;
  token: PumpFunToken;
  confidence: number;
  score: number;
  reasons: string[];
  timestamp: number;
}

export interface TradingStats {
  totalTrades: number;
  openPositions: number;
  closedPositions: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldTime: number;
  totalVolumeSol: number;
}

export interface TradeResult {
  success: boolean;
  trade?: Trade;
  error?: string;
  txSignature?: string;
}

export interface EvaluationResult {
  shouldTrade: boolean;
  score: number;
  matchedPatterns: string[];
  matchedKeywords: string[];
  socialScore: number;
  reasons: string[];
}

export interface SellEvaluationResult {
  shouldSell: boolean;
  urgency: "immediate" | "soon" | "consider" | "hold";
  score: number;
  matchedPatterns: string[];
  reasons: string[];
  suggestedExitPercent: number;  // 0-1, how much of position to exit
}

export interface TradingEngineEvents {
  "token:discovered": (token: PumpFunToken) => void;
  "signal:generated": (signal: TradeSignal) => void;
  "trade:opened": (trade: Trade) => void;
  "trade:closed": (trade: Trade) => void;
  "position:updated": (position: Position) => void;
  "engine:started": () => void;
  "engine:stopped": () => void;
  "error": (error: Error) => void;
}

export type { StrategyGenome, PumpFunToken, Trade, Treasury };

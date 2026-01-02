export interface SocialSignals {
  twitterFollowers: number;
  telegramMembers: number;
  holdersMin: number;
}

export interface StrategyGenes {
  entryMcapMin: number;
  entryMcapMax: number;
  entryVolumeMin: number;
  socialSignals: SocialSignals;
  buyPatterns: string[];
  whaleWallets: string[];
  tokenNameKeywords: string[];
  takeProfitMultiplier: number;
  stopLossMultiplier: number;
  timeBasedExit: number;
  volumeDropExit: number;
  investmentPercent: number;
  maxSimultaneousPositions: number;
  maxDrawdown: number;
  diversification: number;
}

export interface StrategyPerformance {
  tradesExecuted: number;
  winRate: number;
  totalPnL: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgHoldTime: number;
  fitnessScore: number;
}

export type StrategyStatus = "active" | "breeding" | "dead";

export type StrategyArchetype =
  | "aggressive"
  | "conservative"
  | "social"
  | "whale_follower"
  | "sniper"
  | "momentum";

export interface Strategy {
  id: string;
  generation: number;
  parentIds: string[];
  genes: StrategyGenes;
  performance: StrategyPerformance;
  status: StrategyStatus;
  birthTimestamp: string;
  deathTimestamp?: string;
  name?: string;
  archetype?: StrategyArchetype;
}

export interface Trade {
  id: string;
  strategyId: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  entryPrice: number;
  exitPrice?: number;
  amountSol: number;
  pnlSol?: number;
  pnlPercent?: number;
  entryTimestamp: string;
  exitTimestamp?: string;
  exitReason?: "take_profit" | "stop_loss" | "time_exit" | "volume_drop" | "manual";
  status: "open" | "closed";
  takeProfitPrice: number;
  stopLossPrice: number;
  timeExitTimestamp: string;
}

export interface Position {
  id: string;
  strategyId: string;
  token?: PumpFunToken;
  tokenSymbol?: string;
  tokenName?: string;
  tokenAddress?: string;
  trade?: Trade;
  entryPrice: number;
  currentPrice: number;
  amountSol: number;
  tokenAmount?: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  openedAt: number;
  lastUpdated?: number;
}

export interface PumpFunToken {
  address: string;
  name: string;
  symbol: string;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  createdAt: number;
  creator: string;
  socialLinks: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  priceUSD: number;
  priceChange24h: number;
}

export interface EvolutionCycle {
  id: string;
  generation: number;
  cycleTimestamp: string;
  survivors: string[];
  dead: string[];
  newlyBorn: string[];
  avgFitness: number;
  bestFitness: number;
  totalPnlSol: number;
  bestStrategyId: string;
}

export interface Treasury {
  id: string;
  totalSol: number;
  lockedInPositions: number;
  availableToTrade: number;
  totalPnl: number;
  reservePercent: number;
  maxAllocationPerStrategy: number;
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

export interface PopulationStats {
  generation: number;
  activeCount: number;
  avgFitness: number;
  bestFitness: number;
  strategies: Strategy[];
}

export interface EvolutionState {
  generation: number;
  activeStrategies: number;
  avgFitness: number;
  bestFitness: number;
  bestStrategy: Strategy | null;
  lastCycle: EvolutionCycle | null;
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

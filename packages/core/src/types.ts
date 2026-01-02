export interface SocialSignals {
  twitterFollowers: number;
  telegramMembers: number;
  holdersMin: number;
}

export interface SellSignals {
  momentumReversal: boolean;       // Sell when price momentum reverses
  volumeDry: boolean;              // Sell when volume drops significantly
  holdersDumping: boolean;         // Sell when holder count decreases
  mcapCeiling: number;             // Sell when mcap exceeds this (0 = disabled)
  profitSecuring: number;          // Take partial profits at this % gain (0 = disabled)
  trailingStop: number;            // Trailing stop % from peak (0 = disabled)
}

export interface StrategyGenes {
  // Entry criteria
  entryMcapMin: number;
  entryMcapMax: number;
  entryVolumeMin: number;
  socialSignals: SocialSignals;
  buyPatterns: string[];
  whaleWallets: string[];
  tokenNameKeywords: string[];
  
  // Exit criteria (mechanical)
  takeProfitMultiplier: number;
  stopLossMultiplier: number;
  timeBasedExit: number;
  volumeDropExit: number;
  
  // Exit criteria (strategic)
  sellSignals: SellSignals;
  sellPatterns: string[];          // Patterns that trigger sells (e.g., "momentum_death", "whale_dump")
  
  // Position sizing
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

export interface StrategyGenome {
  id: string;
  generation: number;
  parentIds: string[];
  genes: StrategyGenes;
  performance: StrategyPerformance;
  status: StrategyStatus;
  birthTimestamp: number;
  deathTimestamp?: number;
  name?: string;
  archetype?: StrategyArchetype;
}

export type StrategyArchetype = 
  | "aggressive" 
  | "conservative" 
  | "social" 
  | "whale_follower" 
  | "sniper" 
  | "momentum";

export interface SelectionResult {
  survivors: StrategyGenome[];
  mutators: StrategyGenome[];
  dead: StrategyGenome[];
}

export interface EvolutionCycle {
  id: string;
  generation: number;
  cycleTimestamp: number;
  survivors: string[];
  dead: string[];
  newlyBorn: string[];
  avgFitness: number;
  bestFitness: number;
  totalPnLSol: number;
  bestStrategyId: string;
}

export interface GeneticConfig {
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  survivorPercent: number;
  deadPercent: number;
  mutatorPercent: number;
  elitismCount: number;
}

export interface Population {
  generation: number;
  strategies: StrategyGenome[];
  bestFitness: number;
  avgFitness: number;
  totalTrades: number;
  totalPnL: number;
}

export const BUY_PATTERNS = [
  "cat_meme",
  "dog_meme",
  "ai_narrative",
  "agent_narrative",
  "whale_accumulation",
  "low_holder_gem",
  "trending_topic",
  "influencer_call",
  "new_narrative",
  "degen_play",
  "animal_meme",
  "food_meme",
  "tech_narrative",
  "gaming_narrative",
  "nft_revival",
] as const;

export const TOKEN_KEYWORDS = [
  "ai",
  "agent",
  "bot",
  "cat",
  "dog",
  "pepe",
  "doge",
  "shib",
  "moon",
  "inu",
  "elon",
  "trump",
  "based",
  "giga",
  "chad",
  "wojak",
  "frog",
  "ape",
  "punk",
  "meta",
  "sol",
  "bonk",
  "wif",
  "popcat",
  "mew",
] as const;

export const SELL_PATTERNS = [
  "momentum_death",       // Price momentum turned negative
  "volume_collapse",      // Volume dropped >50%
  "whale_dump",           // Large holders selling
  "holder_exodus",        // Holder count dropping
  "mcap_ceiling",         // Hit market cap ceiling
  "hype_fade",            // Social engagement dying
  "better_opportunity",   // Capital better deployed elsewhere
  "trailing_stop_hit",    // Price dropped from peak
  "time_decay",           // Held too long, momentum stale
  "liquidity_drain",      // Liquidity being pulled
] as const;

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
  entryTimestamp: number;
  exitTimestamp?: number;
  exitReason?: "take_profit" | "stop_loss" | "time_exit" | "volume_drop" | "manual";
  status: "open" | "closed";
  takeProfitPrice: number;
  stopLossPrice: number;
  timeExitTimestamp: number;
  isPaperTrade: boolean;
  txSignature?: string;
}

export interface Treasury {
  totalSol: number;
  allocatedPerStrategy: number;
  lockedInPositions: number;
  availableToTrade: number;
  totalPnL: number;
}

export interface EvolutionEvent {
  type: "strategy_born" | "strategy_died" | "trade_opened" | "trade_closed" | "cycle_complete" | "breeding";
  timestamp: number;
  data: Record<string, unknown>;
}

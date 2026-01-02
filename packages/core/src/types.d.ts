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
export type StrategyArchetype = "aggressive" | "conservative" | "social" | "whale_follower" | "sniper" | "momentum";
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
export declare const BUY_PATTERNS: readonly ["cat_meme", "dog_meme", "ai_narrative", "agent_narrative", "whale_accumulation", "low_holder_gem", "trending_topic", "influencer_call", "new_narrative", "degen_play", "animal_meme", "food_meme", "tech_narrative", "gaming_narrative", "nft_revival"];
export declare const TOKEN_KEYWORDS: readonly ["ai", "agent", "bot", "cat", "dog", "pepe", "doge", "shib", "moon", "inu", "elon", "trump", "based", "giga", "chad", "wojak", "frog", "ape", "punk", "meta", "sol", "bonk", "wif", "popcat", "mew"];
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
//# sourceMappingURL=types.d.ts.map
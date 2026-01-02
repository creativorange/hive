import type { StrategyGenome, Trade as CoreTrade, StrategyPerformance } from "@meta/core";
import { TradingEngine, type Position } from "@meta/trading";
import type { StrategiesRepository, TradesRepository, TreasuryRepository } from "@meta/database";
import type { WebSocketHandler } from "../websocket/handler.js";

interface SimulatorConfig {
  initialTreasurySol: number;
  maxAllocationPerStrategy: number;
  reservePercent: number;
  autoStart: boolean;
}

const DEFAULT_CONFIG: SimulatorConfig = {
  initialTreasurySol: 100,
  maxAllocationPerStrategy: 2,
  reservePercent: 0.1,
  autoStart: true,
};

export class TradingSimulator {
  private tradingEngine: TradingEngine;
  private strategiesRepo: StrategiesRepository;
  private tradesRepo: TradesRepository;
  private treasuryRepo: TreasuryRepository;
  private wsHandler: WebSocketHandler;
  private config: SimulatorConfig;
  private isInitialized = false;
  private strategyAllocations: Map<string, number> = new Map();

  constructor(
    tradingEngine: TradingEngine,
    strategiesRepo: StrategiesRepository,
    tradesRepo: TradesRepository,
    treasuryRepo: TreasuryRepository,
    wsHandler: WebSocketHandler,
    config: Partial<SimulatorConfig> = {}
  ) {
    this.tradingEngine = tradingEngine;
    this.strategiesRepo = strategiesRepo;
    this.tradesRepo = tradesRepo;
    this.treasuryRepo = treasuryRepo;
    this.wsHandler = wsHandler;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.tradingEngine.on("trade:opened", async (trade: CoreTrade) => {
      await this.persistTrade(trade);
      this.wsHandler.broadcast("trade:opened", {
        ...trade,
        allocation: this.strategyAllocations.get(trade.strategyId) ?? 0,
      });
    });

    this.tradingEngine.on("trade:closed", async (trade: CoreTrade) => {
      await this.updateTrade(trade);
      await this.updateStrategyPerformance(trade.strategyId);
      await this.updateTreasury();
      this.wsHandler.broadcast("trade:closed", trade);
    });

    this.tradingEngine.on("position:updated", (position: Position) => {
      this.wsHandler.broadcast("position:updated", {
        id: position.id,
        strategyId: position.strategyId,
        tokenAddress: position.token.address,
        tokenSymbol: position.token.symbol,
        tokenName: position.token.name,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        amountSol: position.amountSol,
        unrealizedPnL: position.unrealizedPnL,
        unrealizedPnLPercent: position.unrealizedPnLPercent,
        openedAt: position.openedAt,
      });
    });

    this.tradingEngine.on("token:discovered", (token) => {
      this.wsHandler.broadcast("token:discovered", {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        marketCap: token.marketCap,
        volume24h: token.volume24h,
        holders: token.holders,
        priceUSD: token.priceUSD,
      });
    });

    this.tradingEngine.on("signal:generated", (signal) => {
      this.wsHandler.broadcast("signal:generated", {
        action: signal.action,
        strategyId: signal.strategyId,
        tokenSymbol: signal.token.symbol,
        confidence: signal.confidence,
        score: signal.score,
        reasons: signal.reasons,
      });
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("[Simulator] Already initialized");
      return;
    }

    console.log("[Simulator] Initializing paper trading simulation...");

    await this.initializeTreasury();
    await this.loadStrategies();

    this.isInitialized = true;
    console.log("[Simulator] Initialization complete");

    if (this.config.autoStart) {
      await this.start();
    }
  }

  private async initializeTreasury(): Promise<void> {
    let treasury = await this.treasuryRepo.get();

    if (!treasury || treasury.totalSol === 0) {
      treasury = await this.treasuryRepo.initialize({
        totalSol: this.config.initialTreasurySol,
        availableToTrade: this.config.initialTreasurySol,
        lockedInPositions: 0,
        totalPnl: 0,
        reservePercent: this.config.reservePercent,
        maxAllocationPerStrategy: this.config.maxAllocationPerStrategy,
      });
      console.log(`[Simulator] Treasury initialized with ${this.config.initialTreasurySol} SOL`);
    } else {
      console.log(`[Simulator] Using existing treasury: ${treasury.totalSol} SOL`);
    }

    this.wsHandler.broadcast("treasury:updated", treasury);
  }

  private async loadStrategies(): Promise<void> {
    const strategies = await this.strategiesRepo.findActive();
    console.log(`[Simulator] Loading ${strategies.length} active strategies`);

    if (strategies.length === 0) {
      console.log("[Simulator] No active strategies found");
      return;
    }

    const treasury = await this.treasuryRepo.get();
    const availableSol = treasury?.totalSol ?? this.config.initialTreasurySol;
    const reserveAmount = availableSol * this.config.reservePercent;
    const tradableSol = availableSol - reserveAmount;
    const perStrategyAllocation = Math.min(
      tradableSol / strategies.length,
      this.config.maxAllocationPerStrategy
    );

    const genomes: StrategyGenome[] = strategies.map((s) => {
      this.strategyAllocations.set(s.id, perStrategyAllocation);

      return {
        id: s.id,
        generation: s.generation,
        parentIds: s.parentIds,
        genes: s.genes,
        performance: s.performance as StrategyPerformance,
        status: s.status as StrategyGenome["status"],
        birthTimestamp: s.birthTimestamp.getTime(),
        deathTimestamp: s.deathTimestamp?.getTime(),
        name: s.name ?? undefined,
        archetype: s.archetype ?? undefined,
      };
    });

    this.tradingEngine.loadStrategies(genomes);

    console.log(`[Simulator] Allocated ${perStrategyAllocation.toFixed(4)} SOL per strategy`);

    this.wsHandler.broadcast("strategies:loaded", {
      count: strategies.length,
      allocationPerStrategy: perStrategyAllocation,
      totalAllocated: perStrategyAllocation * strategies.length,
    });
  }

  async start(): Promise<void> {
    if (this.tradingEngine.isEngineRunning()) {
      console.log("[Simulator] Already running");
      return;
    }

    await this.tradingEngine.start();
    console.log("[Simulator] Paper trading started");

    this.wsHandler.broadcast("simulator:started", {
      timestamp: Date.now(),
      status: this.getStatus(),
    });
  }

  async stop(): Promise<void> {
    await this.tradingEngine.stop();
    console.log("[Simulator] Paper trading stopped");

    this.wsHandler.broadcast("simulator:stopped", {
      timestamp: Date.now(),
    });
  }

  private async persistTrade(trade: CoreTrade): Promise<void> {
    try {
      await this.tradesRepo.create({
        id: trade.id,
        strategyId: trade.strategyId,
        tokenAddress: trade.tokenAddress,
        tokenName: trade.tokenName,
        tokenSymbol: trade.tokenSymbol,
        entryPrice: trade.entryPrice,
        amountSol: trade.amountSol,
        status: trade.status,
        takeProfitPrice: trade.takeProfitPrice,
        stopLossPrice: trade.stopLossPrice,
        timeExitTimestamp: new Date(trade.timeExitTimestamp),
        isPaperTrade: trade.isPaperTrade,
        txSignature: trade.txSignature,
        entryTimestamp: new Date(trade.entryTimestamp),
      });
      console.log(`[Simulator] Trade persisted: ${trade.id}`);
    } catch (error) {
      console.error("[Simulator] Failed to persist trade:", error);
    }
  }

  private async updateTrade(trade: CoreTrade): Promise<void> {
    try {
      if (trade.status === "closed" && trade.exitPrice !== undefined) {
        await this.tradesRepo.close(trade.id, {
          exitPrice: trade.exitPrice,
          pnlSol: trade.pnlSol ?? 0,
          pnlPercent: trade.pnlPercent ?? 0,
          exitReason: trade.exitReason ?? "manual",
        });
        console.log(`[Simulator] Trade closed: ${trade.id} (PnL: ${trade.pnlSol?.toFixed(4)} SOL)`);
      }
    } catch (error) {
      console.error("[Simulator] Failed to update trade:", error);
    }
  }

  private async updateStrategyPerformance(strategyId: string): Promise<void> {
    try {
      const stats = await this.tradesRepo.getStatsByStrategy(strategyId);
      const strategy = await this.strategiesRepo.findById(strategyId);

      if (!strategy) return;

      const currentPerformance = strategy.performance as StrategyPerformance;

      const closedTrades = stats.closedTrades;
      const avgHoldTimeMs = closedTrades > 0 ? 
        (await this.calculateAvgHoldTime(strategyId)) : 
        currentPerformance.avgHoldTime;

      const perfForFitness: StrategyPerformance = {
        winRate: stats.winRate,
        totalPnL: stats.totalPnl,
        tradesExecuted: stats.totalTrades,
        sharpeRatio: this.calculateSharpeRatio(stats.totalPnl, stats.avgPnl, stats.closedTrades),
        maxDrawdown: Math.abs(stats.worstTrade),
        avgHoldTime: avgHoldTimeMs,
        fitnessScore: 0,
      };
      const fitnessScore = this.calculateFitness(perfForFitness);

      const newPerformance: StrategyPerformance = {
        tradesExecuted: stats.totalTrades,
        winRate: stats.winRate,
        totalPnL: stats.totalPnl,
        sharpeRatio: this.calculateSharpeRatio(stats.totalPnl, stats.avgPnl, stats.closedTrades),
        maxDrawdown: Math.max(currentPerformance.maxDrawdown, Math.abs(stats.worstTrade)),
        avgHoldTime: avgHoldTimeMs,
        fitnessScore,
      };

      await this.strategiesRepo.updatePerformance(strategyId, newPerformance);

      this.wsHandler.broadcast("strategy:performance_updated", {
        strategyId,
        performance: newPerformance,
      });
    } catch (error) {
      console.error("[Simulator] Failed to update strategy performance:", error);
    }
  }

  private async calculateAvgHoldTime(strategyId: string): Promise<number> {
    const trades = await this.tradesRepo.findByStrategy(strategyId);
    const closedTrades = trades.filter(t => t.status === "closed" && t.exitTimestamp);

    if (closedTrades.length === 0) return 0;

    const holdTimes = closedTrades.map(t => {
      const entry = t.entryTimestamp.getTime();
      const exit = t.exitTimestamp!.getTime();
      return exit - entry;
    });

    return holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length;
  }

  private calculateSharpeRatio(totalPnl: number, avgPnl: number, tradeCount: number): number {
    if (tradeCount < 2) return 0;
    const riskFreeRate = 0;
    const stdDev = Math.abs(avgPnl) * 0.5 + 0.01;
    return (avgPnl - riskFreeRate) / stdDev;
  }

  private calculateFitness(perf: StrategyPerformance): number {
    const pnlScore = Math.max(0, Math.min(40, (perf.totalPnL + 5) * 4));
    const winRateScore = perf.winRate * 30;
    const sharpeScore = Math.max(0, Math.min(20, (perf.sharpeRatio + 2) * 5));
    const drawdownPenalty = Math.min(10, perf.maxDrawdown * 10);
    const activityBonus = Math.min(10, perf.tradesExecuted * 0.5);

    return Math.max(0, pnlScore + winRateScore + sharpeScore - drawdownPenalty + activityBonus);
  }

  private async updateTreasury(): Promise<void> {
    try {
      const engineTreasury = this.tradingEngine.getTreasury();
      
      await this.treasuryRepo.update({
        totalSol: engineTreasury.totalSol,
        lockedInPositions: engineTreasury.lockedInPositions,
        availableToTrade: engineTreasury.availableToTrade,
        totalPnl: engineTreasury.totalPnL,
      });

      this.wsHandler.broadcast("treasury:updated", engineTreasury);
    } catch (error) {
      console.error("[Simulator] Failed to update treasury:", error);
    }
  }

  getStatus() {
    const engineStatus = this.tradingEngine.getTradingStatus();
    const stats = this.tradingEngine.getStats();

    return {
      isRunning: engineStatus.isRunning,
      isPaperTrading: engineStatus.isPaperTrading,
      openPositions: engineStatus.openPositions,
      activeStrategies: engineStatus.activeStrategies,
      stats: {
        totalTrades: stats.totalTrades,
        openPositions: stats.openPositions,
        closedPositions: stats.closedPositions,
        winRate: stats.winRate,
        totalPnL: stats.totalPnL,
        totalVolumeSol: stats.totalVolumeSol,
      },
    };
  }

  getPositions(): Position[] {
    return this.tradingEngine.getPositions();
  }

  async refreshStrategies(): Promise<void> {
    console.log("[Simulator] Refreshing strategies...");
    await this.loadStrategies();
  }

  isRunning(): boolean {
    return this.tradingEngine.isEngineRunning();
  }
}

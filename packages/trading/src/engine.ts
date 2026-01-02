import { EventEmitter } from "events";
import type { StrategyGenome, PumpFunToken, Trade, EvolutionEvent } from "@meta/core";
import { generateId, nowTimestamp } from "@meta/core";
import type {
  TradingConfig,
  Position,
  TradeSignal,
  TradingStats,
  TradingEngineEvents,
} from "./types.js";
import { PumpFunClient } from "./pumpfun.js";
import { TokenEvaluator } from "./evaluator.js";
import { TradeExecutor } from "./executor.js";
import { PositionMonitor } from "./monitor.js";
import { TreasuryManager, TreasuryConfig } from "./treasury.js";

const DEFAULT_TRADING_CONFIG: TradingConfig = {
  slippage: 0.02,
  maxPositionSize: 1, // Max 1 SOL per trade
  minPositionSize: 0.1, // Min 0.1 SOL per trade
  maxConcurrentTrades: 50,
  minLiquidity: 1000,
  paperTradingMode: true,
  monitoringIntervalMs: 15000, // Faster monitoring (15s instead of 30s)
  rpcEndpoint: "https://api.mainnet-beta.solana.com",
};

const DEFAULT_TREASURY_CONFIG: TreasuryConfig = {
  initialSol: 10,
  maxAllocationPerStrategy: 3, // Each agent gets max 3 SOL wallet
  reservePercent: 0.05, // Reduced reserve to put more capital to work
};

interface TypedEventEmitter {
  on<K extends keyof TradingEngineEvents>(
    event: K,
    listener: TradingEngineEvents[K]
  ): this;
  emit<K extends keyof TradingEngineEvents>(
    event: K,
    ...args: Parameters<TradingEngineEvents[K]>
  ): boolean;
  off<K extends keyof TradingEngineEvents>(
    event: K,
    listener: TradingEngineEvents[K]
  ): this;
}

export class TradingEngine extends (EventEmitter as new () => TypedEventEmitter) {
  private config: TradingConfig;
  private pumpFunClient: PumpFunClient;
  private evaluator: TokenEvaluator;
  private executor: TradeExecutor;
  private monitor: PositionMonitor;
  private treasury: TreasuryManager;
  
  private strategies: Map<string, StrategyGenome> = new Map();
  private isRunning: boolean = false;
  private tokenSubscriptionCleanup: (() => void) | null = null;
  private events: EvolutionEvent[] = [];
  private scanInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    tradingConfig: Partial<TradingConfig> = {},
    treasuryConfig: Partial<TreasuryConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_TRADING_CONFIG, ...tradingConfig };
    
    this.pumpFunClient = new PumpFunClient();
    this.evaluator = new TokenEvaluator();
    this.executor = new TradeExecutor(this.config);
    this.monitor = new PositionMonitor(this.pumpFunClient, this.config.monitoringIntervalMs);
    this.treasury = new TreasuryManager({ ...DEFAULT_TREASURY_CONFIG, ...treasuryConfig });

    this.setupMonitorCallbacks();
  }

  private setupMonitorCallbacks(): void {
    this.monitor.setExitCallback(async (position, reason) => {
      await this.closePosition(position, reason);
    });

    this.monitor.setUpdateCallback((position) => {
      this.emit("position:updated", position);
    });
  }

  loadStrategies(strategies: StrategyGenome[]): void {
    for (const strategy of strategies) {
      if (strategy.status === "active") {
        this.strategies.set(strategy.id, strategy);
      }
    }
    this.treasury.allocateToStrategies(Array.from(this.strategies.values()));
    this.monitor.updateStrategies(Array.from(this.strategies.values()));
    console.log(`[Engine] Loaded ${this.strategies.size} active strategies`);
  }

  updateStrategies(strategies: StrategyGenome[]): void {
    this.strategies.clear();
    this.loadStrategies(strategies);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[Engine] Already running");
      return;
    }

    this.isRunning = true;
    this.monitor.start();

    this.tokenSubscriptionCleanup = this.pumpFunClient.subscribeToNewTokens((token) => {
      this.emit("token:discovered", token);
      this.evaluateToken(token).catch(console.error);
    });

    this.scanInterval = setInterval(() => {
      this.scanForOpportunities().catch(console.error);
    }, 60000);

    this.emit("engine:started");
    console.log("[Engine] Started");

    await this.scanForOpportunities();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.monitor.stop();

    if (this.tokenSubscriptionCleanup) {
      this.tokenSubscriptionCleanup();
      this.tokenSubscriptionCleanup = null;
    }

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    this.pumpFunClient.disconnect();
    this.emit("engine:stopped");
    console.log("[Engine] Stopped");
  }

  private async scanForOpportunities(): Promise<void> {
    const tokens = await this.pumpFunClient.fetchNewTokens(50);
    
    for (const token of tokens) {
      await this.evaluateToken(token);
    }
  }

  private async evaluateToken(token: PumpFunToken): Promise<void> {
    if (this.monitor.getOpenPositionCount() >= this.config.maxConcurrentTrades) {
      return;
    }

    const signals: TradeSignal[] = [];

    for (const strategy of this.strategies.values()) {
      if (this.getStrategyOpenPositions(strategy.id).length >= strategy.genes.maxSimultaneousPositions) {
        continue;
      }

      const evaluation = this.evaluator.shouldBuy(strategy, token);

      if (evaluation.shouldTrade) {
        const signal: TradeSignal = {
          action: "buy",
          strategyId: strategy.id,
          token,
          confidence: evaluation.score / 100,
          score: evaluation.score,
          reasons: evaluation.reasons,
          timestamp: nowTimestamp(),
        };

        signals.push(signal);
        this.emit("signal:generated", signal);
      }
    }

    const bestSignal = signals.sort((a, b) => b.score - a.score)[0];
    if (bestSignal) {
      await this.executeSignal(bestSignal);
    }
  }

  private async executeSignal(signal: TradeSignal): Promise<void> {
    const strategy = this.strategies.get(signal.strategyId);
    if (!strategy) return;

    const allocation = this.treasury.getStrategyAllocation(strategy.id);
    if (!allocation) return;

    const amountSol = allocation.availableSol * strategy.genes.investmentPercent;
    
    if (!this.treasury.canTrade(strategy.id, amountSol)) {
      console.log(`[Engine] Insufficient funds for strategy ${strategy.id}`);
      return;
    }

    this.treasury.lockFunds(strategy.id, amountSol);

    const result = await this.executor.executeBuy(strategy, signal.token, amountSol);

    if (result.success && result.trade) {
      const position: Position = {
        id: generateId(),
        strategyId: strategy.id,
        token: signal.token,
        trade: result.trade,
        entryPrice: result.trade.entryPrice,
        currentPrice: signal.token.priceUSD,
        amountSol,
        tokenAmount: amountSol / signal.token.priceUSD,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        openedAt: nowTimestamp(),
        lastUpdated: nowTimestamp(),
      };

      this.monitor.addPosition(position);
      this.emit("trade:opened", result.trade);
      this.recordEvent("trade_opened", { trade: result.trade, position });

      console.log(
        `[Engine] Opened position: ${signal.token.symbol} for strategy ${strategy.name}`
      );
    } else {
      this.treasury.unlockFunds(strategy.id, amountSol);
      console.error(`[Engine] Failed to execute buy: ${result.error}`);
    }
  }

  private async closePosition(
    position: Position,
    reason: Trade["exitReason"]
  ): Promise<void> {
    const result = await this.executor.executeSell(position, reason);

    if (result.success && result.trade) {
      this.monitor.removePosition(position.id);
      this.treasury.recordTradeClose(result.trade);
      this.emit("trade:closed", result.trade);
      this.recordEvent("trade_closed", { trade: result.trade });

      const strategy = this.strategies.get(position.strategyId);
      console.log(
        `[Engine] Closed position: ${position.token.symbol} (${reason}) PnL: ${result.trade.pnlSol?.toFixed(4)} SOL - Strategy: ${strategy?.name}`
      );
    } else {
      this.emit("error", new Error(`Failed to close position: ${result.error}`));
    }
  }

  private getStrategyOpenPositions(strategyId: string): Position[] {
    return this.monitor.getAllPositions().filter(
      (p) => p.strategyId === strategyId && p.trade.status === "open"
    );
  }

  private recordEvent(type: EvolutionEvent["type"], data: Record<string, unknown>): void {
    this.events.push({
      type,
      timestamp: nowTimestamp(),
      data,
    });
  }

  getStats(): TradingStats {
    const trades = this.treasury.getTradeHistory();
    const closedTrades = trades.filter((t) => t.status === "closed");
    const winningTrades = closedTrades.filter((t) => (t.pnlSol ?? 0) > 0);
    
    const pnls = closedTrades.map((t) => t.pnlSol ?? 0);
    const holdTimes = closedTrades.map((t) => 
      (t.exitTimestamp ?? t.entryTimestamp) - t.entryTimestamp
    );

    return {
      totalTrades: trades.length,
      openPositions: this.monitor.getOpenPositionCount(),
      closedPositions: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: closedTrades.length - winningTrades.length,
      winRate: closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0,
      totalPnL: this.treasury.getTotalPnL(),
      avgPnL: pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0,
      bestTrade: pnls.length > 0 ? Math.max(...pnls) : 0,
      worstTrade: pnls.length > 0 ? Math.min(...pnls) : 0,
      avgHoldTime: holdTimes.length > 0 ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length : 0,
      totalVolumeSol: trades.reduce((sum, t) => sum + t.amountSol, 0),
    };
  }

  getTreasury() {
    return this.treasury.getTreasury();
  }

  getPositions(): Position[] {
    return this.monitor.getAllPositions();
  }

  getEvents(): EvolutionEvent[] {
    return [...this.events];
  }

  isEngineRunning(): boolean {
    return this.isRunning;
  }

  getConfig(): TradingConfig {
    return { ...this.config };
  }

  isPaperTrading(): boolean {
    return this.config.paperTradingMode;
  }

  setTradingMode(paperMode: boolean): { success: boolean; message: string } {
    const openPositions = this.monitor.getOpenPositionCount();
    
    if (openPositions > 0 && this.config.paperTradingMode !== paperMode) {
      return {
        success: false,
        message: `Cannot switch trading mode with ${openPositions} open positions. Close all positions first.`,
      };
    }

    const previousMode = this.config.paperTradingMode;
    this.config.paperTradingMode = paperMode;
    this.executor.updateConfig({ paperTradingMode: paperMode });

    const modeLabel = paperMode ? "PAPER" : "REAL";
    console.log(`[Engine] Trading mode switched: ${previousMode ? "PAPER" : "REAL"} -> ${modeLabel}`);

    return {
      success: true,
      message: `Trading mode set to ${modeLabel}`,
    };
  }

  getTradingStatus() {
    return {
      isRunning: this.isRunning,
      isPaperTrading: this.config.paperTradingMode,
      openPositions: this.monitor.getOpenPositionCount(),
      activeStrategies: this.strategies.size,
      config: {
        maxConcurrentTrades: this.config.maxConcurrentTrades,
        maxPositionSize: this.config.maxPositionSize,
        slippage: this.config.slippage,
        minLiquidity: this.config.minLiquidity,
      },
    };
  }
}

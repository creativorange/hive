import type { Trade, StrategyGenome } from "@meta/core";
import { nowTimestamp } from "@meta/core";
import type { Position, SellEvaluationResult } from "./types.js";
import { PumpFunClient } from "./pumpfun.js";
import { TokenEvaluator } from "./evaluator.js";

export type ExitCondition = {
  shouldExit: boolean;
  reason: Trade["exitReason"];
};

export class PositionMonitor {
  private positions: Map<string, Position> = new Map();
  private strategies: Map<string, StrategyGenome> = new Map();
  private pumpFunClient: PumpFunClient;
  private evaluator: TokenEvaluator;
  private monitoringIntervalMs: number;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private onExitCondition: ((position: Position, reason: Trade["exitReason"], sellEval?: SellEvaluationResult) => void) | null = null;
  private onPositionUpdate: ((position: Position) => void) | null = null;
  private previousTokenCache: Map<string, Position["token"]> = new Map();

  constructor(pumpFunClient: PumpFunClient, monitoringIntervalMs = 30000) {
    this.pumpFunClient = pumpFunClient;
    this.evaluator = new TokenEvaluator();
    this.monitoringIntervalMs = monitoringIntervalMs;
  }

  addPosition(position: Position): void {
    this.positions.set(position.id, position);
    this.previousTokenCache.set(position.token.address, position.token);
  }

  removePosition(positionId: string): void {
    const position = this.positions.get(positionId);
    if (position) {
      this.previousTokenCache.delete(position.token.address);
    }
    this.positions.delete(positionId);
  }

  updateStrategies(strategies: StrategyGenome[]): void {
    this.strategies.clear();
    for (const strategy of strategies) {
      this.strategies.set(strategy.id, strategy);
    }
  }

  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getOpenPositions(): Position[] {
    return this.getAllPositions().filter((p) => p.trade.status === "open");
  }

  setExitCallback(callback: (position: Position, reason: Trade["exitReason"], sellEval?: SellEvaluationResult) => void): void {
    this.onExitCondition = callback;
  }

  setUpdateCallback(callback: (position: Position) => void): void {
    this.onPositionUpdate = callback;
  }

  start(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(() => {
      this.checkAllPositions().catch(console.error);
    }, this.monitoringIntervalMs);

    console.log(`[Monitor] Started with ${this.monitoringIntervalMs}ms interval`);
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log("[Monitor] Stopped");
  }

  async checkAllPositions(): Promise<void> {
    const openPositions = this.getOpenPositions();

    for (const position of openPositions) {
      await this.checkPosition(position);
    }
  }

  async checkPosition(position: Position): Promise<ExitCondition> {
    const updatedToken = await this.pumpFunClient.getTokenMetrics(position.token.address);

    if (!updatedToken) {
      return { shouldExit: false, reason: undefined };
    }

    const previousToken = this.previousTokenCache.get(position.token.address);
    const currentPrice = updatedToken.priceUSD;
    const unrealizedPnL = (currentPrice - position.entryPrice) / position.entryPrice * position.amountSol;
    const unrealizedPnLPercent = (currentPrice - position.entryPrice) / position.entryPrice;

    const updatedPosition: Position = {
      ...position,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPercent,
      token: updatedToken,
      lastUpdated: nowTimestamp(),
    };

    this.positions.set(position.id, updatedPosition);
    this.previousTokenCache.set(position.token.address, updatedToken);
    this.onPositionUpdate?.(updatedPosition);

    // First check mechanical exits (take profit, stop loss, time)
    const mechanicalExit = this.evaluateMechanicalExits(updatedPosition);
    if (mechanicalExit.shouldExit) {
      this.onExitCondition?.(updatedPosition, mechanicalExit.reason);
      return mechanicalExit;
    }

    // Then check strategic sells based on strategy's sell signals
    const strategy = this.strategies.get(position.strategyId);
    if (strategy) {
      const sellEval = this.evaluator.shouldSell(strategy, updatedPosition, updatedToken, previousToken);
      if (sellEval.shouldSell) {
        const reason = this.mapSellPatternToReason(sellEval.matchedPatterns);
        console.log(`[Monitor] Strategic sell for ${position.token.symbol}: ${sellEval.reasons.join(", ")}`);
        this.onExitCondition?.(updatedPosition, reason, sellEval);
        return { shouldExit: true, reason };
      }
    }

    return { shouldExit: false, reason: undefined };
  }

  private mapSellPatternToReason(patterns: string[]): Trade["exitReason"] {
    if (patterns.includes("trailing_stop_hit")) return "stop_loss";
    if (patterns.includes("profit_secure") || patterns.includes("mcap_ceiling")) return "take_profit";
    if (patterns.includes("volume_collapse") || patterns.includes("liquidity_drain")) return "volume_drop";
    if (patterns.includes("time_decay")) return "time_exit";
    return "manual";
  }

  private evaluateMechanicalExits(position: Position): ExitCondition {
    const { trade } = position;
    const now = nowTimestamp();

    if (position.currentPrice >= trade.takeProfitPrice) {
      return { shouldExit: true, reason: "take_profit" };
    }

    if (position.currentPrice <= trade.stopLossPrice) {
      return { shouldExit: true, reason: "stop_loss" };
    }

    if (now >= trade.timeExitTimestamp) {
      return { shouldExit: true, reason: "time_exit" };
    }

    return { shouldExit: false, reason: undefined };
  }

  getPositionCount(): number {
    return this.positions.size;
  }

  getOpenPositionCount(): number {
    return this.getOpenPositions().length;
  }

  clear(): void {
    this.positions.clear();
    this.previousTokenCache.clear();
    this.strategies.clear();
  }
}

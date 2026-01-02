import type { Treasury, StrategyGenome, Trade } from "@meta/core";

export interface TreasuryConfig {
  initialSol: number;
  maxAllocationPerStrategy: number;
  reservePercent: number;
}

export interface StrategyAllocation {
  strategyId: string;
  allocatedSol: number;
  lockedSol: number;
  availableSol: number;
  realizedPnL: number;
}

export class TreasuryManager {
  private totalSol: number;
  private allocations: Map<string, StrategyAllocation> = new Map();
  private tradeHistory: Trade[] = [];
  private config: TreasuryConfig;
  private totalRealizedPnL: number = 0;

  constructor(config: TreasuryConfig) {
    this.config = config;
    this.totalSol = config.initialSol;
  }

  allocateToStrategies(strategies: StrategyGenome[]): void {
    const activeStrategies = strategies.filter((s) => s.status === "active");
    if (activeStrategies.length === 0) return;

    const reserveAmount = this.totalSol * this.config.reservePercent;
    const availableForAllocation = this.totalSol - reserveAmount;

    const perStrategyAllocation = Math.min(
      availableForAllocation / activeStrategies.length,
      this.config.maxAllocationPerStrategy
    );

    for (const strategy of activeStrategies) {
      const existing = this.allocations.get(strategy.id);
      
      this.allocations.set(strategy.id, {
        strategyId: strategy.id,
        allocatedSol: perStrategyAllocation,
        lockedSol: existing?.lockedSol ?? 0,
        availableSol: perStrategyAllocation - (existing?.lockedSol ?? 0),
        realizedPnL: existing?.realizedPnL ?? 0,
      });
    }
  }

  getStrategyAllocation(strategyId: string): StrategyAllocation | undefined {
    return this.allocations.get(strategyId);
  }

  canTrade(strategyId: string, amountSol: number): boolean {
    const allocation = this.allocations.get(strategyId);
    if (!allocation) return false;
    return allocation.availableSol >= amountSol;
  }

  lockFunds(strategyId: string, amountSol: number): boolean {
    const allocation = this.allocations.get(strategyId);
    if (!allocation || allocation.availableSol < amountSol) {
      return false;
    }

    allocation.lockedSol += amountSol;
    allocation.availableSol -= amountSol;
    return true;
  }

  unlockFunds(strategyId: string, amountSol: number): void {
    const allocation = this.allocations.get(strategyId);
    if (!allocation) return;

    allocation.lockedSol = Math.max(0, allocation.lockedSol - amountSol);
    allocation.availableSol = allocation.allocatedSol - allocation.lockedSol;
  }

  recordTradeClose(trade: Trade): void {
    if (trade.status !== "closed" || trade.pnlSol === undefined) return;

    this.tradeHistory.push(trade);
    
    const allocation = this.allocations.get(trade.strategyId);
    if (allocation) {
      allocation.realizedPnL += trade.pnlSol;
      this.unlockFunds(trade.strategyId, trade.amountSol);
      allocation.allocatedSol += trade.pnlSol;
      allocation.availableSol += trade.pnlSol;
    }

    this.totalRealizedPnL += trade.pnlSol;
    this.totalSol += trade.pnlSol;
  }

  getTreasury(): Treasury {
    let lockedInPositions = 0;
    let allocatedPerStrategy = 0;

    for (const allocation of this.allocations.values()) {
      lockedInPositions += allocation.lockedSol;
      allocatedPerStrategy += allocation.allocatedSol;
    }

    return {
      totalSol: this.totalSol,
      allocatedPerStrategy: this.allocations.size > 0
        ? allocatedPerStrategy / this.allocations.size
        : 0,
      lockedInPositions,
      availableToTrade: this.totalSol - lockedInPositions,
      totalPnL: this.totalRealizedPnL,
    };
  }

  getStrategyPnL(strategyId: string): number {
    return this.tradeHistory
      .filter((t) => t.strategyId === strategyId && t.pnlSol !== undefined)
      .reduce((sum, t) => sum + (t.pnlSol ?? 0), 0);
  }

  getTotalPnL(): number {
    return this.totalRealizedPnL;
  }

  getTradeHistory(): Trade[] {
    return [...this.tradeHistory];
  }

  getWinRate(): number {
    const closedTrades = this.tradeHistory.filter((t) => t.status === "closed");
    if (closedTrades.length === 0) return 0;
    
    const winningTrades = closedTrades.filter((t) => (t.pnlSol ?? 0) > 0);
    return winningTrades.length / closedTrades.length;
  }

  removeStrategy(strategyId: string): void {
    const allocation = this.allocations.get(strategyId);
    if (allocation && allocation.lockedSol === 0) {
      this.allocations.delete(strategyId);
    }
  }

  getConfig(): TreasuryConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<TreasuryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  addFunds(amount: number): void {
    this.totalSol += amount;
  }

  withdrawFunds(amount: number): boolean {
    const treasury = this.getTreasury();
    if (amount > treasury.availableToTrade) {
      return false;
    }
    this.totalSol -= amount;
    return true;
  }
}

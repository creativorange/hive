import { describe, it, expect, beforeEach } from "vitest";
import { TreasuryManager } from "../treasury.js";
import type { StrategyGenome, Trade } from "@meta/core";

describe("TreasuryManager", () => {
  let treasury: TreasuryManager;

  beforeEach(() => {
    treasury = new TreasuryManager({
      initialSol: 10,
      maxAllocationPerStrategy: 0.5,
      reservePercent: 0.1,
    });
  });

  const createMockStrategy = (id: string): StrategyGenome => ({
    id,
    generation: 1,
    parentIds: [],
    genes: {
      entryMcapMin: 10000,
      entryMcapMax: 500000,
      entryVolumeMin: 1000,
      socialSignals: { twitterFollowers: 100, telegramMembers: 50, holdersMin: 20 },
      buyPatterns: ["cat_meme"],
      whaleWallets: [],
      tokenNameKeywords: ["cat"],
      takeProfitMultiplier: 3,
      stopLossMultiplier: 0.5,
      timeBasedExit: 60,
      volumeDropExit: 0.5,
      investmentPercent: 0.05,
      maxSimultaneousPositions: 5,
      maxDrawdown: 0.3,
      diversification: 0.5,
    },
    performance: {
      tradesExecuted: 0,
      winRate: 0,
      totalPnL: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      avgHoldTime: 0,
      fitnessScore: 50,
    },
    status: "active",
    birthTimestamp: Date.now(),
  });

  describe("initialization", () => {
    it("initializes with correct values", () => {
      const state = treasury.getTreasury();
      expect(state.totalSol).toBe(10);
      expect(state.availableToTrade).toBeLessThanOrEqual(10);
      expect(state.lockedInPositions).toBe(0);
    });
  });

  describe("allocateToStrategies", () => {
    it("allocates funds across strategies", () => {
      const strategies = [
        createMockStrategy("s1"),
        createMockStrategy("s2"),
        createMockStrategy("s3"),
      ];

      treasury.allocateToStrategies(strategies);

      const alloc1 = treasury.getStrategyAllocation("s1");
      const alloc2 = treasury.getStrategyAllocation("s2");
      const alloc3 = treasury.getStrategyAllocation("s3");

      expect(alloc1).toBeDefined();
      expect(alloc2).toBeDefined();
      expect(alloc3).toBeDefined();
      expect(alloc1!.allocatedSol).toBeGreaterThan(0);
    });

    it("respects max allocation per strategy", () => {
      const strategies = [createMockStrategy("s1")];

      treasury.allocateToStrategies(strategies);

      const allocation = treasury.getStrategyAllocation("s1");
      const maxAllocation = 10 * 0.5; // 50% max
      expect(allocation!.allocatedSol).toBeLessThanOrEqual(maxAllocation);
    });
  });

  describe("lockFunds and unlockFunds", () => {
    it("locks funds for a strategy", () => {
      const strategies = [createMockStrategy("s1")];
      treasury.allocateToStrategies(strategies);

      const allocation = treasury.getStrategyAllocation("s1")!;
      // Verify allocation has funds
      expect(allocation.availableSol).toBeGreaterThan(0);
      
      const lockAmount = Math.min(0.5, allocation.availableSol);
      const availableBefore = allocation.availableSol;
      const lockedBefore = allocation.lockedSol;
      
      treasury.lockFunds("s1", lockAmount);
      const afterLock = treasury.getStrategyAllocation("s1")!;

      expect(afterLock.availableSol).toBe(availableBefore - lockAmount);
      expect(afterLock.lockedSol).toBe(lockedBefore + lockAmount);
    });

    it("unlocks funds for a strategy", () => {
      const strategies = [createMockStrategy("s1")];
      treasury.allocateToStrategies(strategies);

      const allocation = treasury.getStrategyAllocation("s1")!;
      const lockAmount = Math.min(0.5, allocation.availableSol);
      const unlockAmount = lockAmount * 0.6; // Unlock 60% of locked
      
      treasury.lockFunds("s1", lockAmount);
      const lockedAfterLock = treasury.getStrategyAllocation("s1")!.lockedSol;
      
      treasury.unlockFunds("s1", unlockAmount);
      const afterUnlock = treasury.getStrategyAllocation("s1")!;

      expect(afterUnlock.lockedSol).toBeCloseTo(lockedAfterLock - unlockAmount, 5);
      // availableSol = allocatedSol - lockedSol
      expect(afterUnlock.availableSol).toBeCloseTo(afterUnlock.allocatedSol - afterUnlock.lockedSol, 5);
    });
  });

  describe("canTrade", () => {
    it("returns true when strategy has sufficient funds", () => {
      const strategies = [createMockStrategy("s1")];
      treasury.allocateToStrategies(strategies);

      const canTrade = treasury.canTrade("s1", 0.1);
      expect(canTrade).toBe(true);
    });

    it("returns false when strategy has insufficient funds", () => {
      const strategies = [createMockStrategy("s1")];
      treasury.allocateToStrategies(strategies);

      const canTrade = treasury.canTrade("s1", 100);
      expect(canTrade).toBe(false);
    });

    it("returns false for unknown strategy", () => {
      const canTrade = treasury.canTrade("unknown", 0.1);
      expect(canTrade).toBe(false);
    });
  });

  describe("recordTradeClose", () => {
    it("records profitable trade and updates PnL", () => {
      const strategies = [createMockStrategy("s1")];
      treasury.allocateToStrategies(strategies);
      treasury.lockFunds("s1", 1);

      const trade: Trade = {
        id: "trade1",
        strategyId: "s1",
        tokenAddress: "token123",
        tokenName: "Test",
        tokenSymbol: "TST",
        entryPrice: 0.001,
        exitPrice: 0.002,
        amountSol: 1,
        pnlSol: 0.5,
        pnlPercent: 50,
        entryTimestamp: Date.now() - 60000,
        exitTimestamp: Date.now(),
        exitReason: "take_profit",
        status: "closed",
        takeProfitPrice: 0.003,
        stopLossPrice: 0.0005,
        timeExitTimestamp: Date.now() + 3600000,
      };

      treasury.recordTradeClose(trade);

      const state = treasury.getTreasury();
      expect(state.totalPnL).toBe(0.5);
    });

    it("records losing trade and updates PnL", () => {
      const strategies = [createMockStrategy("s1")];
      treasury.allocateToStrategies(strategies);
      treasury.lockFunds("s1", 1);

      const trade: Trade = {
        id: "trade1",
        strategyId: "s1",
        tokenAddress: "token123",
        tokenName: "Test",
        tokenSymbol: "TST",
        entryPrice: 0.001,
        exitPrice: 0.0005,
        amountSol: 1,
        pnlSol: -0.5,
        pnlPercent: -50,
        entryTimestamp: Date.now() - 60000,
        exitTimestamp: Date.now(),
        exitReason: "stop_loss",
        status: "closed",
        takeProfitPrice: 0.003,
        stopLossPrice: 0.0005,
        timeExitTimestamp: Date.now() + 3600000,
      };

      treasury.recordTradeClose(trade);

      const state = treasury.getTreasury();
      expect(state.totalPnL).toBe(-0.5);
    });
  });

  describe("getTotalPnL", () => {
    it("returns cumulative PnL", () => {
      const strategies = [createMockStrategy("s1")];
      treasury.allocateToStrategies(strategies);

      expect(treasury.getTotalPnL()).toBe(0);
    });
  });

  describe("getTradeHistory", () => {
    it("returns empty array initially", () => {
      expect(treasury.getTradeHistory()).toEqual([]);
    });

    it("returns recorded trades", () => {
      const strategies = [createMockStrategy("s1")];
      treasury.allocateToStrategies(strategies);
      treasury.lockFunds("s1", 1);

      const trade: Trade = {
        id: "trade1",
        strategyId: "s1",
        tokenAddress: "token123",
        tokenName: "Test",
        tokenSymbol: "TST",
        entryPrice: 0.001,
        exitPrice: 0.002,
        amountSol: 1,
        pnlSol: 0.5,
        pnlPercent: 50,
        entryTimestamp: Date.now() - 60000,
        exitTimestamp: Date.now(),
        exitReason: "take_profit",
        status: "closed",
        takeProfitPrice: 0.003,
        stopLossPrice: 0.0005,
        timeExitTimestamp: Date.now() + 3600000,
      };

      treasury.recordTradeClose(trade);

      const history = treasury.getTradeHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe("trade1");
    });
  });
});

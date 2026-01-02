import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { StrategiesRepository } from "../repositories/strategies.js";
import { TradesRepository } from "../repositories/trades.js";
import { EvolutionRepository } from "../repositories/evolution.js";
import { TreasuryRepository } from "../repositories/treasury.js";
import { createDbClient, type Database } from "../client.js";
import type { StrategyGenes, StrategyPerformance } from "@meta/core";

const TEST_CONNECTION_STRING = process.env.DATABASE_URL || "postgres://localhost:5432/meta_test";

describe("Repositories", () => {
  let db: Database;
  let strategiesRepo: StrategiesRepository;
  let tradesRepo: TradesRepository;
  let evolutionRepo: EvolutionRepository;
  let treasuryRepo: TreasuryRepository;

  const mockGenes: StrategyGenes = {
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
  };

  const mockPerformance: StrategyPerformance = {
    tradesExecuted: 10,
    winRate: 0.6,
    totalPnL: 1.5,
    sharpeRatio: 1.2,
    maxDrawdown: 0.15,
    avgHoldTime: 120,
    fitnessScore: 75,
  };

  beforeAll(async () => {
    try {
      db = createDbClient(TEST_CONNECTION_STRING);
      strategiesRepo = new StrategiesRepository(db);
      tradesRepo = new TradesRepository(db);
      evolutionRepo = new EvolutionRepository(db);
      treasuryRepo = new TreasuryRepository(db);
    } catch (error) {
      console.warn("Database connection failed, skipping repository tests");
    }
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  describe("StrategiesRepository", () => {
    it.skipIf(!db)("creates a strategy", async () => {
      const strategy = await strategiesRepo.create({
        generation: 1,
        parentIds: [],
        genes: mockGenes,
        performance: mockPerformance,
        status: "active",
        name: "Test Strategy",
        archetype: "aggressive",
      });

      expect(strategy.id).toBeDefined();
      expect(strategy.name).toBe("Test Strategy");
      expect(strategy.status).toBe("active");
      expect(strategy.generation).toBe(1);
    });

    it.skipIf(!db)("finds strategy by id", async () => {
      const created = await strategiesRepo.create({
        generation: 1,
        parentIds: [],
        genes: mockGenes,
        performance: mockPerformance,
        status: "active",
        name: "Find Me",
      });

      const found = await strategiesRepo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe("Find Me");
    });

    it.skipIf(!db)("finds active strategies", async () => {
      const active = await strategiesRepo.findActive();
      expect(Array.isArray(active)).toBe(true);
      active.forEach((s) => expect(s.status).toBe("active"));
    });

    it.skipIf(!db)("marks strategy as dead", async () => {
      const strategy = await strategiesRepo.create({
        generation: 1,
        parentIds: [],
        genes: mockGenes,
        performance: mockPerformance,
        status: "active",
        name: "Soon Dead",
      });

      await strategiesRepo.markDead(strategy.id);
      const updated = await strategiesRepo.findById(strategy.id);

      expect(updated?.status).toBe("dead");
      expect(updated?.deathTimestamp).toBeDefined();
    });

    it.skipIf(!db)("gets top performers", async () => {
      const top = await strategiesRepo.getTopPerformers(5);
      expect(Array.isArray(top)).toBe(true);
      expect(top.length).toBeLessThanOrEqual(5);
    });

    it.skipIf(!db)("gets graveyard (dead strategies)", async () => {
      const graveyard = await strategiesRepo.getGraveyard(10);
      expect(Array.isArray(graveyard)).toBe(true);
      graveyard.forEach((s) => expect(s.status).toBe("dead"));
    });
  });

  describe("TradesRepository", () => {
    let strategyId: string;

    beforeEach(async () => {
      if (db) {
        const strategy = await strategiesRepo.create({
          generation: 1,
          parentIds: [],
          genes: mockGenes,
          performance: mockPerformance,
          status: "active",
          name: "Trade Test Strategy",
        });
        strategyId = strategy.id;
      }
    });

    it.skipIf(!db)("creates a trade", async () => {
      const trade = await tradesRepo.create({
        strategyId,
        tokenAddress: "token123",
        tokenName: "Test Token",
        tokenSymbol: "TST",
        entryPrice: 0.001,
        amountSol: 1.0,
        status: "open",
        takeProfitPrice: 0.003,
        stopLossPrice: 0.0005,
        timeExitTimestamp: new Date(Date.now() + 3600000),
      });

      expect(trade.id).toBeDefined();
      expect(trade.strategyId).toBe(strategyId);
      expect(trade.status).toBe("open");
    });

    it.skipIf(!db)("finds open trades", async () => {
      await tradesRepo.create({
        strategyId,
        tokenAddress: "token456",
        tokenName: "Open Trade Token",
        tokenSymbol: "OPN",
        entryPrice: 0.002,
        amountSol: 0.5,
        status: "open",
        takeProfitPrice: 0.006,
        stopLossPrice: 0.001,
        timeExitTimestamp: new Date(Date.now() + 3600000),
      });

      const openTrades = await tradesRepo.findOpen();
      expect(Array.isArray(openTrades)).toBe(true);
      openTrades.forEach((t) => expect(t.status).toBe("open"));
    });

    it.skipIf(!db)("closes a trade", async () => {
      const trade = await tradesRepo.create({
        strategyId,
        tokenAddress: "token789",
        tokenName: "Close Me",
        tokenSymbol: "CLS",
        entryPrice: 0.001,
        amountSol: 1.0,
        status: "open",
        takeProfitPrice: 0.003,
        stopLossPrice: 0.0005,
        timeExitTimestamp: new Date(Date.now() + 3600000),
      });

      const closed = await tradesRepo.close(trade.id, {
        exitPrice: 0.002,
        pnlSol: 0.5,
        pnlPercent: 50,
        exitReason: "take_profit",
      });

      expect(closed.status).toBe("closed");
      expect(closed.exitPrice).toBe(0.002);
      expect(closed.pnlSol).toBe(0.5);
      expect(closed.exitReason).toBe("take_profit");
    });

    it.skipIf(!db)("gets trades by strategy", async () => {
      await tradesRepo.create({
        strategyId,
        tokenAddress: "tokenXYZ",
        tokenName: "Strategy Trade",
        tokenSymbol: "STR",
        entryPrice: 0.001,
        amountSol: 0.5,
        status: "open",
        takeProfitPrice: 0.003,
        stopLossPrice: 0.0005,
        timeExitTimestamp: new Date(Date.now() + 3600000),
      });

      const trades = await tradesRepo.findByStrategy(strategyId);
      expect(Array.isArray(trades)).toBe(true);
      trades.forEach((t) => expect(t.strategyId).toBe(strategyId));
    });

    it.skipIf(!db)("gets trade stats", async () => {
      const stats = await tradesRepo.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalTrades).toBe("number");
      expect(typeof stats.winRate).toBe("number");
    });
  });

  describe("EvolutionRepository", () => {
    it.skipIf(!db)("creates an evolution cycle", async () => {
      const cycle = await evolutionRepo.createCycle({
        generation: 1,
        survivors: ["s1", "s2"],
        dead: ["s3"],
        newlyBorn: ["s4"],
        avgFitness: 65.5,
        bestFitness: 85.0,
        totalPnlSol: 5.5,
      });

      expect(cycle.id).toBeDefined();
      expect(cycle.generation).toBe(1);
      expect(cycle.avgFitness).toBe(65.5);
    });

    it.skipIf(!db)("gets latest cycle", async () => {
      const latest = await evolutionRepo.getLatest();
      // May be null if no cycles exist yet
      if (latest) {
        expect(latest.id).toBeDefined();
        expect(latest.generation).toBeDefined();
      }
    });

    it.skipIf(!db)("gets evolution history", async () => {
      const history = await evolutionRepo.getHistory(10);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe("TreasuryRepository", () => {
    it.skipIf(!db)("initializes treasury", async () => {
      const treasury = await treasuryRepo.initialize({
        totalSol: 10,
        availableToTrade: 9,
        lockedInPositions: 0,
        totalPnl: 0,
        reservePercent: 0.1,
        maxAllocationPerStrategy: 0.5,
      });

      expect(treasury.id).toBeDefined();
      expect(treasury.totalSol).toBe(10);
    });

    it.skipIf(!db)("gets current treasury state", async () => {
      const treasury = await treasuryRepo.getCurrent();
      // May be null if not initialized
      if (treasury) {
        expect(treasury.totalSol).toBeDefined();
      }
    });

    it.skipIf(!db)("updates treasury", async () => {
      const current = await treasuryRepo.getCurrent();
      if (current) {
        const updated = await treasuryRepo.update({
          totalPnl: 1.5,
        });
        expect(updated.totalPnl).toBe(1.5);
      }
    });
  });
});

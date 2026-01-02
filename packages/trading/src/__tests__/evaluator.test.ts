import { describe, it, expect, beforeEach } from "vitest";
import { TokenEvaluator } from "../evaluator.js";
import type { StrategyGenome, PumpFunToken } from "@meta/core";

describe("TokenEvaluator", () => {
  let evaluator: TokenEvaluator;

  beforeEach(() => {
    evaluator = new TokenEvaluator();
  });

  const createMockStrategy = (overrides: Partial<StrategyGenome["genes"]> = {}): StrategyGenome => ({
    id: "test-strategy",
    generation: 1,
    parentIds: [],
    genes: {
      entryMcapMin: 10000,
      entryMcapMax: 500000,
      entryVolumeMin: 1000,
      socialSignals: {
        twitterFollowers: 100,
        telegramMembers: 50,
        holdersMin: 20,
      },
      buyPatterns: ["cat_meme", "dog_meme"],
      whaleWallets: [],
      tokenNameKeywords: ["cat", "dog", "pepe"],
      takeProfitMultiplier: 3,
      stopLossMultiplier: 0.5,
      timeBasedExit: 60,
      volumeDropExit: 0.5,
      investmentPercent: 0.05,
      maxSimultaneousPositions: 5,
      maxDrawdown: 0.3,
      diversification: 0.5,
      ...overrides,
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

  const createMockToken = (overrides: Partial<PumpFunToken> = {}): PumpFunToken => ({
    address: "token123",
    name: "CatCoin",
    symbol: "CAT",
    marketCap: 100000,
    volume24h: 5000,
    liquidity: 10000,
    holders: 50,
    createdAt: Date.now() - 60000,
    creator: "creator123",
    socialLinks: {},
    priceUSD: 0.001,
    priceChange24h: 10,
    ...overrides,
  });

  describe("shouldBuy", () => {
    it("returns true for token matching all criteria", () => {
      const strategy = createMockStrategy();
      const token = createMockToken({
        name: "SuperCat Token",
        marketCap: 100000,
        volume24h: 5000,
        holders: 100,
      });

      const result = evaluator.shouldBuy(strategy, token);

      expect(result.shouldTrade).toBe(true);
      expect(result.score).toBeGreaterThan(50);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    });

    it("returns false for token outside market cap range", () => {
      const strategy = createMockStrategy({
        entryMcapMin: 10000,
        entryMcapMax: 50000,
      });
      const token = createMockToken({ marketCap: 100000 });

      const result = evaluator.shouldBuy(strategy, token);

      expect(result.shouldTrade).toBe(false);
      expect(result.reasons).toContain("Market cap outside range");
    });

    it("returns false for token with insufficient volume", () => {
      const strategy = createMockStrategy({ entryVolumeMin: 10000 });
      const token = createMockToken({ volume24h: 1000 });

      const result = evaluator.shouldBuy(strategy, token);

      expect(result.shouldTrade).toBe(false);
      expect(result.reasons).toContain("Volume below minimum");
    });

    it("gives lower score for token with few holders", () => {
      const strategy = createMockStrategy({
        tokenNameKeywords: ["random"], // No matches
        buyPatterns: [],
      });
      strategy.genes.socialSignals.holdersMin = 100;
      const token = createMockToken({ name: "OtherToken", holders: 20 });

      const result = evaluator.shouldBuy(strategy, token);

      // Should not trade due to low score (no keyword matches, low social score)
      expect(result.shouldTrade).toBe(false);
      expect(result.socialScore).toBe(0); // Holders check failed
    });

    it("matches token name keywords", () => {
      const strategy = createMockStrategy({
        tokenNameKeywords: ["pepe", "frog"],
      });
      const token = createMockToken({ name: "Pepe the Frog" });

      const result = evaluator.shouldBuy(strategy, token);

      expect(result.matchedKeywords).toContain("pepe");
      expect(result.matchedKeywords).toContain("frog");
    });

    it("provides higher score for more keyword matches", () => {
      const strategy = createMockStrategy({
        tokenNameKeywords: ["super", "cat", "moon"],
      });
      
      const token1 = createMockToken({ name: "SuperCat Moon Token" });
      const token2 = createMockToken({ name: "Random Coin" });

      const result1 = evaluator.shouldBuy(strategy, token1);
      const result2 = evaluator.shouldBuy(strategy, token2);

      expect(result1.score).toBeGreaterThan(result2.score);
    });
  });

  describe("calculateMatchScore", () => {
    it("returns 0-100 score range", () => {
      const strategy = createMockStrategy();
      
      for (let i = 0; i < 10; i++) {
        const token = createMockToken({
          name: `Token${i}`,
          marketCap: 50000 + i * 10000,
          volume24h: 2000 + i * 500,
        });

        const result = evaluator.shouldBuy(strategy, token);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });
  });
});

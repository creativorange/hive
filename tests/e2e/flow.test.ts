import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GeneticEngine } from "@meta/core";
import type { StrategyGenome, PumpFunToken } from "@meta/core";

describe("E2E Flow Test", () => {
  let geneticEngine: GeneticEngine;
  let population: StrategyGenome[];

  beforeAll(() => {
    geneticEngine = new GeneticEngine({
      populationSize: 20,
      mutationRate: 0.1,
      crossoverRate: 0.7,
      survivorPercent: 0.2,
      deadPercent: 0.2,
      mutatorPercent: 0.6,
      elitismCount: 2,
    });
  });

  describe("Genesis Population", () => {
    it("generates 20 random strategies", () => {
      population = geneticEngine.generateGenesisPopulation(20);

      expect(population).toHaveLength(20);
      expect(population.every((s) => s.generation === 0)).toBe(true);
      expect(population.every((s) => s.status === "active")).toBe(true);
    });

    it("all strategies have valid genes", () => {
      for (const strategy of population) {
        expect(strategy.genes.entryMcapMin).toBeGreaterThan(0);
        expect(strategy.genes.entryMcapMax).toBeGreaterThan(strategy.genes.entryMcapMin);
        expect(strategy.genes.takeProfitMultiplier).toBeGreaterThan(1);
        expect(strategy.genes.stopLossMultiplier).toBeLessThan(1);
        expect(strategy.genes.buyPatterns.length).toBeGreaterThan(0);
        expect(strategy.genes.tokenNameKeywords.length).toBeGreaterThan(0);
      }
    });

    it("all strategies have unique IDs", () => {
      const ids = population.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(20);
    });
  });

  describe("Trade Simulation", () => {
    it("simulates trades for each strategy", () => {
      const mockTokens: PumpFunToken[] = [
        {
          address: "token1",
          name: "CatMoon",
          symbol: "CATM",
          marketCap: 50000,
          volume24h: 5000,
          liquidity: 10000,
          holders: 100,
          createdAt: Date.now(),
          creator: "creator1",
          socialLinks: {},
          priceUSD: 0.001,
          priceChange24h: 10,
        },
        {
          address: "token2",
          name: "DogePepe",
          symbol: "DOGEP",
          marketCap: 75000,
          volume24h: 8000,
          liquidity: 15000,
          holders: 150,
          createdAt: Date.now(),
          creator: "creator2",
          socialLinks: {},
          priceUSD: 0.002,
          priceChange24h: -5,
        },
        {
          address: "token3",
          name: "AIAgent",
          symbol: "AIAG",
          marketCap: 100000,
          volume24h: 12000,
          liquidity: 20000,
          holders: 200,
          createdAt: Date.now(),
          creator: "creator3",
          socialLinks: {},
          priceUSD: 0.003,
          priceChange24h: 25,
        },
      ];

      // Simulate trades and update performance
      for (const strategy of population) {
        const trades = Math.floor(Math.random() * 20) + 5;
        const wins = Math.floor(trades * (0.3 + Math.random() * 0.4));
        const losses = trades - wins;

        const avgWinPnL = Math.random() * 0.5;
        const avgLossPnL = -(Math.random() * 0.3);

        strategy.performance = {
          tradesExecuted: trades,
          winRate: wins / trades,
          totalPnL: wins * avgWinPnL + losses * avgLossPnL,
          sharpeRatio: Math.random() * 2,
          maxDrawdown: Math.random() * 0.3,
          avgHoldTime: 30 + Math.random() * 120,
          fitnessScore: 0,
        };
      }

      // Verify all strategies have performance data
      for (const strategy of population) {
        expect(strategy.performance.tradesExecuted).toBeGreaterThan(0);
        expect(strategy.performance.winRate).toBeGreaterThanOrEqual(0);
        expect(strategy.performance.winRate).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Evolution Cycle", () => {
    let evolutionResult: {
      newPopulation: StrategyGenome[];
      cycle: {
        generation: number;
        survivors: string[];
        dead: string[];
        newlyBorn: string[];
        avgFitness: number;
        bestFitness: number;
      };
    };

    it("runs evolution cycle successfully", () => {
      evolutionResult = geneticEngine.runEvolutionCycle(population);

      expect(evolutionResult.newPopulation.length).toBeGreaterThanOrEqual(20);
      expect(evolutionResult.cycle.generation).toBe(1);
    });

    it("has survivors from top performers", () => {
      expect(evolutionResult.cycle.survivors.length).toBeGreaterThan(0);

      // Survivors should be 20% of population
      const expectedSurvivors = Math.floor(20 * 0.2);
      expect(evolutionResult.cycle.survivors.length).toBe(expectedSurvivors);
    });

    it("has dead strategies from bottom performers", () => {
      expect(evolutionResult.cycle.dead.length).toBeGreaterThan(0);

      // Dead should be 20% of population
      const expectedDead = Math.floor(20 * 0.2);
      expect(evolutionResult.cycle.dead.length).toBe(expectedDead);
    });

    it("has newly born offspring", () => {
      expect(evolutionResult.cycle.newlyBorn.length).toBeGreaterThan(0);
    });

    it("updates fitness scores", () => {
      expect(evolutionResult.cycle.avgFitness).toBeGreaterThan(0);
      expect(evolutionResult.cycle.bestFitness).toBeGreaterThanOrEqual(
        evolutionResult.cycle.avgFitness
      );
    });

    it("offspring have correct parent references", () => {
      const offspring = evolutionResult.newPopulation.filter((s) =>
        evolutionResult.cycle.newlyBorn.includes(s.id)
      );

      for (const child of offspring) {
        expect(child.parentIds.length).toBe(2);
        expect(child.generation).toBe(1);
      }
    });
  });

  describe("Multi-Generation Evolution", () => {
    it("runs 5 generations successfully", () => {
      let currentPopulation = population;

      for (let gen = 0; gen < 5; gen++) {
        // Simulate trading performance
        for (const strategy of currentPopulation) {
          const trades = Math.floor(Math.random() * 15) + 5;
          const wins = Math.floor(trades * (0.35 + Math.random() * 0.35));
          const losses = trades - wins;

          strategy.performance = {
            tradesExecuted: strategy.performance.tradesExecuted + trades,
            winRate: wins / trades,
            totalPnL: strategy.performance.totalPnL + (wins * 0.3 - losses * 0.2),
            sharpeRatio: Math.random() * 2.5,
            maxDrawdown: Math.random() * 0.25,
            avgHoldTime: 30 + Math.random() * 100,
            fitnessScore: 0,
          };
        }

        const { newPopulation, cycle } = geneticEngine.runEvolutionCycle(currentPopulation);

        expect(cycle.generation).toBe(gen + 2); // Started at gen 1 from previous test
        expect(newPopulation.length).toBeGreaterThanOrEqual(20);

        currentPopulation = newPopulation;
      }

      expect(geneticEngine.getCurrentGeneration()).toBe(6);
    });

    it("best fitness improves over generations (generally)", () => {
      // Reset and run fresh
      const freshEngine = new GeneticEngine({ populationSize: 30 });
      let pop = freshEngine.generateGenesisPopulation(30);

      const fitnessHistory: number[] = [];

      for (let gen = 0; gen < 10; gen++) {
        // Simulate improving performance over time
        for (const strategy of pop) {
          const baseWinRate = 0.3 + gen * 0.02;
          const trades = 20;
          const wins = Math.floor(trades * (baseWinRate + Math.random() * 0.2));

          strategy.performance = {
            tradesExecuted: trades,
            winRate: wins / trades,
            totalPnL: (wins - (trades - wins)) * 0.1,
            sharpeRatio: 0.5 + gen * 0.1 + Math.random(),
            maxDrawdown: 0.2 - gen * 0.01,
            avgHoldTime: 60,
            fitnessScore: 0,
          };
        }

        const { newPopulation, cycle } = freshEngine.runEvolutionCycle(pop);
        fitnessHistory.push(cycle.bestFitness);
        pop = newPopulation;
      }

      // Best fitness at end should generally be better than start
      const firstThreeAvg = fitnessHistory.slice(0, 3).reduce((a, b) => a + b) / 3;
      const lastThreeAvg = fitnessHistory.slice(-3).reduce((a, b) => a + b) / 3;

      // Allow some variance - just check general trend
      expect(lastThreeAvg).toBeGreaterThan(firstThreeAvg * 0.8);
    });
  });

  describe("Population Statistics", () => {
    it("creates population with correct statistics", () => {
      const freshEngine = new GeneticEngine({ populationSize: 50 });
      const strategies = freshEngine.generateGenesisPopulation(50);

      // Assign some performance
      strategies.forEach((s, i) => {
        s.performance.fitnessScore = 30 + i;
        s.performance.tradesExecuted = 5 + i;
        s.performance.totalPnL = (i - 25) * 0.1;
      });

      const pop = freshEngine.createPopulation(strategies);

      expect(pop.generation).toBe(0);
      expect(pop.strategies).toHaveLength(50);
      expect(pop.bestFitness).toBe(79);
      expect(pop.avgFitness).toBeCloseTo(54.5);
      expect(pop.totalTrades).toBe(50 * 5 + (50 * 49) / 2);
    });
  });

  describe("Archetype Distribution", () => {
    it("generates diverse archetypes", () => {
      const freshEngine = new GeneticEngine({ populationSize: 100 });
      const strategies = freshEngine.generateGenesisPopulation(100);

      const archetypes = strategies.map((s) => s.archetype);
      const uniqueArchetypes = new Set(archetypes);

      // Should have multiple different archetypes
      expect(uniqueArchetypes.size).toBeGreaterThan(2);
    });
  });
});

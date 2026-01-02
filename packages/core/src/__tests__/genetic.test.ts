import { describe, it, expect, beforeEach } from "vitest";
import { GeneticEngine } from "../genetic.js";
import type { StrategyGenome, StrategyGenes } from "../types.js";

describe("GeneticEngine", () => {
  let engine: GeneticEngine;

  beforeEach(() => {
    engine = new GeneticEngine({
      populationSize: 20,
      mutationRate: 0.1,
      crossoverRate: 0.7,
      survivorPercent: 0.2,
      deadPercent: 0.2,
      mutatorPercent: 0.6,
      elitismCount: 2,
    });
  });

  describe("generateRandomGenes", () => {
    it("generates valid genes within expected ranges", () => {
      const genes = engine.generateRandomGenes();

      expect(genes.entryMcapMin).toBeGreaterThanOrEqual(1000);
      expect(genes.entryMcapMax).toBeLessThanOrEqual(1000000);
      expect(genes.entryMcapMin).toBeLessThan(genes.entryMcapMax);
      expect(genes.entryVolumeMin).toBeGreaterThanOrEqual(100);
      expect(genes.socialSignals.holdersMin).toBeGreaterThanOrEqual(10);
      expect(genes.buyPatterns.length).toBeGreaterThanOrEqual(1);
      expect(genes.tokenNameKeywords.length).toBeGreaterThanOrEqual(2);
      expect(genes.takeProfitMultiplier).toBeGreaterThanOrEqual(1.5);
      expect(genes.stopLossMultiplier).toBeLessThanOrEqual(0.8);
      expect(genes.investmentPercent).toBeGreaterThanOrEqual(0.01);
      expect(genes.maxSimultaneousPositions).toBeGreaterThanOrEqual(1);
    });
  });

  describe("determineArchetype", () => {
    it("identifies aggressive archetype", () => {
      const genes = engine.generateRandomGenes();
      genes.takeProfitMultiplier = 6;
      genes.stopLossMultiplier = 0.4;

      expect(engine.determineArchetype(genes)).toBe("aggressive");
    });

    it("identifies conservative archetype", () => {
      const genes = engine.generateRandomGenes();
      genes.takeProfitMultiplier = 2;
      genes.stopLossMultiplier = 0.75;

      expect(engine.determineArchetype(genes)).toBe("conservative");
    });

    it("identifies social archetype", () => {
      const genes = engine.generateRandomGenes();
      genes.socialSignals.twitterFollowers = 6000;
      genes.takeProfitMultiplier = 3;
      genes.stopLossMultiplier = 0.6;

      expect(engine.determineArchetype(genes)).toBe("social");
    });

    it("identifies whale_follower archetype", () => {
      const genes = engine.generateRandomGenes();
      genes.whaleWallets = ["wallet1", "wallet2"];
      genes.socialSignals.twitterFollowers = 100;
      genes.socialSignals.telegramMembers = 100;
      genes.takeProfitMultiplier = 3;
      genes.stopLossMultiplier = 0.6;
      genes.entryMcapMax = 200000;
      genes.timeBasedExit = 60;

      expect(engine.determineArchetype(genes)).toBe("whale_follower");
    });

    it("identifies sniper archetype", () => {
      const genes = engine.generateRandomGenes();
      genes.entryMcapMax = 50000;
      genes.timeBasedExit = 20;
      genes.whaleWallets = [];
      genes.socialSignals.twitterFollowers = 100;
      genes.takeProfitMultiplier = 3;
      genes.stopLossMultiplier = 0.6;

      expect(engine.determineArchetype(genes)).toBe("sniper");
    });
  });

  describe("generateGenesisPopulation", () => {
    it("generates correct population size", () => {
      const population = engine.generateGenesisPopulation(10);
      expect(population).toHaveLength(10);
    });

    it("generates unique strategy IDs", () => {
      const population = engine.generateGenesisPopulation(10);
      const ids = population.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it("sets generation to 0 for genesis", () => {
      const population = engine.generateGenesisPopulation(5);
      population.forEach((s) => {
        expect(s.generation).toBe(0);
        expect(s.parentIds).toHaveLength(0);
      });
    });

    it("initializes with default performance", () => {
      const population = engine.generateGenesisPopulation(5);
      population.forEach((s) => {
        expect(s.performance.tradesExecuted).toBe(0);
        expect(s.performance.winRate).toBe(0);
        expect(s.performance.totalPnL).toBe(0);
        expect(s.performance.fitnessScore).toBe(50);
      });
    });
  });

  describe("calculateFitness", () => {
    it("calculates fitness based on performance metrics", () => {
      const strategy = engine.createStrategy(engine.generateRandomGenes(), 1, []);
      strategy.performance = {
        tradesExecuted: 50,
        winRate: 0.6,
        totalPnL: 5,
        sharpeRatio: 1.5,
        maxDrawdown: 0.1,
        avgHoldTime: 120,
        fitnessScore: 0,
      };

      const fitness = engine.calculateFitness(strategy);

      expect(fitness).toBeGreaterThan(0);
      expect(fitness).toBeLessThanOrEqual(100);
    });

    it("gives higher fitness for better PnL", () => {
      const strategy1 = engine.createStrategy(engine.generateRandomGenes(), 1, []);
      const strategy2 = engine.createStrategy(engine.generateRandomGenes(), 1, []);

      strategy1.performance.totalPnL = 10;
      strategy2.performance.totalPnL = 1;

      const fitness1 = engine.calculateFitness(strategy1);
      const fitness2 = engine.calculateFitness(strategy2);

      expect(fitness1).toBeGreaterThan(fitness2);
    });

    it("penalizes high drawdown", () => {
      const strategy1 = engine.createStrategy(engine.generateRandomGenes(), 1, []);
      const strategy2 = engine.createStrategy(engine.generateRandomGenes(), 1, []);

      strategy1.performance.maxDrawdown = 0.1;
      strategy2.performance.maxDrawdown = 0.5;

      const fitness1 = engine.calculateFitness(strategy1);
      const fitness2 = engine.calculateFitness(strategy2);

      expect(fitness1).toBeGreaterThan(fitness2);
    });
  });

  describe("performSelection", () => {
    it("divides population into survivors, mutators, and dead", () => {
      const population = engine.generateGenesisPopulation(20);
      
      // Assign varying fitness
      population.forEach((s, i) => {
        s.performance.fitnessScore = 100 - i * 5;
      });

      const result = engine.performSelection(population);

      expect(result.survivors.length).toBeGreaterThan(0);
      expect(result.mutators.length).toBeGreaterThan(0);
      expect(result.dead.length).toBeGreaterThan(0);
      expect(result.dead.every((s) => s.status === "dead")).toBe(true);
    });

    it("survivors have highest fitness scores", () => {
      const population = engine.generateGenesisPopulation(20);
      population.forEach((s, i) => {
        s.performance.fitnessScore = i * 5;
      });

      const result = engine.performSelection(population);
      const survivorFitnesses = result.survivors.map((s) => s.performance.fitnessScore);
      const mutatorFitnesses = result.mutators.map((s) => s.performance.fitnessScore);

      const minSurvivor = Math.min(...survivorFitnesses);
      const maxMutator = Math.max(...mutatorFitnesses);

      expect(minSurvivor).toBeGreaterThanOrEqual(maxMutator);
    });
  });

  describe("crossoverGenes", () => {
    it("produces offspring with genes from both parents", () => {
      const parent1 = engine.generateRandomGenes();
      const parent2 = engine.generateRandomGenes();

      parent1.entryMcapMin = 1000;
      parent2.entryMcapMin = 5000;

      const offspring = engine.crossoverGenes(parent1, parent2);

      expect([1000, 5000]).toContain(offspring.entryMcapMin);
    });

    it("combines whale wallets from both parents", () => {
      const parent1 = engine.generateRandomGenes();
      const parent2 = engine.generateRandomGenes();

      parent1.whaleWallets = ["wallet1"];
      parent2.whaleWallets = ["wallet2"];

      const offspring = engine.crossoverGenes(parent1, parent2);

      expect(offspring.whaleWallets).toContain("wallet1");
      expect(offspring.whaleWallets).toContain("wallet2");
    });
  });

  describe("mutateGenes", () => {
    it("mutates genes with given probability", () => {
      const original = engine.generateRandomGenes();
      const mutated = engine.mutateGenes(original, 1.0); // 100% mutation rate

      // At least some genes should be different
      const hasDifference =
        mutated.entryMcapMin !== original.entryMcapMin ||
        mutated.takeProfitMultiplier !== original.takeProfitMultiplier ||
        mutated.stopLossMultiplier !== original.stopLossMultiplier;

      expect(hasDifference).toBe(true);
    });

    it("keeps genes valid after mutation", () => {
      const original = engine.generateRandomGenes();
      const mutated = engine.mutateGenes(original, 1.0);

      expect(mutated.entryMcapMin).toBeGreaterThanOrEqual(100);
      expect(mutated.entryMcapMax).toBeGreaterThanOrEqual(mutated.entryMcapMin);
      expect(mutated.takeProfitMultiplier).toBeGreaterThanOrEqual(1.1);
      expect(mutated.stopLossMultiplier).toBeGreaterThanOrEqual(0.1);
      expect(mutated.stopLossMultiplier).toBeLessThanOrEqual(0.95);
    });
  });

  describe("breedStrategies", () => {
    it("creates offspring with parent references", () => {
      const parent1 = engine.createStrategy(engine.generateRandomGenes(), 1, []);
      const parent2 = engine.createStrategy(engine.generateRandomGenes(), 1, []);

      engine.setCurrentGeneration(1);
      const offspring = engine.breedStrategies(parent1, parent2);

      expect(offspring.parentIds).toContain(parent1.id);
      expect(offspring.parentIds).toContain(parent2.id);
      expect(offspring.generation).toBe(2);
    });
  });

  describe("runEvolutionCycle", () => {
    it("produces new population with correct structure", () => {
      const population = engine.generateGenesisPopulation(20);
      
      // Simulate some trading activity
      population.forEach((s, i) => {
        s.performance = {
          tradesExecuted: 10 + i,
          winRate: 0.4 + i * 0.02,
          totalPnL: -2 + i * 0.3,
          sharpeRatio: 0.5 + i * 0.1,
          maxDrawdown: 0.3 - i * 0.01,
          avgHoldTime: 60,
          fitnessScore: 0,
        };
      });

      const { newPopulation, cycle } = engine.runEvolutionCycle(population);

      expect(newPopulation.length).toBeGreaterThanOrEqual(20);
      expect(cycle.generation).toBe(1);
      expect(cycle.survivors.length).toBeGreaterThan(0);
      expect(cycle.dead.length).toBeGreaterThan(0);
      expect(cycle.avgFitness).toBeGreaterThan(0);
      expect(cycle.bestFitness).toBeGreaterThanOrEqual(cycle.avgFitness);
    });

    it("increments generation counter", () => {
      const population = engine.generateGenesisPopulation(20);
      
      const initialGen = engine.getCurrentGeneration();
      engine.runEvolutionCycle(population);
      
      expect(engine.getCurrentGeneration()).toBe(initialGen + 1);
    });
  });

  describe("createPopulation", () => {
    it("aggregates population statistics correctly", () => {
      const strategies = engine.generateGenesisPopulation(10);
      
      strategies.forEach((s, i) => {
        s.performance.fitnessScore = 50 + i * 5;
        s.performance.tradesExecuted = 10 + i;
        s.performance.totalPnL = i * 0.5;
      });

      const population = engine.createPopulation(strategies);

      expect(population.generation).toBe(0);
      expect(population.strategies).toHaveLength(10);
      expect(population.bestFitness).toBe(95);
      expect(population.avgFitness).toBeCloseTo(72.5);
      expect(population.totalTrades).toBe(145);
    });
  });
});

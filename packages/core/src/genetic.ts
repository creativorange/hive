import type {
  StrategyGenome,
  StrategyGenes,
  StrategyPerformance,
  StrategyArchetype,
  GeneticConfig,
  Population,
  SelectionResult,
  EvolutionCycle,
} from "./types.js";
import {
  BUY_PATTERNS,
  TOKEN_KEYWORDS,
  SELL_PATTERNS,
} from "./types.js";
import {
  generateId,
  randomFloat,
  randomInt,
  randomChoices,
  shuffleArray,
  clamp,
  mutateValue,
  pickFromParents,
  generateStrategyName,
  nowTimestamp,
} from "./utils.js";

const DEFAULT_CONFIG: GeneticConfig = {
  populationSize: 100,
  mutationRate: 0.1,
  crossoverRate: 0.7,
  survivorPercent: 0.2,
  deadPercent: 0.2,
  mutatorPercent: 0.6,
  elitismCount: 5,
};

export class GeneticEngine {
  private config: GeneticConfig;
  private currentGeneration: number = 0;

  constructor(config: Partial<GeneticConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  generateRandomGenes(): StrategyGenes {
    return {
      // Entry criteria
      entryMcapMin: randomFloat(1000, 50000),
      entryMcapMax: randomFloat(50000, 1000000),
      entryVolumeMin: randomFloat(100, 10000),
      socialSignals: {
        twitterFollowers: randomInt(0, 10000),
        telegramMembers: randomInt(0, 5000),
        holdersMin: randomInt(10, 500),
      },
      buyPatterns: randomChoices(BUY_PATTERNS, randomInt(1, 5)),
      whaleWallets: [],
      tokenNameKeywords: randomChoices(TOKEN_KEYWORDS, randomInt(2, 8)),
      
      // Exit criteria (mechanical) - tighter stops for memecoins
      takeProfitMultiplier: randomFloat(1.3, 3.0), // Take profits at 30-200% gain
      stopLossMultiplier: randomFloat(0.85, 0.95), // Stop loss at 5-15% loss (not 50%!)
      timeBasedExit: randomInt(5, 120), // Max 2 hours hold time
      volumeDropExit: randomFloat(0.3, 0.5),
      
      // Exit criteria (strategic) - ALL ALWAYS ENABLED for aggressive selling
      sellSignals: {
        momentumReversal: true,
        volumeDry: true,
        holdersDumping: true,
        mcapCeiling: randomFloat(200000, 2000000), // Sell at 200k-2M mcap
        profitSecuring: randomFloat(0.2, 0.5), // Take profits at 20-50% gain
        trailingStop: randomFloat(0.08, 0.15), // Tight trailing stop 8-15%
      },
      sellPatterns: randomChoices(SELL_PATTERNS, randomInt(3, 6)),
      
      // Position sizing - 3-33% of 3 SOL allocation = 0.1-1 SOL per trade
      investmentPercent: randomFloat(0.03, 0.33),
      maxSimultaneousPositions: randomInt(1, 10),
      maxDrawdown: randomFloat(0.1, 0.5),
      diversification: randomFloat(0.1, 1.0),
    };
  }

  determineArchetype(genes: StrategyGenes): StrategyArchetype {
    if (genes.takeProfitMultiplier > 5 && genes.stopLossMultiplier < 0.5) {
      return "aggressive";
    }
    if (genes.stopLossMultiplier > 0.7 && genes.takeProfitMultiplier < 3) {
      return "conservative";
    }
    if (genes.socialSignals.twitterFollowers > 5000 || genes.socialSignals.telegramMembers > 2000) {
      return "social";
    }
    if (genes.whaleWallets.length > 0) {
      return "whale_follower";
    }
    if (genes.entryMcapMax < 100000 && genes.timeBasedExit < 30) {
      return "sniper";
    }
    return "momentum";
  }

  createStrategy(
    genes: StrategyGenes,
    generation: number,
    parentIds: string[] = []
  ): StrategyGenome {
    return {
      id: generateId(),
      generation,
      parentIds,
      genes,
      performance: this.createInitialPerformance(),
      status: "active",
      birthTimestamp: nowTimestamp(),
      name: generateStrategyName(),
      archetype: this.determineArchetype(genes),
    };
  }

  private createInitialPerformance(): StrategyPerformance {
    return {
      tradesExecuted: 0,
      winRate: 0,
      totalPnL: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      avgHoldTime: 0,
      fitnessScore: 50,
    };
  }

  generateGenesisPopulation(count: number = this.config.populationSize): StrategyGenome[] {
    const strategies: StrategyGenome[] = [];
    
    for (let i = 0; i < count; i++) {
      const genes = this.generateRandomGenes();
      const strategy = this.createStrategy(genes, 0, []);
      strategies.push(strategy);
    }
    
    return strategies;
  }

  calculateFitness(strategy: StrategyGenome): number {
    const { performance } = strategy;
    
    const pnlScore = Math.min(100, Math.max(0, 50 + performance.totalPnL * 10));
    const winRateScore = performance.winRate * 100;
    const sharpeScore = Math.min(100, Math.max(0, 50 + performance.sharpeRatio * 20));
    const consistencyScore = Math.max(0, 100 - performance.maxDrawdown * 200);
    
    const fitnessScore =
      pnlScore * 0.4 +
      winRateScore * 0.25 +
      sharpeScore * 0.2 +
      consistencyScore * 0.15;
    
    return clamp(fitnessScore, 0, 100);
  }

  updateFitness(strategy: StrategyGenome): StrategyGenome {
    const fitnessScore = this.calculateFitness(strategy);
    return {
      ...strategy,
      performance: {
        ...strategy.performance,
        fitnessScore,
      },
    };
  }

  performSelection(population: StrategyGenome[]): SelectionResult {
    const sorted = [...population]
      .filter(s => s.status !== "dead")
      .sort((a, b) => b.performance.fitnessScore - a.performance.fitnessScore);
    
    const survivorCount = Math.floor(sorted.length * this.config.survivorPercent);
    const deadCount = Math.floor(sorted.length * this.config.deadPercent);
    
    const survivors = sorted.slice(0, survivorCount);
    const dead = sorted.slice(-deadCount).map(s => ({
      ...s,
      status: "dead" as const,
      deathTimestamp: nowTimestamp(),
    }));
    const mutators = sorted.slice(survivorCount, -deadCount);
    
    return { survivors, mutators, dead };
  }

  crossoverGenes(parent1: StrategyGenes, parent2: StrategyGenes): StrategyGenes {
    return {
      // Entry criteria
      entryMcapMin: pickFromParents(parent1.entryMcapMin, parent2.entryMcapMin),
      entryMcapMax: pickFromParents(parent1.entryMcapMax, parent2.entryMcapMax),
      entryVolumeMin: pickFromParents(parent1.entryVolumeMin, parent2.entryVolumeMin),
      socialSignals: pickFromParents(parent1.socialSignals, parent2.socialSignals),
      buyPatterns: pickFromParents(parent1.buyPatterns, parent2.buyPatterns),
      whaleWallets: [...new Set([...parent1.whaleWallets, ...parent2.whaleWallets])],
      tokenNameKeywords: pickFromParents(parent1.tokenNameKeywords, parent2.tokenNameKeywords),
      
      // Exit criteria (mechanical)
      takeProfitMultiplier: pickFromParents(parent1.takeProfitMultiplier, parent2.takeProfitMultiplier),
      stopLossMultiplier: pickFromParents(parent1.stopLossMultiplier, parent2.stopLossMultiplier),
      timeBasedExit: pickFromParents(parent1.timeBasedExit, parent2.timeBasedExit),
      volumeDropExit: pickFromParents(parent1.volumeDropExit, parent2.volumeDropExit),
      
      // Exit criteria (strategic)
      sellSignals: pickFromParents(parent1.sellSignals, parent2.sellSignals),
      sellPatterns: pickFromParents(parent1.sellPatterns, parent2.sellPatterns),
      
      // Position sizing
      investmentPercent: pickFromParents(parent1.investmentPercent, parent2.investmentPercent),
      maxSimultaneousPositions: pickFromParents(parent1.maxSimultaneousPositions, parent2.maxSimultaneousPositions),
      maxDrawdown: pickFromParents(parent1.maxDrawdown, parent2.maxDrawdown),
      diversification: pickFromParents(parent1.diversification, parent2.diversification),
    };
  }

  breedStrategies(parent1: StrategyGenome, parent2: StrategyGenome): StrategyGenome {
    const offspringGenes = this.crossoverGenes(parent1.genes, parent2.genes);
    const mutatedGenes = this.mutateGenes(offspringGenes, this.config.mutationRate * 0.5);
    
    return this.createStrategy(mutatedGenes, this.currentGeneration + 1, [parent1.id, parent2.id]);
  }

  mutateGenes(genes: StrategyGenes, mutationRate: number = this.config.mutationRate): StrategyGenes {
    const shouldMutate = () => Math.random() < mutationRate;
    
    const mutated: StrategyGenes = { ...genes };
    
    if (shouldMutate()) mutated.entryMcapMin = clamp(mutateValue(genes.entryMcapMin), 100, 100000);
    if (shouldMutate()) mutated.entryMcapMax = clamp(mutateValue(genes.entryMcapMax), mutated.entryMcapMin, 10000000);
    if (shouldMutate()) mutated.entryVolumeMin = clamp(mutateValue(genes.entryVolumeMin), 10, 100000);
    
    if (shouldMutate()) {
      mutated.socialSignals = {
        twitterFollowers: clamp(Math.round(mutateValue(genes.socialSignals.twitterFollowers)), 0, 100000),
        telegramMembers: clamp(Math.round(mutateValue(genes.socialSignals.telegramMembers)), 0, 50000),
        holdersMin: clamp(Math.round(mutateValue(genes.socialSignals.holdersMin)), 1, 10000),
      };
    }
    
    if (shouldMutate()) {
      const currentPatterns = [...genes.buyPatterns];
      if (Math.random() > 0.5 && currentPatterns.length < 5) {
        const newPattern = randomChoices(BUY_PATTERNS, 1)[0];
        if (!currentPatterns.includes(newPattern)) {
          currentPatterns.push(newPattern);
        }
      } else if (currentPatterns.length > 1) {
        currentPatterns.splice(randomInt(0, currentPatterns.length - 1), 1);
      }
      mutated.buyPatterns = currentPatterns;
    }
    
    if (shouldMutate()) {
      const currentKeywords = [...genes.tokenNameKeywords];
      if (Math.random() > 0.5 && currentKeywords.length < 10) {
        const newKeyword = randomChoices(TOKEN_KEYWORDS, 1)[0];
        if (!currentKeywords.includes(newKeyword)) {
          currentKeywords.push(newKeyword);
        }
      } else if (currentKeywords.length > 1) {
        currentKeywords.splice(randomInt(0, currentKeywords.length - 1), 1);
      }
      mutated.tokenNameKeywords = currentKeywords;
    }
    
    if (shouldMutate()) mutated.takeProfitMultiplier = clamp(mutateValue(genes.takeProfitMultiplier), 1.2, 5.0);
    if (shouldMutate()) mutated.stopLossMultiplier = clamp(mutateValue(genes.stopLossMultiplier), 0.80, 0.98); // Tight stop losses
    if (shouldMutate()) mutated.timeBasedExit = clamp(Math.round(mutateValue(genes.timeBasedExit)), 5, 180); // Max 3 hours
    if (shouldMutate()) mutated.volumeDropExit = clamp(mutateValue(genes.volumeDropExit), 0.2, 0.6);
    
    // Mutate sell signals - keep booleans always true, only mutate thresholds
    if (shouldMutate()) {
      mutated.sellSignals = {
        momentumReversal: true, // Always enabled
        volumeDry: true,        // Always enabled
        holdersDumping: true,   // Always enabled
        mcapCeiling: clamp(mutateValue(genes.sellSignals.mcapCeiling || 500000), 100000, 5000000),
        profitSecuring: clamp(mutateValue(genes.sellSignals.profitSecuring || 0.3), 0.1, 1.0),
        trailingStop: clamp(mutateValue(genes.sellSignals.trailingStop || 0.1), 0.05, 0.25),
      };
    }
    
    // Mutate sell patterns
    if (shouldMutate()) {
      const currentPatterns = [...genes.sellPatterns];
      if (Math.random() > 0.5 && currentPatterns.length < 5) {
        const newPattern = randomChoices(SELL_PATTERNS, 1)[0];
        if (!currentPatterns.includes(newPattern)) {
          currentPatterns.push(newPattern);
        }
      } else if (currentPatterns.length > 1) {
        currentPatterns.splice(randomInt(0, currentPatterns.length - 1), 1);
      }
      mutated.sellPatterns = currentPatterns;
    }
    
    if (shouldMutate()) mutated.investmentPercent = clamp(mutateValue(genes.investmentPercent), 0.03, 0.33);
    if (shouldMutate()) mutated.maxSimultaneousPositions = clamp(Math.round(mutateValue(genes.maxSimultaneousPositions)), 1, 20);
    if (shouldMutate()) mutated.maxDrawdown = clamp(mutateValue(genes.maxDrawdown), 0.05, 0.8);
    if (shouldMutate()) mutated.diversification = clamp(mutateValue(genes.diversification), 0, 1);
    
    return mutated;
  }

  mutateStrategy(strategy: StrategyGenome, mutationRate: number = this.config.mutationRate): StrategyGenome {
    const mutatedGenes = this.mutateGenes(strategy.genes, mutationRate);
    return {
      ...strategy,
      genes: mutatedGenes,
      archetype: this.determineArchetype(mutatedGenes),
    };
  }

  runEvolutionCycle(population: StrategyGenome[]): {
    newPopulation: StrategyGenome[];
    cycle: EvolutionCycle;
  } {
    const populationWithFitness = population.map(s => this.updateFitness(s));
    
    const { survivors, mutators, dead } = this.performSelection(populationWithFitness);
    
    const shuffledSurvivors = shuffleArray(survivors);
    const offspring: StrategyGenome[] = [];
    
    for (let i = 0; i < shuffledSurvivors.length - 1; i += 2) {
      const child = this.breedStrategies(shuffledSurvivors[i], shuffledSurvivors[i + 1]);
      offspring.push(child);
    }
    
    const mutatedStrategies = mutators.map(s => this.mutateStrategy(s));
    
    const newPopulation = [
      ...survivors,
      ...offspring,
      ...mutatedStrategies,
    ];
    
    while (newPopulation.length < this.config.populationSize) {
      const randomParent1 = survivors[randomInt(0, survivors.length - 1)];
      const randomParent2 = survivors[randomInt(0, survivors.length - 1)];
      if (randomParent1.id !== randomParent2.id) {
        offspring.push(this.breedStrategies(randomParent1, randomParent2));
        newPopulation.push(offspring[offspring.length - 1]);
      }
    }
    
    this.currentGeneration++;
    
    const allFitness = newPopulation.map(s => s.performance.fitnessScore);
    const avgFitness = allFitness.reduce((a, b) => a + b, 0) / allFitness.length;
    const bestFitness = Math.max(...allFitness);
    const bestStrategy = newPopulation.find(s => s.performance.fitnessScore === bestFitness)!;
    
    const cycle: EvolutionCycle = {
      id: generateId(),
      generation: this.currentGeneration,
      cycleTimestamp: nowTimestamp(),
      survivors: survivors.map(s => s.id),
      dead: dead.map(s => s.id),
      newlyBorn: offspring.map(s => s.id),
      avgFitness,
      bestFitness,
      totalPnLSol: population.reduce((sum, s) => sum + s.performance.totalPnL, 0),
      bestStrategyId: bestStrategy.id,
    };
    
    return { newPopulation, cycle };
  }

  createPopulation(strategies: StrategyGenome[]): Population {
    const allFitness = strategies.map(s => s.performance.fitnessScore);
    
    return {
      generation: this.currentGeneration,
      strategies,
      bestFitness: Math.max(...allFitness, 0),
      avgFitness: allFitness.length > 0 
        ? allFitness.reduce((a, b) => a + b, 0) / allFitness.length 
        : 0,
      totalTrades: strategies.reduce((sum, s) => sum + s.performance.tradesExecuted, 0),
      totalPnL: strategies.reduce((sum, s) => sum + s.performance.totalPnL, 0),
    };
  }

  getConfig(): GeneticConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<GeneticConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getCurrentGeneration(): number {
    return this.currentGeneration;
  }

  setCurrentGeneration(generation: number): void {
    this.currentGeneration = generation;
  }
}

export const geneticEngine = new GeneticEngine();

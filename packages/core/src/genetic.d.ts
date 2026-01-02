import type { StrategyGenome, StrategyGenes, StrategyArchetype, GeneticConfig, Population, SelectionResult, EvolutionCycle } from "./types.js";
export declare class GeneticEngine {
    private config;
    private currentGeneration;
    constructor(config?: Partial<GeneticConfig>);
    generateRandomGenes(): StrategyGenes;
    determineArchetype(genes: StrategyGenes): StrategyArchetype;
    createStrategy(genes: StrategyGenes, generation: number, parentIds?: string[]): StrategyGenome;
    private createInitialPerformance;
    generateGenesisPopulation(count?: number): StrategyGenome[];
    calculateFitness(strategy: StrategyGenome): number;
    updateFitness(strategy: StrategyGenome): StrategyGenome;
    performSelection(population: StrategyGenome[]): SelectionResult;
    crossoverGenes(parent1: StrategyGenes, parent2: StrategyGenes): StrategyGenes;
    breedStrategies(parent1: StrategyGenome, parent2: StrategyGenome): StrategyGenome;
    mutateGenes(genes: StrategyGenes, mutationRate?: number): StrategyGenes;
    mutateStrategy(strategy: StrategyGenome, mutationRate?: number): StrategyGenome;
    runEvolutionCycle(population: StrategyGenome[]): {
        newPopulation: StrategyGenome[];
        cycle: EvolutionCycle;
    };
    createPopulation(strategies: StrategyGenome[]): Population;
    getConfig(): GeneticConfig;
    setConfig(config: Partial<GeneticConfig>): void;
    getCurrentGeneration(): number;
    setCurrentGeneration(generation: number): void;
}
export declare const geneticEngine: GeneticEngine;
//# sourceMappingURL=genetic.d.ts.map
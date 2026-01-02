import cron from "node-cron";
import type { GeneticEngine, StrategyGenome, StrategyPerformance } from "@meta/core";
import type { StrategiesRepository, EvolutionRepository } from "@meta/database";
import type { WebSocketHandler } from "../websocket/handler.js";

export class EvolutionScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  constructor(
    private geneticEngine: GeneticEngine,
    private strategiesRepo: StrategiesRepository,
    private evolutionRepo: EvolutionRepository,
    private wsHandler: WebSocketHandler
  ) {
    this.start();
  }

  start(): void {
    if (this.cronJob) {
      return;
    }

    this.cronJob = cron.schedule("0 0 * * *", async () => {
      await this.runEvolutionCycle();
    });

    console.log("[EvolutionScheduler] Started - runs daily at midnight");
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    console.log("[EvolutionScheduler] Stopped");
  }

  async runEvolutionCycle(): Promise<void> {
    if (this.isRunning) {
      console.log("[EvolutionScheduler] Cycle already in progress, skipping");
      return;
    }

    this.isRunning = true;
    console.log("[EvolutionScheduler] Starting evolution cycle...");

    try {
      const activeStrategies = await this.strategiesRepo.findActive();

      if (activeStrategies.length === 0) {
        console.log("[EvolutionScheduler] No active strategies, skipping cycle");
        return;
      }

      this.wsHandler.broadcast("evolution:started", {
        timestamp: Date.now(),
        strategiesCount: activeStrategies.length,
      });

      const genomes: StrategyGenome[] = activeStrategies.map((s) => ({
        id: s.id,
        generation: s.generation,
        parentIds: s.parentIds,
        genes: s.genes,
        performance: s.performance as StrategyPerformance,
        status: s.status as StrategyGenome["status"],
        birthTimestamp: s.birthTimestamp.getTime(),
        deathTimestamp: s.deathTimestamp?.getTime(),
        name: s.name ?? undefined,
        archetype: s.archetype ?? undefined,
      }));

      const { newPopulation, cycle } = this.geneticEngine.runEvolutionCycle(genomes);

      if (cycle.dead.length > 0) {
        await this.strategiesRepo.markDeadMany(cycle.dead);
        this.wsHandler.broadcast("evolution:deaths", {
          count: cycle.dead.length,
          ids: cycle.dead,
        });
      }

      const newStrategies = newPopulation.filter((s: StrategyGenome) =>
        cycle.newlyBorn.includes(s.id)
      );

      for (const strategy of newStrategies) {
        await this.strategiesRepo.create({
          id: strategy.id,
          generation: strategy.generation,
          parentIds: strategy.parentIds,
          genes: strategy.genes,
          performance: strategy.performance,
          status: strategy.status,
          name: strategy.name,
          archetype: strategy.archetype,
          birthTimestamp: new Date(strategy.birthTimestamp),
        });
      }

      if (newStrategies.length > 0) {
        this.wsHandler.broadcast("evolution:births", {
          count: newStrategies.length,
          ids: cycle.newlyBorn,
        });
      }

      await this.evolutionRepo.createCycle({
        generation: cycle.generation,
        survivors: cycle.survivors,
        dead: cycle.dead,
        newlyBorn: cycle.newlyBorn,
        avgFitness: cycle.avgFitness,
        bestFitness: cycle.bestFitness,
        totalPnlSol: cycle.totalPnLSol,
        bestStrategyId: cycle.bestStrategyId,
      });

      const fitnessScores = newPopulation.map((s) => s.performance.fitnessScore);
      const avgFitness = fitnessScores.reduce((a, b) => a + b, 0) / fitnessScores.length;
      const bestFitness = Math.max(...fitnessScores);

      this.wsHandler.broadcast("evolution:completed", {
        cycle,
        newPopulation: {
          generation: cycle.generation,
          count: newPopulation.length,
          avgFitness,
          bestFitness,
        },
      });

      console.log(
        `[EvolutionScheduler] Cycle complete - Gen ${cycle.generation}: ` +
          `${cycle.dead.length} died, ${cycle.newlyBorn.length} born, ` +
          `${cycle.survivors.length} survived`
      );
    } catch (error) {
      console.error("[EvolutionScheduler] Error during evolution cycle:", error);
      this.wsHandler.broadcast("evolution:error", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      this.isRunning = false;
    }
  }

  async triggerManualCycle(): Promise<void> {
    await this.runEvolutionCycle();
  }

  isSchedulerRunning(): boolean {
    return this.cronJob !== null;
  }

  isCycleInProgress(): boolean {
    return this.isRunning;
  }
}

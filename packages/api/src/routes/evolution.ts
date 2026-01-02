import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { StrategyPerformance, StrategyGenome } from "@meta/core";

export const registerEvolutionRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get("/evolution/current", async (request, reply) => {
    const latestCycle = await fastify.ctx.evolutionRepo.getLatest();
    const activeStrategies = await fastify.ctx.strategiesRepo.findActive();
    const generation = await fastify.ctx.strategiesRepo.getLatestGeneration();

    const fitnesses = activeStrategies.map(
      (s) => (s.performance as StrategyPerformance).fitnessScore
    );
    const avgFitness = fitnesses.length > 0
      ? fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length
      : 0;
    const bestFitness = fitnesses.length > 0 ? Math.max(...fitnesses) : 0;

    const bestStrategy = activeStrategies.reduce<typeof activeStrategies[0] | null>(
      (best, current) => {
        const currentFitness = (current.performance as StrategyPerformance).fitnessScore;
        const bestFitness = best
          ? (best.performance as StrategyPerformance).fitnessScore
          : -Infinity;
        return currentFitness > bestFitness ? current : best;
      },
      null
    );

    return {
      generation,
      activeStrategies: activeStrategies.length,
      avgFitness,
      bestFitness,
      bestStrategy,
      lastCycle: latestCycle,
    };
  });

  fastify.get("/evolution/history", async (request, reply) => {
    const history = await fastify.ctx.evolutionRepo.getHistory(100);
    return history;
  });

  fastify.get("/evolution/fitness-history", async (request, reply) => {
    const fitnessHistory = await fastify.ctx.evolutionRepo.getAverageFitnessHistory(100);
    return fitnessHistory;
  });

  fastify.get("/evolution/pnl-history", async (request, reply) => {
    const pnlHistory = await fastify.ctx.evolutionRepo.getTotalPnlHistory(100);
    return pnlHistory;
  });

  fastify.post("/evolution/trigger", async (request, reply) => {
    const activeStrategies = await fastify.ctx.strategiesRepo.findActive();

    if (activeStrategies.length === 0) {
      return reply.status(400).send({ error: "No active strategies to evolve" });
    }

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

    const { newPopulation, cycle } = fastify.ctx.geneticEngine.runEvolutionCycle(genomes);

    await fastify.ctx.strategiesRepo.markDeadMany(cycle.dead);

    const newStrategies = newPopulation.filter(
      (s: StrategyGenome) => cycle.newlyBorn.includes(s.id)
    );

    for (const strategy of newStrategies) {
      await fastify.ctx.strategiesRepo.create({
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

    await fastify.ctx.evolutionRepo.createCycle({
      generation: cycle.generation,
      survivors: cycle.survivors,
      dead: cycle.dead,
      newlyBorn: cycle.newlyBorn,
      avgFitness: cycle.avgFitness,
      bestFitness: cycle.bestFitness,
      totalPnlSol: cycle.totalPnLSol,
      bestStrategyId: cycle.bestStrategyId,
    });

    fastify.ctx.wsHandler.broadcast("evolution:cycle", cycle);

    const fitnessScores = newPopulation.map((s) => s.performance.fitnessScore);
    const avgFitness = fitnessScores.reduce((a, b) => a + b, 0) / fitnessScores.length;
    const bestFitness = Math.max(...fitnessScores);

    return {
      success: true,
      cycle,
      newPopulation: {
        generation: cycle.generation,
        count: newPopulation.length,
        avgFitness,
        bestFitness,
      },
    };
  });
};

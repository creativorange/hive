import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { StrategyPerformance } from "@meta/core";

export const registerStrategiesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get("/strategies", async (request, reply) => {
    const strategies = await fastify.ctx.strategiesRepo.findActive();
    return strategies;
  });

  fastify.get<{ Params: { id: string } }>("/strategies/:id", async (request, reply) => {
    const { id } = request.params;
    const strategy = await fastify.ctx.strategiesRepo.findById(id);

    if (!strategy) {
      return reply.status(404).send({ error: "Strategy not found" });
    }

    const trades = await fastify.ctx.tradesRepo.findByStrategy(id);
    const stats = await fastify.ctx.tradesRepo.getStatsByStrategy(id);

    return {
      ...strategy,
      trades,
      stats,
    };
  });

  fastify.get<{ Params: { count: string } }>("/strategies/top/:count", async (request, reply) => {
    const count = parseInt(request.params.count, 10) || 10;
    const topStrategies = await fastify.ctx.strategiesRepo.getTopPerformers(count);
    return topStrategies;
  });

  fastify.get("/strategies/graveyard", async (request, reply) => {
    const deadStrategies = await fastify.ctx.strategiesRepo.getGraveyard(50);
    return deadStrategies;
  });

  fastify.get("/strategies/population", async (request, reply) => {
    const active = await fastify.ctx.strategiesRepo.findActive();
    const generation = await fastify.ctx.strategiesRepo.getLatestGeneration();
    const activeCount = active.length;

    const fitnesses = active.map((s) => (s.performance as StrategyPerformance).fitnessScore);
    const avgFitness = fitnesses.length > 0
      ? fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length
      : 0;
    const bestFitness = fitnesses.length > 0 ? Math.max(...fitnesses) : 0;

    return {
      generation,
      activeCount,
      avgFitness,
      bestFitness,
      strategies: active,
    };
  });

  fastify.get("/strategies/with-trades", async (request, reply) => {
    const strategies = await fastify.ctx.strategiesRepo.findActive();
    
    const strategiesWithTrades = await Promise.all(
      strategies.map(async (strategy) => {
        const trades = await fastify.ctx.tradesRepo.findByStrategy(strategy.id);
        const stats = await fastify.ctx.tradesRepo.getStatsByStrategy(strategy.id);
        return {
          ...strategy,
          trades,
          stats,
          liveStats: {
            totalTrades: trades.length,
            openTrades: trades.filter(t => t.status === "open").length,
            closedTrades: trades.filter(t => t.status === "closed").length,
            realizedPnL: trades
              .filter(t => t.status === "closed")
              .reduce((sum, t) => sum + (t.pnlSol ?? 0), 0),
          },
        };
      })
    );

    return strategiesWithTrades;
  });
};

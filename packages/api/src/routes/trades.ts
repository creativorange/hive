import type { FastifyInstance, FastifyPluginAsync } from "fastify";

export const registerTradesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get("/trades", async (request, reply) => {
    const trades = await fastify.ctx.tradesRepo.getRecentTrades(100);
    return trades;
  });

  fastify.get("/trades/live", async (request, reply) => {
    const openTrades = await fastify.ctx.tradesRepo.findOpen();
    const positions = fastify.ctx.tradingEngine.getPositions();

    return {
      trades: openTrades,
      positions,
    };
  });

  fastify.get<{ Params: { strategyId: string } }>("/trades/:strategyId", async (request, reply) => {
    const { strategyId } = request.params;
    const trades = await fastify.ctx.tradesRepo.findByStrategy(strategyId);
    return trades;
  });

  fastify.get("/trades/stats", async (request, reply) => {
    const stats = await fastify.ctx.tradesRepo.getStats();
    return stats;
  });

  fastify.get("/trades/recent-closed", async (request, reply) => {
    const trades = await fastify.ctx.tradesRepo.getRecentClosedTrades(50);
    return trades;
  });
};

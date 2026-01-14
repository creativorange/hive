import type { FastifyInstance, FastifyPluginAsync } from "fastify";

export const registerTreasuryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get("/treasury", async (request, reply) => {
    const treasury = await fastify.ctx.treasuryRepo.get();

    if (!treasury) {
      return {
        totalSol: 0,
        lockedInPositions: 0,
        availableToTrade: 0,
        totalPnL: 0,
        reservePercent: 0.1,
        maxAllocationPerStrategy: 0.5,
      };
    }

    return {
      ...treasury,
      totalPnL: treasury.totalPnl,
    };
  });

  fastify.get("/treasury/stats", async (request, reply) => {
    const treasury = await fastify.ctx.treasuryRepo.get();
    const tradeStats = await fastify.ctx.tradesRepo.getStats();
    const activeStrategies = await fastify.ctx.strategiesRepo.countByStatus("active");

    return {
      treasury: treasury ? {
        ...treasury,
        totalPnL: treasury.totalPnl,
      } : {
        totalSol: 0,
        lockedInPositions: 0,
        availableToTrade: 0,
        totalPnL: 0,
      },
      trades: tradeStats,
      activeStrategies,
    };
  });

  fastify.post<{ Body: { amount: number } }>("/treasury/add-funds", async (request, reply) => {
    const { amount } = request.body;

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: "Invalid amount" });
    }

    const updated = await fastify.ctx.treasuryRepo.addFunds(amount);

    if (!updated) {
      const treasury = await fastify.ctx.treasuryRepo.initialize({
        totalSol: amount,
        availableToTrade: amount,
        lockedInPositions: 0,
        totalPnl: 0,
        reservePercent: 0.1,
        maxAllocationPerStrategy: 0.5,
      });
      return treasury;
    }

    return updated;
  });
};

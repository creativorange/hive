import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { trades, evolutionCycles } from "@meta/database";

export const registerTradingRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get("/trading/status", async () => {
    return fastify.ctx.tradingSimulator.getStatus();
  });

  fastify.get("/trading/simulator", async () => {
    return fastify.ctx.tradingSimulator.getStatus();
  });

  fastify.post<{ Body: { paperMode: boolean } }>("/trading/mode", async (request, reply) => {
    const { paperMode } = request.body;

    if (typeof paperMode !== "boolean") {
      return reply.status(400).send({
        success: false,
        message: "paperMode must be a boolean",
      });
    }

    const result = fastify.ctx.tradingEngine.setTradingMode(paperMode);
    
    if (!result.success) {
      return reply.status(409).send(result);
    }

    return result;
  });

  fastify.post("/trading/start", async () => {
    await fastify.ctx.tradingSimulator.start();
    return {
      success: true,
      message: "Trading simulator started",
      status: fastify.ctx.tradingSimulator.getStatus(),
    };
  });

  fastify.post("/trading/stop", async () => {
    await fastify.ctx.tradingSimulator.stop();
    return {
      success: true,
      message: "Trading simulator stopped",
      status: fastify.ctx.tradingSimulator.getStatus(),
    };
  });

  fastify.post("/trading/refresh-strategies", async () => {
    await fastify.ctx.tradingSimulator.refreshStrategies();
    return {
      success: true,
      message: "Strategies refreshed",
      status: fastify.ctx.tradingSimulator.getStatus(),
    };
  });

  fastify.get("/trading/stats", async () => {
    return fastify.ctx.tradingEngine.getStats();
  });

  fastify.get("/trading/positions", async () => {
    return fastify.ctx.tradingSimulator.getPositions();
  });

  fastify.post("/trading/reset", async (request, reply) => {
    const WALLET_ALLOCATION_PER_AGENT = 3;

    try {
      // Stop the simulator first
      await fastify.ctx.tradingSimulator.stop();

      // Get all strategies
      const allStrategies = await fastify.ctx.strategiesRepo.findAll();
      const activeStrategies = await fastify.ctx.strategiesRepo.findActive();

      // Delete all trades
      const tradesDeleted = await fastify.ctx.tradesRepo.getStats();
      await fastify.ctx.db.db.delete(trades);

      // Delete evolution cycles  
      await fastify.ctx.db.db.delete(evolutionCycles);

      // Reset treasury
      const totalSol = activeStrategies.length * WALLET_ALLOCATION_PER_AGENT;
      await fastify.ctx.treasuryRepo.reset(totalSol);
      await fastify.ctx.treasuryRepo.update({
        maxAllocationPerStrategy: WALLET_ALLOCATION_PER_AGENT,
        reservePercent: 0.05,
      });

      // Reset all strategy performances
      for (const strategy of allStrategies) {
        await fastify.ctx.strategiesRepo.updatePerformance(strategy.id, {
          tradesExecuted: 0,
          winRate: 0,
          totalPnL: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          avgHoldTime: 0,
          fitnessScore: 50,
        });
      }

      // Restart simulator
      await fastify.ctx.tradingSimulator.initialize();

      return {
        success: true,
        message: "Trading reset complete",
        stats: {
          tradesDeleted: tradesDeleted.totalTrades,
          strategiesReset: allStrategies.length,
          activeStrategies: activeStrategies.length,
          newTreasury: totalSol,
          walletPerAgent: WALLET_ALLOCATION_PER_AGENT,
        },
      };
    } catch (error) {
      console.error("[Trading] Reset failed:", error);
      return reply.status(500).send({
        success: false,
        message: `Reset failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  });
};

import type { FastifyInstance, FastifyPluginAsync } from "fastify";

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
};

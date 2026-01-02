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
    
    // Get open positions from trading engine
    const allPositions = fastify.ctx.tradingEngine.getPositions();
    const positions = allPositions.filter(p => p.strategyId === id);
    
    // Get wallet allocation from trading simulator
    const treasury = await fastify.ctx.treasuryRepo.get();
    const activeStrategies = await fastify.ctx.strategiesRepo.countByStatus("active");
    const totalAvailable = treasury?.totalSol ?? 0;
    const reserveAmount = totalAvailable * (treasury?.reservePercent ?? 0.1);
    const tradableSol = totalAvailable - reserveAmount;
    const walletAllocation = activeStrategies > 0 
      ? Math.min(tradableSol / activeStrategies, treasury?.maxAllocationPerStrategy ?? 3)
      : 0;
    
    // Calculate wallet stats
    const openTrades = trades.filter(t => t.status === "open");
    const closedTrades = trades.filter(t => t.status === "closed");
    const lockedInPositions = openTrades.reduce((sum, t) => sum + (t.amountSol ?? 0), 0);
    const realizedPnL = closedTrades.reduce((sum, t) => sum + (t.pnlSol ?? 0), 0);
    const unrealizedPnL = positions.reduce((sum, p) => sum + (p.unrealizedPnL ?? 0), 0);
    
    // Sort closed trades by PnL descending for top performers
    const topTrades = [...closedTrades]
      .sort((a, b) => (b.pnlSol ?? 0) - (a.pnlSol ?? 0))
      .slice(0, 20);

    return {
      ...strategy,
      trades,
      topTrades,
      openTrades,
      positions,
      stats,
      wallet: {
        allocation: walletAllocation,
        locked: lockedInPositions,
        available: walletAllocation - lockedInPositions,
        realizedPnL,
        unrealizedPnL,
        totalPnL: realizedPnL + unrealizedPnL,
      },
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

  fastify.get("/strategies/needs-funding", async (request, reply) => {
    const strategies = await fastify.ctx.strategiesRepo.findNeedsFunding();
    return strategies;
  });

  fastify.post<{ Params: { id: string }; Body: { amount: number } }>(
    "/strategies/:id/fund",
    async (request, reply) => {
      const { id } = request.params;
      const { amount } = request.body;

      if (!amount || amount <= 0) {
        return reply.status(400).send({ error: "Invalid funding amount" });
      }

      const strategy = await fastify.ctx.strategiesRepo.findById(id);
      if (!strategy) {
        return reply.status(404).send({ error: "Strategy not found" });
      }

      const treasury = await fastify.ctx.treasuryRepo.get();
      if (!treasury || treasury.availableToTrade < amount) {
        return reply.status(400).send({ 
          error: "Insufficient treasury funds",
          available: treasury?.availableToTrade ?? 0,
          requested: amount,
        });
      }

      // Fund through the trading engine (updates in-memory allocation)
      fastify.ctx.tradingEngine.fundStrategy(id, amount);

      // Update treasury in database
      await fastify.ctx.treasuryRepo.update({
        totalSol: treasury.totalSol,
        availableToTrade: treasury.availableToTrade - amount,
        lockedInPositions: treasury.lockedInPositions,
        totalPnl: treasury.totalPnl,
      });

      // Reactivate strategy if it was needs_funding
      if (strategy.status === "needs_funding") {
        await fastify.ctx.strategiesRepo.reactivate(id);
      }

      fastify.ctx.wsHandler.broadcast("strategy:funded", {
        strategyId: id,
        amount,
        timestamp: Date.now(),
      });

      return {
        success: true,
        strategyId: id,
        fundedAmount: amount,
        newStatus: "active",
      };
    }
  );
};

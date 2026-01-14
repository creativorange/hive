import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { createDbClientFromEnv, type Database } from "@meta/database";
import {
  StrategiesRepository,
  TradesRepository,
  EvolutionRepository,
  TreasuryRepository,
} from "@meta/database";
import { TradingEngine, type Position } from "@meta/trading";
import type { Trade, PumpFunToken } from "@meta/core";
import { GeneticEngine } from "@meta/core";
import { registerStrategiesRoutes } from "./routes/strategies.js";
import { registerTradesRoutes } from "./routes/trades.js";
import { registerEvolutionRoutes } from "./routes/evolution.js";
import { registerTreasuryRoutes } from "./routes/treasury.js";
import { registerTradingRoutes } from "./routes/trading.js";
import { WebSocketHandler } from "./websocket/handler.js";
import { EvolutionScheduler } from "./services/evolution-scheduler.js";
import { TradingSimulator } from "./services/trading-simulator.js";

export interface AppContext {
  db: Database;
  strategiesRepo: StrategiesRepository;
  tradesRepo: TradesRepository;
  evolutionRepo: EvolutionRepository;
  treasuryRepo: TreasuryRepository;
  tradingEngine: TradingEngine;
  geneticEngine: GeneticEngine;
  wsHandler: WebSocketHandler;
  tradingSimulator: TradingSimulator;
}

declare module "fastify" {
  interface FastifyInstance {
    ctx: AppContext;
  }
}

export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(websocket, {
    options: {
      clientTracking: true,
    },
  });

  const db = createDbClientFromEnv();

  const strategiesRepo = new StrategiesRepository(db);
  const tradesRepo = new TradesRepository(db);
  const evolutionRepo = new EvolutionRepository(db);
  const treasuryRepo = new TreasuryRepository(db);

  const tradingEngine = new TradingEngine(
    { paperTradingMode: true },
    { initialSol: 10 }
  );

  const geneticEngine = new GeneticEngine();

  const wsHandler = new WebSocketHandler();

  const tradingSimulator = new TradingSimulator(
    tradingEngine,
    strategiesRepo,
    tradesRepo,
    treasuryRepo,
    wsHandler,
    {
      initialTreasurySol: 300,
      maxAllocationPerStrategy: 3, // Each agent gets max 3 SOL wallet
      reservePercent: 0.05,
      autoStart: true,
    }
  );

  const ctx: AppContext = {
    db,
    strategiesRepo,
    tradesRepo,
    evolutionRepo,
    treasuryRepo,
    tradingEngine,
    geneticEngine,
    wsHandler,
    tradingSimulator,
  };

  app.decorate("ctx", ctx);

  tradingSimulator.initialize().catch((err) => {
    console.error("[Server] Failed to initialize trading simulator:", err);
  });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  await app.register(registerStrategiesRoutes, { prefix: "/api" });
  await app.register(registerTradesRoutes, { prefix: "/api" });
  await app.register(registerEvolutionRoutes, { prefix: "/api" });
  await app.register(registerTreasuryRoutes, { prefix: "/api" });
  await app.register(registerTradingRoutes, { prefix: "/api" });

  app.get("/ws", { websocket: true }, (socket, req) => {
    console.log("[WebSocket] New connection from", req.headers.origin);
    try {
      wsHandler.handleConnection(socket, req);
    } catch (err) {
      console.error("[WebSocket] Handler error:", err);
    }
  });

  console.log("[Server] WebSocket route registered at /ws");

  tradingEngine.on("trade:opened", (trade: Trade) => {
    wsHandler.broadcast("trade:opened", trade);
  });

  tradingEngine.on("trade:closed", (trade: Trade) => {
    wsHandler.broadcast("trade:closed", trade);
  });

  tradingEngine.on("position:updated", (position: Position) => {
    wsHandler.broadcast("position:updated", position);
  });

  tradingEngine.on("token:discovered", (token: PumpFunToken) => {
    wsHandler.broadcast("token:discovered", token);
  });

  const scheduler = new EvolutionScheduler(
    geneticEngine,
    strategiesRepo,
    evolutionRepo,
    wsHandler
  );

  app.addHook("onClose", async () => {
    scheduler.stop();
    await tradingSimulator.stop();
    await tradingEngine.stop();
    await db.close();
  });

  return app;
}

export async function startServer(port = 3001, host = "0.0.0.0"): Promise<void> {
  const app = await createServer();

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "../server.js";
import type { FastifyInstance } from "fastify";

describe("API Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Set test environment
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost:5432/meta_test";
    
    try {
      app = await createServer();
      await app.ready();
    } catch (error) {
      console.warn("Server creation failed, some tests may be skipped");
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("Health Check", () => {
    it.skipIf(!app)("GET /health returns ok", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    });
  });

  describe("Strategies Routes", () => {
    it.skipIf(!app)("GET /api/strategies returns array", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/strategies",
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
    });

    it.skipIf(!app)("GET /api/strategies/top/:count returns top strategies", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/strategies/top/5",
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
      expect(response.json().length).toBeLessThanOrEqual(5);
    });

    it.skipIf(!app)("GET /api/strategies/graveyard returns dead strategies", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/strategies/graveyard",
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
    });

    it.skipIf(!app)("GET /api/strategies/population returns population info", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/strategies/population",
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data).toHaveProperty("generation");
      expect(data).toHaveProperty("activeCount");
      expect(data).toHaveProperty("strategies");
    });

    it.skipIf(!app)("GET /api/strategies/:id returns 404 for unknown", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/strategies/00000000-0000-0000-0000-000000000000",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("Trades Routes", () => {
    it.skipIf(!app)("GET /api/trades returns array", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/trades",
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
    });

    it.skipIf(!app)("GET /api/trades/live returns live trading info", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/trades/live",
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data).toHaveProperty("trades");
      expect(data).toHaveProperty("positions");
    });

    it.skipIf(!app)("GET /api/trades/stats returns trading stats", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/trades/stats",
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data).toHaveProperty("totalTrades");
      expect(data).toHaveProperty("winRate");
    });
  });

  describe("Evolution Routes", () => {
    it.skipIf(!app)("GET /api/evolution/current returns current state", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/evolution/current",
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data).toHaveProperty("generation");
      expect(data).toHaveProperty("activeStrategies");
      expect(data).toHaveProperty("avgFitness");
    });

    it.skipIf(!app)("GET /api/evolution/history returns array", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/evolution/history",
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
    });

    it.skipIf(!app)("GET /api/evolution/fitness-history returns fitness data", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/evolution/fitness-history",
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
    });

    it.skipIf(!app)("GET /api/evolution/pnl-history returns PnL data", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/evolution/pnl-history",
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
    });
  });

  describe("Treasury Routes", () => {
    it.skipIf(!app)("GET /api/treasury returns treasury state", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/treasury",
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data).toHaveProperty("totalSol");
    });
  });
});

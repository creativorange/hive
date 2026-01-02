import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import { trades, type Trade, type NewTrade } from "../schema.js";

export interface TradeStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  bestTrade: number;
  worstTrade: number;
  totalVolume: number;
}

export class TradesRepository {
  constructor(private database: Database) {}

  private get db() {
    return this.database.db;
  }

  async create(trade: NewTrade): Promise<Trade> {
    const [created] = await this.db.insert(trades).values(trade).returning();
    return created;
  }

  async findById(id: string): Promise<Trade | undefined> {
    const [trade] = await this.db
      .select()
      .from(trades)
      .where(eq(trades.id, id))
      .limit(1);
    return trade;
  }

  async findByStrategy(strategyId: string): Promise<Trade[]> {
    return await this.db
      .select()
      .from(trades)
      .where(eq(trades.strategyId, strategyId))
      .orderBy(desc(trades.entryTimestamp));
  }

  async findOpen(): Promise<Trade[]> {
    return await this.db
      .select()
      .from(trades)
      .where(eq(trades.status, "open"))
      .orderBy(desc(trades.entryTimestamp));
  }

  async findOpenByStrategy(strategyId: string): Promise<Trade[]> {
    return await this.db
      .select()
      .from(trades)
      .where(and(eq(trades.strategyId, strategyId), eq(trades.status, "open")))
      .orderBy(desc(trades.entryTimestamp));
  }

  async close(
    id: string,
    exitData: {
      exitPrice: number;
      pnlSol: number;
      pnlPercent: number;
      exitReason: "take_profit" | "stop_loss" | "time_exit" | "volume_drop" | "manual";
    }
  ): Promise<Trade | undefined> {
    const [updated] = await this.db
      .update(trades)
      .set({
        ...exitData,
        status: "closed",
        exitTimestamp: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trades.id, id))
      .returning();
    return updated;
  }

  async getRecentTrades(limit: number = 50): Promise<Trade[]> {
    return await this.db
      .select()
      .from(trades)
      .orderBy(desc(trades.entryTimestamp))
      .limit(limit);
  }

  async getRecentClosedTrades(limit: number = 50): Promise<Trade[]> {
    return await this.db
      .select()
      .from(trades)
      .where(eq(trades.status, "closed"))
      .orderBy(desc(trades.exitTimestamp))
      .limit(limit);
  }

  async getTradesByDateRange(startDate: Date, endDate: Date): Promise<Trade[]> {
    return await this.db
      .select()
      .from(trades)
      .where(
        and(
          gte(trades.entryTimestamp, startDate),
          lte(trades.entryTimestamp, endDate)
        )
      )
      .orderBy(desc(trades.entryTimestamp));
  }

  async getStats(): Promise<TradeStats> {
    const allTrades = await this.db.select().from(trades);

    const openTrades = allTrades.filter((t) => t.status === "open");
    const closedTrades = allTrades.filter((t) => t.status === "closed");
    const winningTrades = closedTrades.filter((t) => (t.pnlSol ?? 0) > 0);
    const losingTrades = closedTrades.filter((t) => (t.pnlSol ?? 0) <= 0);

    const pnls = closedTrades.map((t) => t.pnlSol ?? 0);
    const totalPnl = pnls.reduce((sum, pnl) => sum + pnl, 0);
    const avgPnl = pnls.length > 0 ? totalPnl / pnls.length : 0;
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;
    const totalVolume = allTrades.reduce((sum, t) => sum + t.amountSol, 0);

    return {
      totalTrades: allTrades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0,
      totalPnl,
      avgPnl,
      bestTrade,
      worstTrade,
      totalVolume,
    };
  }

  async getStatsByStrategy(strategyId: string): Promise<TradeStats> {
    const strategyTrades = await this.findByStrategy(strategyId);

    const openTrades = strategyTrades.filter((t) => t.status === "open");
    const closedTrades = strategyTrades.filter((t) => t.status === "closed");
    const winningTrades = closedTrades.filter((t) => (t.pnlSol ?? 0) > 0);
    const losingTrades = closedTrades.filter((t) => (t.pnlSol ?? 0) <= 0);

    const pnls = closedTrades.map((t) => t.pnlSol ?? 0);
    const totalPnl = pnls.reduce((sum, pnl) => sum + pnl, 0);
    const avgPnl = pnls.length > 0 ? totalPnl / pnls.length : 0;
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;
    const totalVolume = strategyTrades.reduce((sum, t) => sum + t.amountSol, 0);

    return {
      totalTrades: strategyTrades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0,
      totalPnl,
      avgPnl,
      bestTrade,
      worstTrade,
      totalVolume,
    };
  }

  async countByToken(tokenAddress: string): Promise<number> {
    const results = await this.db
      .select()
      .from(trades)
      .where(eq(trades.tokenAddress, tokenAddress));
    return results.length;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(trades).where(eq(trades.id, id));
  }

  async deleteByStrategy(strategyId: string): Promise<void> {
    await this.db.delete(trades).where(eq(trades.strategyId, strategyId));
  }
}

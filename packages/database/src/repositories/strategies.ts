import { eq, desc, and, inArray } from "drizzle-orm";
import type { Database } from "../client.js";
import { strategies, type Strategy, type NewStrategy } from "../schema.js";
import type { StrategyGenes, StrategyPerformance, StrategyStatus, StrategyArchetype } from "@meta/core";

export class StrategiesRepository {
  constructor(private database: Database) {}

  private get db() {
    return this.database.db;
  }

  async create(strategy: NewStrategy): Promise<Strategy> {
    const [created] = await this.db.insert(strategies).values(strategy).returning();
    return created;
  }

  async createMany(newStrategies: NewStrategy[]): Promise<Strategy[]> {
    if (newStrategies.length === 0) return [];
    return await this.db.insert(strategies).values(newStrategies).returning();
  }

  async findById(id: string): Promise<Strategy | undefined> {
    const [strategy] = await this.db
      .select()
      .from(strategies)
      .where(eq(strategies.id, id))
      .limit(1);
    return strategy;
  }

  async findAll(): Promise<Strategy[]> {
    return await this.db.select().from(strategies).orderBy(desc(strategies.createdAt));
  }

  async findActive(): Promise<Strategy[]> {
    return await this.db
      .select()
      .from(strategies)
      .where(eq(strategies.status, "active"))
      .orderBy(desc(strategies.createdAt));
  }

  async findByGeneration(generation: number): Promise<Strategy[]> {
    return await this.db
      .select()
      .from(strategies)
      .where(eq(strategies.generation, generation))
      .orderBy(desc(strategies.createdAt));
  }

  async findByIds(ids: string[]): Promise<Strategy[]> {
    if (ids.length === 0) return [];
    return await this.db
      .select()
      .from(strategies)
      .where(inArray(strategies.id, ids));
  }

  async update(
    id: string,
    data: Partial<{
      genes: StrategyGenes;
      performance: StrategyPerformance;
      status: StrategyStatus;
      name: string;
      archetype: StrategyArchetype;
      deathTimestamp: Date;
    }>
  ): Promise<Strategy | undefined> {
    const [updated] = await this.db
      .update(strategies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(strategies.id, id))
      .returning();
    return updated;
  }

  async updatePerformance(
    id: string,
    performance: StrategyPerformance
  ): Promise<Strategy | undefined> {
    return this.update(id, { performance });
  }

  async markDead(id: string): Promise<Strategy | undefined> {
    return this.update(id, {
      status: "dead",
      deathTimestamp: new Date(),
    });
  }

  async markNeedsFunding(id: string): Promise<Strategy | undefined> {
    return this.update(id, { status: "needs_funding" });
  }

  async reactivate(id: string): Promise<Strategy | undefined> {
    return this.update(id, { status: "active" });
  }

  async findNeedsFunding(): Promise<Strategy[]> {
    return await this.db
      .select()
      .from(strategies)
      .where(eq(strategies.status, "needs_funding"))
      .orderBy(desc(strategies.updatedAt));
  }

  async markDeadMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(strategies)
      .set({
        status: "dead",
        deathTimestamp: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(strategies.id, ids));
  }

  async getTopPerformers(limit: number = 10): Promise<Strategy[]> {
    const allActive = await this.findActive();
    return allActive
      .sort((a, b) => {
        const aScore = (a.performance as StrategyPerformance).fitnessScore;
        const bScore = (b.performance as StrategyPerformance).fitnessScore;
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  async getGraveyard(limit: number = 50): Promise<Strategy[]> {
    return await this.db
      .select()
      .from(strategies)
      .where(eq(strategies.status, "dead"))
      .orderBy(desc(strategies.deathTimestamp))
      .limit(limit);
  }

  async countByStatus(status: StrategyStatus): Promise<number> {
    const results = await this.db
      .select()
      .from(strategies)
      .where(eq(strategies.status, status));
    return results.length;
  }

  async countByGeneration(generation: number): Promise<number> {
    const results = await this.db
      .select()
      .from(strategies)
      .where(eq(strategies.generation, generation));
    return results.length;
  }

  async getLatestGeneration(): Promise<number> {
    const [result] = await this.db
      .select({ generation: strategies.generation })
      .from(strategies)
      .orderBy(desc(strategies.generation))
      .limit(1);
    return result?.generation ?? 0;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(strategies).where(eq(strategies.id, id));
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(strategies);
  }
}

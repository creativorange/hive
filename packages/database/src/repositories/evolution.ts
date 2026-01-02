import { eq, desc, asc } from "drizzle-orm";
import type { Database } from "../client.js";
import {
  evolutionCycles,
  type EvolutionCycle,
  type NewEvolutionCycle,
} from "../schema.js";

export class EvolutionRepository {
  constructor(private database: Database) {}

  private get db() {
    return this.database.db;
  }

  async createCycle(cycle: NewEvolutionCycle): Promise<EvolutionCycle> {
    const [created] = await this.db
      .insert(evolutionCycles)
      .values(cycle)
      .returning();
    return created;
  }

  async findByGeneration(generation: number): Promise<EvolutionCycle | undefined> {
    const [cycle] = await this.db
      .select()
      .from(evolutionCycles)
      .where(eq(evolutionCycles.generation, generation))
      .limit(1);
    return cycle;
  }

  async findById(id: string): Promise<EvolutionCycle | undefined> {
    const [cycle] = await this.db
      .select()
      .from(evolutionCycles)
      .where(eq(evolutionCycles.id, id))
      .limit(1);
    return cycle;
  }

  async getLatest(): Promise<EvolutionCycle | undefined> {
    const [cycle] = await this.db
      .select()
      .from(evolutionCycles)
      .orderBy(desc(evolutionCycles.generation))
      .limit(1);
    return cycle;
  }

  async getHistory(limit: number = 50): Promise<EvolutionCycle[]> {
    return await this.db
      .select()
      .from(evolutionCycles)
      .orderBy(desc(evolutionCycles.generation))
      .limit(limit);
  }

  async getAll(): Promise<EvolutionCycle[]> {
    return await this.db
      .select()
      .from(evolutionCycles)
      .orderBy(asc(evolutionCycles.generation));
  }

  async getLatestGeneration(): Promise<number> {
    const latest = await this.getLatest();
    return latest?.generation ?? 0;
  }

  async getAverageFitnessHistory(limit: number = 50): Promise<
    { generation: number; avgFitness: number; bestFitness: number }[]
  > {
    const cycles = await this.db
      .select({
        generation: evolutionCycles.generation,
        avgFitness: evolutionCycles.avgFitness,
        bestFitness: evolutionCycles.bestFitness,
      })
      .from(evolutionCycles)
      .orderBy(asc(evolutionCycles.generation))
      .limit(limit);
    return cycles;
  }

  async getTotalPnlHistory(limit: number = 50): Promise<
    { generation: number; totalPnlSol: number }[]
  > {
    const cycles = await this.db
      .select({
        generation: evolutionCycles.generation,
        totalPnlSol: evolutionCycles.totalPnlSol,
      })
      .from(evolutionCycles)
      .orderBy(asc(evolutionCycles.generation))
      .limit(limit);
    return cycles;
  }

  async getDeathCount(): Promise<number> {
    const cycles = await this.getAll();
    return cycles.reduce((sum, cycle) => sum + cycle.dead.length, 0);
  }

  async getBirthCount(): Promise<number> {
    const cycles = await this.getAll();
    return cycles.reduce((sum, cycle) => sum + cycle.newlyBorn.length, 0);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(evolutionCycles).where(eq(evolutionCycles.id, id));
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(evolutionCycles);
  }
}

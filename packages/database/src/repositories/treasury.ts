import { eq, desc } from "drizzle-orm";
import type { Database } from "../client.js";
import { treasury, type Treasury, type NewTreasury } from "../schema.js";

export class TreasuryRepository {
  constructor(private database: Database) {}

  private get db() {
    return this.database.db;
  }

  async initialize(config: NewTreasury): Promise<Treasury> {
    const existing = await this.get();
    if (existing) {
      return existing;
    }
    const [created] = await this.db.insert(treasury).values(config).returning();
    return created;
  }

  async get(): Promise<Treasury | undefined> {
    const [record] = await this.db
      .select()
      .from(treasury)
      .limit(1);
    return record;
  }

  async update(data: Partial<{
    totalSol: number;
    lockedInPositions: number;
    availableToTrade: number;
    totalPnl: number;
    reservePercent: number;
    maxAllocationPerStrategy: number;
  }>): Promise<Treasury | undefined> {
    const existing = await this.get();
    if (!existing) return undefined;

    const [updated] = await this.db
      .update(treasury)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(treasury.id, existing.id))
      .returning();
    return updated;
  }

  async addFunds(amount: number): Promise<Treasury | undefined> {
    const existing = await this.get();
    if (!existing) return undefined;

    return this.update({
      totalSol: existing.totalSol + amount,
      availableToTrade: existing.availableToTrade + amount,
    });
  }

  async withdrawFunds(amount: number): Promise<Treasury | undefined> {
    const existing = await this.get();
    if (!existing) return undefined;

    if (amount > existing.availableToTrade) {
      throw new Error("Insufficient available funds");
    }

    return this.update({
      totalSol: existing.totalSol - amount,
      availableToTrade: existing.availableToTrade - amount,
    });
  }

  async lockFunds(amount: number): Promise<Treasury | undefined> {
    const existing = await this.get();
    if (!existing) return undefined;

    if (amount > existing.availableToTrade) {
      throw new Error("Insufficient available funds to lock");
    }

    return this.update({
      lockedInPositions: existing.lockedInPositions + amount,
      availableToTrade: existing.availableToTrade - amount,
    });
  }

  async unlockFunds(amount: number): Promise<Treasury | undefined> {
    const existing = await this.get();
    if (!existing) return undefined;

    return this.update({
      lockedInPositions: Math.max(0, existing.lockedInPositions - amount),
      availableToTrade: existing.availableToTrade + amount,
    });
  }

  async recordPnl(pnlAmount: number): Promise<Treasury | undefined> {
    const existing = await this.get();
    if (!existing) return undefined;

    return this.update({
      totalPnl: existing.totalPnl + pnlAmount,
      totalSol: existing.totalSol + pnlAmount,
      availableToTrade: existing.availableToTrade + pnlAmount,
    });
  }

  async reset(initialSol: number = 10): Promise<Treasury> {
    await this.db.delete(treasury);
    return this.initialize({
      totalSol: initialSol,
      lockedInPositions: 0,
      availableToTrade: initialSol,
      totalPnl: 0,
      reservePercent: 0.1,
      maxAllocationPerStrategy: 0.5,
    });
  }
}

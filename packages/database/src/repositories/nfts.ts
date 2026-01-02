import { eq, desc } from "drizzle-orm";
import type { Database } from "../client.js";
import { strategyNfts, type StrategyNft, type NewStrategyNft } from "../schema.js";

export class NftsRepository {
  constructor(private database: Database) {}

  private get db() {
    return this.database.db;
  }

  async create(nft: NewStrategyNft): Promise<StrategyNft> {
    const [created] = await this.db
      .insert(strategyNfts)
      .values(nft)
      .returning();
    return created;
  }

  async findByMint(nftMint: string): Promise<StrategyNft | undefined> {
    const [nft] = await this.db
      .select()
      .from(strategyNfts)
      .where(eq(strategyNfts.nftMint, nftMint))
      .limit(1);
    return nft;
  }

  async findById(id: string): Promise<StrategyNft | undefined> {
    const [nft] = await this.db
      .select()
      .from(strategyNfts)
      .where(eq(strategyNfts.id, id))
      .limit(1);
    return nft;
  }

  async findByStrategy(strategyId: string): Promise<StrategyNft | undefined> {
    const [nft] = await this.db
      .select()
      .from(strategyNfts)
      .where(eq(strategyNfts.strategyId, strategyId))
      .limit(1);
    return nft;
  }

  async findByOwner(ownerWallet: string): Promise<StrategyNft[]> {
    return await this.db
      .select()
      .from(strategyNfts)
      .where(eq(strategyNfts.ownerWallet, ownerWallet))
      .orderBy(desc(strategyNfts.mintTimestamp));
  }

  async getAll(): Promise<StrategyNft[]> {
    return await this.db
      .select()
      .from(strategyNfts)
      .orderBy(desc(strategyNfts.mintTimestamp));
  }

  async getRecent(limit: number = 20): Promise<StrategyNft[]> {
    return await this.db
      .select()
      .from(strategyNfts)
      .orderBy(desc(strategyNfts.mintTimestamp))
      .limit(limit);
  }

  async countByOwner(ownerWallet: string): Promise<number> {
    const results = await this.findByOwner(ownerWallet);
    return results.length;
  }

  async getTotalMinted(): Promise<number> {
    const all = await this.getAll();
    return all.length;
  }

  async updateOwner(nftMint: string, newOwner: string): Promise<StrategyNft | undefined> {
    const [updated] = await this.db
      .update(strategyNfts)
      .set({ ownerWallet: newOwner })
      .where(eq(strategyNfts.nftMint, nftMint))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(strategyNfts).where(eq(strategyNfts.id, id));
  }
}

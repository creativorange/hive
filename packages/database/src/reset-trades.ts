import { createDbClientFromEnv } from "./client.js";
import { trades, evolutionCycles, treasury, strategies } from "./schema.js";
import { eq } from "drizzle-orm";

const WALLET_ALLOCATION_PER_AGENT = 3; // 3 SOL per agent

async function resetTrades() {
  console.log("🔄 Resetting trades and wallets...");

  const { db, client } = createDbClientFromEnv();

  try {
    // Count strategies first
    const allStrategies = await db.select().from(strategies);
    const activeStrategies = allStrategies.filter(s => s.status === "active");
    console.log(`Found ${allStrategies.length} total strategies (${activeStrategies.length} active)`);

    // Delete all trades
    console.log("Deleting all trades...");
    await db.delete(trades);

    // Delete evolution cycles
    console.log("Deleting evolution cycles...");
    await db.delete(evolutionCycles);

    // Reset treasury with 3 SOL per active agent
    console.log("Resetting treasury...");
    await db.delete(treasury);
    
    const totalSol = activeStrategies.length * WALLET_ALLOCATION_PER_AGENT;
    console.log(`Allocating ${totalSol} SOL total (${WALLET_ALLOCATION_PER_AGENT} SOL × ${activeStrategies.length} agents)`);
    
    await db.insert(treasury).values({
      totalSol,
      lockedInPositions: 0,
      availableToTrade: totalSol,
      totalPnl: 0,
      reservePercent: 0.05,
      maxAllocationPerStrategy: WALLET_ALLOCATION_PER_AGENT,
    });

    // Reset strategy performance
    console.log("Resetting strategy performance...");
    for (const strategy of allStrategies) {
      await db.update(strategies)
        .set({
          performance: {
            tradesExecuted: 0,
            winRate: 0,
            totalPnL: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            avgHoldTime: 0,
            fitnessScore: 50, // Reset to default
          },
          updatedAt: new Date(),
        })
        .where(eq(strategies.id, strategy.id));
    }

    console.log("✅ Reset complete!");
    console.log(`   - Deleted all trades`);
    console.log(`   - Deleted evolution cycles`);
    console.log(`   - Reset treasury to ${totalSol} SOL`);
    console.log(`   - Reset ${allStrategies.length} strategy performances`);
    console.log(`   - Each agent now has ${WALLET_ALLOCATION_PER_AGENT} SOL wallet`);
  } catch (error) {
    console.error("❌ Failed to reset:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetTrades();

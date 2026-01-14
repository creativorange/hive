import { createDbClientFromEnv } from "./client.js";
import { trades, evolutionCycles, treasury, strategies } from "./schema.js";
import { eq, ne } from "drizzle-orm";

const WALLET_ALLOCATION_PER_AGENT = 3; // 3 SOL per agent

async function resetAll() {
  console.log("🔥 FULL RESET - Clearing everything...");

  const { db, client } = createDbClientFromEnv();

  try {
    // Delete all trades
    console.log("Deleting all trades...");
    const deletedTrades = await db.delete(trades);
    console.log("  ✓ All trades deleted");

    // Delete evolution cycles
    console.log("Deleting evolution cycles...");
    await db.delete(evolutionCycles);
    console.log("  ✓ All evolution cycles deleted");

    // Delete dead strategies (graveyard)
    console.log("Deleting dead strategies (graveyard)...");
    await db.delete(strategies).where(ne(strategies.status, "active"));
    console.log("  ✓ Graveyard cleared");

    // Get remaining active strategies
    const activeStrategies = await db.select().from(strategies);
    console.log(`Found ${activeStrategies.length} active strategies`);

    // Reset all strategy performances
    console.log("Resetting strategy performances...");
    for (const strategy of activeStrategies) {
      await db.update(strategies)
        .set({
          performance: {
            tradesExecuted: 0,
            winRate: 0,
            totalPnL: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            avgHoldTime: 0,
            fitnessScore: 50,
          },
          generation: 1, // Reset to gen 1
          updatedAt: new Date(),
        })
        .where(eq(strategies.id, strategy.id));
    }
    console.log("  ✓ All strategy performances reset");

    // Reset treasury
    console.log("Resetting treasury...");
    await db.delete(treasury);
    
    const totalSol = activeStrategies.length * WALLET_ALLOCATION_PER_AGENT;
    
    await db.insert(treasury).values({
      totalSol,
      lockedInPositions: 0,
      availableToTrade: totalSol,
      totalPnl: 0,
      reservePercent: 0.05,
      maxAllocationPerStrategy: WALLET_ALLOCATION_PER_AGENT,
    });
    console.log(`  ✓ Treasury reset to ${totalSol} SOL`);

    console.log("\n✅ FULL RESET COMPLETE!");
    console.log("═══════════════════════════════════════");
    console.log(`   Treasury: ${totalSol} SOL`);
    console.log(`   Active agents: ${activeStrategies.length}`);
    console.log(`   Allocation per agent: ${WALLET_ALLOCATION_PER_AGENT} SOL`);
    console.log(`   All trades: DELETED`);
    console.log(`   Evolution cycles: DELETED`);
    console.log(`   Graveyard: CLEARED`);
    console.log(`   Win rates: RESET to 0%`);
    console.log(`   PnL: RESET to 0`);
    console.log(`   Fitness scores: RESET to 50`);
    console.log("═══════════════════════════════════════");
  } catch (error) {
    console.error("❌ Failed to reset:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetAll();

import { createDbClientFromEnv } from "./client.js";
import { treasury, trades, strategies } from "./schema.js";
import { count, eq } from "drizzle-orm";

async function checkDb() {
  const { db, client } = createDbClientFromEnv();

  try {
    const treasuryData = await db.select().from(treasury);
    console.log("\n📊 Treasury:");
    console.log(`   Total SOL: ${treasuryData[0]?.totalSol ?? 'N/A'}`);
    console.log(`   Available: ${treasuryData[0]?.availableToTrade ?? 'N/A'}`);
    console.log(`   Locked: ${treasuryData[0]?.lockedInPositions ?? 'N/A'}`);
    console.log(`   Total PnL: ${treasuryData[0]?.totalPnl ?? 'N/A'}`);

    const tradeCount = await db.select({ count: count() }).from(trades);
    console.log(`\n📈 Trades: ${tradeCount[0].count}`);

    const strategyCount = await db.select({ count: count() }).from(strategies);
    console.log(`🎖️  Strategies: ${strategyCount[0].count}`);

    const activeCount = await db.select({ count: count() }).from(strategies).where(eq(strategies.status, "active"));
    console.log(`   Active: ${activeCount[0].count}`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

checkDb();

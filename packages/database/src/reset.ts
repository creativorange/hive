import { createDbClientFromEnv } from "./client.js";
import { trades, evolutionCycles, treasury, strategies } from "./schema.js";

async function resetDatabase() {
  console.log("🗑️  Resetting database...");

  const { db, client } = createDbClientFromEnv();

  try {
    console.log("Deleting trades...");
    await db.delete(trades);

    console.log("Deleting evolution cycles...");
    await db.delete(evolutionCycles);

    console.log("Deleting treasury...");
    await db.delete(treasury);

    console.log("Deleting strategies...");
    await db.delete(strategies);

    console.log("✅ Database reset complete!");
  } catch (error) {
    console.error("❌ Failed to reset database:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetDatabase();

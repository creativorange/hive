import { createDbClientFromEnv, StrategiesRepository } from "@meta/database";
import { GeneticEngine } from "@meta/core";

async function seed() {
  console.log("🌱 Seeding database with initial strategies...");

  const db = createDbClientFromEnv();
  const strategiesRepo = new StrategiesRepository(db);
  const geneticEngine = new GeneticEngine();

  // Force flag check - skip existence check if --force is passed
  const forceReseed = process.argv.includes("--force");
  
  if (!forceReseed) {
    const existing = await strategiesRepo.getTopPerformers(1);
    if (existing.length > 0) {
      console.log(`✅ Database already has strategies. Use --force to reseed.`);
      await db.close();
      return;
    }
  } else {
    console.log("🔄 Force flag detected, regenerating all strategies...");
  }

  // Generate genesis population
  const strategies = geneticEngine.generateGenesisPopulation(100);
  console.log(`📦 Generated ${strategies.length} strategies`);

  // Insert into database
  let inserted = 0;
  for (const strategy of strategies) {
    try {
      // Convert timestamp to Date for Drizzle
      const strategyWithDate = {
        ...strategy,
        birthTimestamp: new Date(strategy.birthTimestamp),
        deathTimestamp: strategy.deathTimestamp ? new Date(strategy.deathTimestamp) : null,
      };
      await strategiesRepo.create(strategyWithDate as unknown as typeof strategy);
      inserted++;
    } catch (err) {
      console.error(`Failed to insert strategy ${strategy.id}:`, err);
    }
  }

  console.log(`✅ Inserted ${inserted} strategies into database`);
  await db.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

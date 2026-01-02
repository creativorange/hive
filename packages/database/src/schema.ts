import {
  pgTable,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  boolean,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import type {
  StrategyGenes,
  StrategyPerformance,
  StrategyStatus,
  StrategyArchetype,
} from "@meta/core";

export const strategies = pgTable(
  "strategies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generation: integer("generation").notNull().default(0),
    parentIds: text("parent_ids").array().notNull().default([]),
    genes: jsonb("genes").notNull().$type<StrategyGenes>(),
    performance: jsonb("performance").notNull().$type<StrategyPerformance>(),
    status: text("status").notNull().$type<StrategyStatus>().default("active"),
    name: text("name"),
    archetype: text("archetype").$type<StrategyArchetype>(),
    birthTimestamp: timestamp("birth_timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deathTimestamp: timestamp("death_timestamp", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("strategies_generation_idx").on(table.generation),
    index("strategies_status_idx").on(table.status),
    index("strategies_archetype_idx").on(table.archetype),
  ]
);

export type Strategy = typeof strategies.$inferSelect;
export type NewStrategy = typeof strategies.$inferInsert;

export const trades = pgTable(
  "trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    strategyId: uuid("strategy_id")
      .notNull()
      .references(() => strategies.id),
    tokenAddress: text("token_address").notNull(),
    tokenName: text("token_name").notNull(),
    tokenSymbol: text("token_symbol").notNull(),
    entryPrice: real("entry_price").notNull(),
    exitPrice: real("exit_price"),
    amountSol: real("amount_sol").notNull(),
    pnlSol: real("pnl_sol"),
    pnlPercent: real("pnl_percent"),
    entryTimestamp: timestamp("entry_timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    exitTimestamp: timestamp("exit_timestamp", { withTimezone: true }),
    exitReason: text("exit_reason").$type<
      "take_profit" | "stop_loss" | "time_exit" | "volume_drop" | "manual"
    >(),
    status: text("status").notNull().$type<"open" | "closed">().default("open"),
    takeProfitPrice: real("take_profit_price").notNull(),
    stopLossPrice: real("stop_loss_price").notNull(),
    timeExitTimestamp: timestamp("time_exit_timestamp", { withTimezone: true }).notNull(),
    isPaperTrade: boolean("is_paper_trade").notNull().default(true),
    txSignature: text("tx_signature"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("trades_strategy_id_idx").on(table.strategyId),
    index("trades_status_idx").on(table.status),
    index("trades_token_address_idx").on(table.tokenAddress),
    index("trades_entry_timestamp_idx").on(table.entryTimestamp),
  ]
);

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

export const evolutionCycles = pgTable(
  "evolution_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generation: integer("generation").notNull().unique(),
    cycleTimestamp: timestamp("cycle_timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    survivors: text("survivors").array().notNull().default([]),
    dead: text("dead").array().notNull().default([]),
    newlyBorn: text("newly_born").array().notNull().default([]),
    avgFitness: real("avg_fitness").notNull().default(0),
    bestFitness: real("best_fitness").notNull().default(0),
    totalPnlSol: real("total_pnl_sol").notNull().default(0),
    bestStrategyId: uuid("best_strategy_id").references(() => strategies.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("evolution_cycles_generation_idx").on(table.generation),
  ]
);

export type EvolutionCycle = typeof evolutionCycles.$inferSelect;
export type NewEvolutionCycle = typeof evolutionCycles.$inferInsert;

export const strategyNfts = pgTable(
  "strategy_nfts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nftMint: text("nft_mint").notNull().unique(),
    strategyId: uuid("strategy_id")
      .notNull()
      .references(() => strategies.id),
    ownerWallet: text("owner_wallet").notNull(),
    mintTimestamp: timestamp("mint_timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    mintPrice: real("mint_price").notNull(),
    genesHash: text("genes_hash").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("strategy_nfts_strategy_id_idx").on(table.strategyId),
    index("strategy_nfts_owner_wallet_idx").on(table.ownerWallet),
    index("strategy_nfts_nft_mint_idx").on(table.nftMint),
  ]
);

export type StrategyNft = typeof strategyNfts.$inferSelect;
export type NewStrategyNft = typeof strategyNfts.$inferInsert;

export const treasury = pgTable("treasury", {
  id: uuid("id").primaryKey().defaultRandom(),
  totalSol: real("total_sol").notNull().default(0),
  lockedInPositions: real("locked_in_positions").notNull().default(0),
  availableToTrade: real("available_to_trade").notNull().default(0),
  totalPnl: real("total_pnl").notNull().default(0),
  reservePercent: real("reserve_percent").notNull().default(0.1),
  maxAllocationPerStrategy: real("max_allocation_per_strategy").notNull().default(0.5),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Treasury = typeof treasury.$inferSelect;
export type NewTreasury = typeof treasury.$inferInsert;

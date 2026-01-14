-- Initialize $META database

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Strategies table
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    generation INTEGER NOT NULL DEFAULT 0,
    parent_ids TEXT[] NOT NULL DEFAULT '{}',
    genes JSONB NOT NULL,
    performance JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    name TEXT,
    archetype TEXT,
    birth_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    death_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS strategies_generation_idx ON strategies(generation);
CREATE INDEX IF NOT EXISTS strategies_status_idx ON strategies(status);
CREATE INDEX IF NOT EXISTS strategies_archetype_idx ON strategies(archetype);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    token_address TEXT NOT NULL,
    token_name TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    entry_price REAL NOT NULL,
    exit_price REAL,
    amount_sol REAL NOT NULL,
    pnl_sol REAL,
    pnl_percent REAL,
    entry_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exit_timestamp TIMESTAMPTZ,
    exit_reason TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    take_profit_price REAL NOT NULL,
    stop_loss_price REAL NOT NULL,
    time_exit_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trades_strategy_id_idx ON trades(strategy_id);
CREATE INDEX IF NOT EXISTS trades_status_idx ON trades(status);
CREATE INDEX IF NOT EXISTS trades_token_address_idx ON trades(token_address);
CREATE INDEX IF NOT EXISTS trades_entry_timestamp_idx ON trades(entry_timestamp);

-- Evolution cycles table
CREATE TABLE IF NOT EXISTS evolution_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    generation INTEGER NOT NULL UNIQUE,
    cycle_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    survivors TEXT[] NOT NULL DEFAULT '{}',
    dead TEXT[] NOT NULL DEFAULT '{}',
    newly_born TEXT[] NOT NULL DEFAULT '{}',
    avg_fitness REAL NOT NULL DEFAULT 0,
    best_fitness REAL NOT NULL DEFAULT 0,
    total_pnl_sol REAL NOT NULL DEFAULT 0,
    best_strategy_id UUID REFERENCES strategies(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evolution_cycles_generation_idx ON evolution_cycles(generation);

-- Strategy NFTs table
CREATE TABLE IF NOT EXISTS strategy_nfts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nft_mint TEXT NOT NULL UNIQUE,
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    owner_wallet TEXT NOT NULL,
    mint_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    mint_price REAL NOT NULL,
    genes_hash TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS strategy_nfts_strategy_id_idx ON strategy_nfts(strategy_id);
CREATE INDEX IF NOT EXISTS strategy_nfts_owner_wallet_idx ON strategy_nfts(owner_wallet);
CREATE INDEX IF NOT EXISTS strategy_nfts_nft_mint_idx ON strategy_nfts(nft_mint);

-- Treasury table
CREATE TABLE IF NOT EXISTS treasury (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    total_sol REAL NOT NULL DEFAULT 0,
    locked_in_positions REAL NOT NULL DEFAULT 0,
    available_to_trade REAL NOT NULL DEFAULT 0,
    total_pnl REAL NOT NULL DEFAULT 0,
    reserve_percent REAL NOT NULL DEFAULT 0.1,
    max_allocation_per_strategy REAL NOT NULL DEFAULT 0.5,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial treasury record
INSERT INTO treasury (total_sol, available_to_trade)
VALUES (300, 300)
ON CONFLICT DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_strategies_updated_at ON strategies;
CREATE TRIGGER update_strategies_updated_at
    BEFORE UPDATE ON strategies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trades_updated_at ON trades;
CREATE TRIGGER update_trades_updated_at
    BEFORE UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_treasury_updated_at ON treasury;
CREATE TRIGGER update_treasury_updated_at
    BEFORE UPDATE ON treasury
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

# $META Trading Bot

An autonomous AI trading system using genetic algorithms for Pump.fun tokens on Solana. The system starts with 100 random trading strategies that evolve through Darwinian selection - top 20% breed, bottom 20% die, middle 60% mutate.

## Architecture

```
├── packages/
│   ├── core/        # Genetic algorithm engine & types
│   ├── trading/     # Trading execution engine
│   ├── database/    # Drizzle ORM + PostgreSQL
│   └── api/         # Fastify API + WebSocket server
├── apps/
│   └── web/         # Next.js 14 frontend with pixel art UI
├── contracts/       # Solana Anchor smart contracts
└── tests/           # E2E integration tests
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Start database with Docker
pnpm docker:up

# Run database migrations
pnpm db:push

# Run development servers
pnpm dev
```

## Available Scripts

### Development
```bash
pnpm dev            # Run all packages in dev mode
pnpm dev:api        # Run API server only
pnpm dev:web        # Run frontend only
```

### Building
```bash
pnpm build          # Build all packages
pnpm typecheck      # Type check all packages
```

### Testing
```bash
pnpm test           # Run all tests
pnpm test:core      # Test genetic algorithm
pnpm test:trading   # Test trading engine
pnpm test:api       # Test API routes
pnpm test:e2e       # Run E2E flow tests
```

### Database
```bash
pnpm db:generate    # Generate migrations
pnpm db:migrate     # Run migrations
pnpm db:push        # Push schema to database
pnpm db:studio      # Open Drizzle Studio
```

### Docker
```bash
pnpm docker:up      # Start PostgreSQL & Redis
pnpm docker:down    # Stop containers
pnpm docker:build   # Build Docker images
pnpm docker:logs    # View container logs
```

### Solana Contracts
```bash
pnpm contracts:build   # Build Anchor programs
pnpm contracts:test    # Run contract tests
pnpm contracts:deploy  # Deploy to devnet
```

## Core Concepts

### Genetic Algorithm

The system evolves trading strategies using:
- **Fitness Function**: 40% PnL, 25% win rate, 20% Sharpe ratio, 15% consistency
- **Selection**: Top 20% survive, bottom 20% die
- **Crossover**: Survivors breed to create offspring
- **Mutation**: Middle 60% mutate their genes

### Strategy Genes

Each strategy has genes controlling:
- Entry criteria (market cap, volume, social signals)
- Exit conditions (take profit, stop loss, time-based)
- Risk management (position sizing, diversification)
- Pattern matching (keywords, buy patterns)

### Strategy Archetypes

Strategies are classified as:
- **Aggressive**: High profit targets, tight stop losses
- **Conservative**: Lower targets, wider stops
- **Social**: Focus on social signals
- **Whale Follower**: Tracks whale wallets
- **Sniper**: Quick entries and exits on low caps
- **Momentum**: Follows price trends

## API Endpoints

### Strategies
- `GET /api/strategies` - List active strategies
- `GET /api/strategies/:id` - Strategy details
- `GET /api/strategies/top/:count` - Top performers
- `GET /api/strategies/graveyard` - Dead strategies

### Trades
- `GET /api/trades` - Recent trades
- `GET /api/trades/live` - Open positions
- `GET /api/trades/stats` - Trading statistics

### Evolution
- `GET /api/evolution/current` - Current generation
- `GET /api/evolution/history` - Evolution cycles
- `POST /api/evolution/trigger` - Manual evolution

### Treasury
- `GET /api/treasury` - Treasury state

## WebSocket Events

Subscribe to real-time updates:
- `trades` - Trade opens/closes
- `evolution` - Evolution cycles
- `strategies` - Strategy updates
- `prices` - Price updates
- `positions` - Position changes

## Smart Contracts

### meta_treasury
Manages funds and profit distribution with multisig security.

### meta_nft
Mints NFTs of successful strategies with on-chain performance data.

## Environment Variables

See `.env.example` for all configuration options.

## Requirements

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- PostgreSQL 16+
- Rust & Anchor (for contracts)
- Solana CLI (for deployment)

## License

MIT

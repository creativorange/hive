# $META Solana Smart Contracts

Anchor-based Solana programs for the $META trading ecosystem.

## Programs

### meta_treasury

Manages the $META treasury funds and profit distribution.

**Instructions:**
- `initialize_treasury(amount)` - Initialize treasury with SOL deposit
- `add_profits(amount)` - Add trading profits to the pool
- `distribute_profits(holder_share_bps)` - Distribute profits to holders
- `withdraw_emergency(amount)` - Emergency withdrawal (multisig required)
- `update_multisig(new_multisig)` - Update multisig authority

### meta_nft

Mint NFTs representing successful trading strategies.

**Instructions:**
- `initialize_collection(name, symbol, uri)` - Initialize NFT collection
- `mint_strategy_nft(...)` - Mint an NFT for a strategy
- `update_mint_price(new_price)` - Update mint price
- `toggle_minting(is_active)` - Pause/resume minting
- `transfer_authority(new_authority)` - Transfer admin authority

## Development

```bash
# Build programs
anchor build

# Run tests (requires local validator)
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## Testing

```bash
# Start local validator
solana-test-validator

# In another terminal
anchor test --skip-local-validator
```

## Security

- All admin functions require multisig authorization
- Emergency withdrawal is protected by multisig
- NFT minting can be paused by admin

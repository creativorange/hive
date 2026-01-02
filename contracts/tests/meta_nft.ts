import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MetaNft } from "../target/types/meta_nft";
import { expect } from "chai";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

describe("meta_nft", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MetaNft as Program<MetaNft>;
  const authority = provider.wallet;
  const treasury = Keypair.generate();

  let collectionConfigPda: PublicKey;
  let collectionConfigBump: number;

  before(async () => {
    [collectionConfigPda, collectionConfigBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("collection")],
      program.programId
    );

    // Airdrop to treasury
    const sig = await provider.connection.requestAirdrop(
      treasury.publicKey,
      0.1 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  });

  it("initializes the collection", async () => {
    await program.methods
      .initializeCollection("$META Strategies", "META", "https://meta.io/collection.json")
      .accounts({
        collectionConfig: collectionConfigPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.collectionConfig.fetch(collectionConfigPda);

    expect(config.authority.toString()).to.equal(authority.publicKey.toString());
    expect(config.totalMinted.toNumber()).to.equal(0);
    expect(config.mintPriceLamports.toNumber()).to.equal(100_000_000);
    expect(config.isActive).to.be.true;
  });

  it("updates mint price", async () => {
    const newPrice = new anchor.BN(200_000_000); // 0.2 SOL

    await program.methods
      .updateMintPrice(newPrice)
      .accounts({
        collectionConfig: collectionConfigPda,
        authority: authority.publicKey,
      })
      .rpc();

    const config = await program.account.collectionConfig.fetch(collectionConfigPda);
    expect(config.mintPriceLamports.toNumber()).to.equal(newPrice.toNumber());

    // Reset to lower price for testing
    await program.methods
      .updateMintPrice(new anchor.BN(10_000_000))
      .accounts({
        collectionConfig: collectionConfigPda,
        authority: authority.publicKey,
      })
      .rpc();
  });

  it("mints a strategy NFT", async () => {
    const strategyId = "test-strategy-001";
    const mint = Keypair.generate();

    const [strategyNftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_nft"), Buffer.from(strategyId)],
      program.programId
    );

    const tokenAccount = await getAssociatedTokenAddress(
      mint.publicKey,
      authority.publicKey
    );

    const [metadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const [masterEditionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const treasuryBalanceBefore = await provider.connection.getBalance(treasury.publicKey);

    await program.methods
      .mintStrategyNft(
        strategyId,
        "abc123hash",
        "Alpha Hunter #1",
        "META",
        "https://meta.io/nft/1.json",
        "aggressive",
        5, // generation
        new anchor.BN(8500), // fitness score (85.00)
        new anchor.BN(1500000), // total PnL in lamports
        new anchor.BN(6800), // win rate (68.00%)
        150 // trades executed
      )
      .accounts({
        collectionConfig: collectionConfigPda,
        strategyNft: strategyNftPda,
        mint: mint.publicKey,
        tokenAccount,
        metadata: metadataPda,
        masterEdition: masterEditionPda,
        treasury: treasury.publicKey,
        payer: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: TOKEN_METADATA_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    // Verify strategy NFT data
    const strategyNft = await program.account.strategyNftData.fetch(strategyNftPda);
    expect(strategyNft.strategyId).to.equal(strategyId);
    expect(strategyNft.genesHash).to.equal("abc123hash");
    expect(strategyNft.archetype).to.equal("aggressive");
    expect(strategyNft.generation).to.equal(5);
    expect(strategyNft.fitnessScore.toNumber()).to.equal(8500);
    expect(strategyNft.owner.toString()).to.equal(authority.publicKey.toString());

    // Verify collection config updated
    const config = await program.account.collectionConfig.fetch(collectionConfigPda);
    expect(config.totalMinted.toNumber()).to.equal(1);

    // Verify treasury received payment
    const treasuryBalanceAfter = await provider.connection.getBalance(treasury.publicKey);
    expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(10_000_000);
  });

  it("toggles minting", async () => {
    // Pause minting
    await program.methods
      .toggleMinting(false)
      .accounts({
        collectionConfig: collectionConfigPda,
        authority: authority.publicKey,
      })
      .rpc();

    let config = await program.account.collectionConfig.fetch(collectionConfigPda);
    expect(config.isActive).to.be.false;

    // Resume minting
    await program.methods
      .toggleMinting(true)
      .accounts({
        collectionConfig: collectionConfigPda,
        authority: authority.publicKey,
      })
      .rpc();

    config = await program.account.collectionConfig.fetch(collectionConfigPda);
    expect(config.isActive).to.be.true;
  });

  it("fails to mint when paused", async () => {
    // Pause minting first
    await program.methods
      .toggleMinting(false)
      .accounts({
        collectionConfig: collectionConfigPda,
        authority: authority.publicKey,
      })
      .rpc();

    const strategyId = "test-strategy-002";
    const mint = Keypair.generate();

    const [strategyNftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_nft"), Buffer.from(strategyId)],
      program.programId
    );

    const tokenAccount = await getAssociatedTokenAddress(
      mint.publicKey,
      authority.publicKey
    );

    const [metadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const [masterEditionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    try {
      await program.methods
        .mintStrategyNft(
          strategyId,
          "hash456",
          "Failed Mint",
          "META",
          "https://meta.io/nft/2.json",
          "conservative",
          3,
          new anchor.BN(7000),
          new anchor.BN(500000),
          new anchor.BN(5500),
          75
        )
        .accounts({
          collectionConfig: collectionConfigPda,
          strategyNft: strategyNftPda,
          mint: mint.publicKey,
          tokenAccount,
          metadata: metadataPda,
          masterEdition: masterEditionPda,
          treasury: treasury.publicKey,
          payer: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          metadataProgram: TOKEN_METADATA_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mint])
        .rpc();

      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("MintingPaused");
    }

    // Resume minting
    await program.methods
      .toggleMinting(true)
      .accounts({
        collectionConfig: collectionConfigPda,
        authority: authority.publicKey,
      })
      .rpc();
  });

  it("transfers authority", async () => {
    const newAuthority = Keypair.generate();

    await program.methods
      .transferAuthority(newAuthority.publicKey)
      .accounts({
        collectionConfig: collectionConfigPda,
        authority: authority.publicKey,
      })
      .rpc();

    const config = await program.account.collectionConfig.fetch(collectionConfigPda);
    expect(config.authority.toString()).to.equal(newAuthority.publicKey.toString());

    // Transfer back for other tests
    await program.methods
      .transferAuthority(authority.publicKey)
      .accounts({
        collectionConfig: collectionConfigPda,
        authority: newAuthority.publicKey,
      })
      .signers([newAuthority])
      .rpc();
  });
});

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MetaTreasury } from "../target/types/meta_treasury";
import { expect } from "chai";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

describe("meta_treasury", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MetaTreasury as Program<MetaTreasury>;
  const authority = provider.wallet;
  const multisig = Keypair.generate();
  
  let treasuryPda: PublicKey;
  let treasuryBump: number;

  before(async () => {
    [treasuryPda, treasuryBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );

    // Airdrop to multisig for testing
    const sig = await provider.connection.requestAirdrop(
      multisig.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  });

  it("initializes the treasury", async () => {
    const initialAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

    await program.methods
      .initializeTreasury(initialAmount)
      .accounts({
        treasury: treasuryPda,
        authority: authority.publicKey,
        multisig: multisig.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const treasuryAccount = await program.account.treasuryState.fetch(treasuryPda);
    
    expect(treasuryAccount.authority.toString()).to.equal(authority.publicKey.toString());
    expect(treasuryAccount.emergencyMultisig.toString()).to.equal(multisig.publicKey.toString());
    expect(treasuryAccount.totalSol.toNumber()).to.equal(initialAmount.toNumber());
    expect(treasuryAccount.profitPool.toNumber()).to.equal(0);
    expect(treasuryAccount.isInitialized).to.be.true;
  });

  it("adds profits to the pool", async () => {
    const profitAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

    const treasuryBefore = await program.account.treasuryState.fetch(treasuryPda);

    await program.methods
      .addProfits(profitAmount)
      .accounts({
        treasury: treasuryPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const treasuryAfter = await program.account.treasuryState.fetch(treasuryPda);
    
    expect(treasuryAfter.totalSol.toNumber()).to.equal(
      treasuryBefore.totalSol.toNumber() + profitAmount.toNumber()
    );
    expect(treasuryAfter.profitPool.toNumber()).to.equal(profitAmount.toNumber());
  });

  it("distributes profits to a holder", async () => {
    const holder = Keypair.generate();
    const holderShareBps = 1000; // 10%

    // Airdrop minimum rent to holder
    const sig = await provider.connection.requestAirdrop(
      holder.publicKey,
      0.01 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const treasuryBefore = await program.account.treasuryState.fetch(treasuryPda);
    const holderBalanceBefore = await provider.connection.getBalance(holder.publicKey);

    const expectedDistribution = Math.floor(
      (treasuryBefore.profitPool.toNumber() * holderShareBps) / 10000
    );

    await program.methods
      .distributeProfits(holderShareBps)
      .accounts({
        treasury: treasuryPda,
        authority: authority.publicKey,
        holder: holder.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const treasuryAfter = await program.account.treasuryState.fetch(treasuryPda);
    const holderBalanceAfter = await provider.connection.getBalance(holder.publicKey);

    expect(holderBalanceAfter - holderBalanceBefore).to.equal(expectedDistribution);
    expect(treasuryAfter.profitPool.toNumber()).to.equal(
      treasuryBefore.profitPool.toNumber() - expectedDistribution
    );
  });

  it("performs emergency withdrawal with multisig", async () => {
    const destination = Keypair.generate();
    const withdrawAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    // Airdrop minimum rent to destination
    const sig = await provider.connection.requestAirdrop(
      destination.publicKey,
      0.01 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const treasuryBefore = await program.account.treasuryState.fetch(treasuryPda);
    const destBalanceBefore = await provider.connection.getBalance(destination.publicKey);

    await program.methods
      .withdrawEmergency(withdrawAmount)
      .accounts({
        treasury: treasuryPda,
        multisig: multisig.publicKey,
        destination: destination.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([multisig])
      .rpc();

    const treasuryAfter = await program.account.treasuryState.fetch(treasuryPda);
    const destBalanceAfter = await provider.connection.getBalance(destination.publicKey);

    expect(destBalanceAfter - destBalanceBefore).to.equal(withdrawAmount.toNumber());
    expect(treasuryAfter.totalSol.toNumber()).to.equal(
      treasuryBefore.totalSol.toNumber() - withdrawAmount.toNumber()
    );
  });

  it("updates the multisig authority", async () => {
    const newMultisig = Keypair.generate();

    await program.methods
      .updateMultisig(newMultisig.publicKey)
      .accounts({
        treasury: treasuryPda,
        multisig: multisig.publicKey,
      })
      .signers([multisig])
      .rpc();

    const treasuryAfter = await program.account.treasuryState.fetch(treasuryPda);
    expect(treasuryAfter.emergencyMultisig.toString()).to.equal(newMultisig.publicKey.toString());
  });

  it("fails emergency withdrawal without multisig", async () => {
    const destination = Keypair.generate();
    const withdrawAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    try {
      await program.methods
        .withdrawEmergency(withdrawAmount)
        .accounts({
          treasury: treasuryPda,
          multisig: authority.publicKey, // Wrong signer
          destination: destination.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).to.exist;
    }
  });
});

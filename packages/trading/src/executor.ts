import type { Trade, PumpFunToken, StrategyGenome } from "@meta/core";
import { generateId, nowTimestamp } from "@meta/core";
import type { TradingConfig, TradeResult, Position } from "./types.js";

export class TradeExecutor {
  private config: TradingConfig;

  constructor(config: TradingConfig) {
    this.config = config;
  }

  async executeBuy(
    strategy: StrategyGenome,
    token: PumpFunToken,
    amountSol: number
  ): Promise<TradeResult> {
    // Enforce minimum and maximum position sizes
    const minSize = this.config.minPositionSize ?? 0.5;
    const adjustedAmount = Math.min(Math.max(amountSol, minSize), this.config.maxPositionSize);

    if (adjustedAmount < minSize) {
      return {
        success: false,
        error: `Position size too small: ${amountSol} < ${minSize} SOL minimum`,
      };
    }

    if (token.liquidity < this.config.minLiquidity) {
      return {
        success: false,
        error: `Insufficient liquidity: ${token.liquidity} < ${this.config.minLiquidity}`,
      };
    }

    const slippageAmount = token.priceUSD * this.config.slippage;
    const effectivePrice = token.priceUSD + slippageAmount;

    const takeProfitPrice = effectivePrice * strategy.genes.takeProfitMultiplier;
    const stopLossPrice = effectivePrice * strategy.genes.stopLossMultiplier;
    const timeExitTimestamp = nowTimestamp() + strategy.genes.timeBasedExit * 60 * 1000;

    const trade: Trade = {
      id: generateId(),
      strategyId: strategy.id,
      tokenAddress: token.address,
      tokenName: token.name,
      tokenSymbol: token.symbol,
      entryPrice: effectivePrice,
      amountSol: adjustedAmount,
      entryTimestamp: nowTimestamp(),
      status: "open",
      takeProfitPrice,
      stopLossPrice,
      timeExitTimestamp,
      isPaperTrade: this.config.paperTradingMode,
    };

    if (this.config.paperTradingMode) {
      const txSignature = `paper_${trade.id}`;
      trade.txSignature = txSignature;
      console.log(`[PAPER] BUY ${token.symbol}: ${adjustedAmount} SOL @ $${effectivePrice}`);
      return {
        success: true,
        trade,
        txSignature,
      };
    }

    try {
      const txSignature = await this.submitBuyTransaction(
        token.address,
        adjustedAmount,
        effectivePrice
      );

      trade.txSignature = txSignature;
      return {
        success: true,
        trade,
        txSignature,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async executeSell(
    position: Position,
    reason: Trade["exitReason"]
  ): Promise<TradeResult> {
    const currentPrice = position.currentPrice;
    const slippageAmount = currentPrice * this.config.slippage;
    const effectivePrice = currentPrice - slippageAmount;

    const pnlSol = (effectivePrice - position.entryPrice) / position.entryPrice * position.amountSol;
    const pnlPercent = (effectivePrice - position.entryPrice) / position.entryPrice;

    const closedTrade: Trade = {
      ...position.trade,
      exitPrice: effectivePrice,
      exitTimestamp: nowTimestamp(),
      exitReason: reason,
      status: "closed",
      pnlSol,
      pnlPercent,
    };

    if (this.config.paperTradingMode) {
      const txSignature = `paper_sell_${closedTrade.id}`;
      closedTrade.txSignature = txSignature;
      console.log(
        `[PAPER] SELL ${position.token.symbol}: ${position.amountSol} SOL @ $${effectivePrice} (${reason}) PnL: ${pnlSol.toFixed(4)} SOL`
      );
      return {
        success: true,
        trade: closedTrade,
        txSignature,
      };
    }

    try {
      const txSignature = await this.submitSellTransaction(
        position.token.address,
        position.tokenAmount,
        effectivePrice
      );

      closedTrade.txSignature = txSignature;
      return {
        success: true,
        trade: closedTrade,
        txSignature,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  isPaperTrading(): boolean {
    return this.config.paperTradingMode;
  }

  private async submitBuyTransaction(
    _tokenAddress: string,
    _amountSol: number,
    _maxPrice: number
  ): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return `mock_tx_buy_${Date.now()}`;
  }

  private async submitSellTransaction(
    _tokenAddress: string,
    _tokenAmount: number,
    _minPrice: number
  ): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return `mock_tx_sell_${Date.now()}`;
  }

  updateConfig(config: Partial<TradingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): TradingConfig {
    return { ...this.config };
  }
}

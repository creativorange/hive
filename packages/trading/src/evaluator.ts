import type { StrategyGenome, PumpFunToken } from "@meta/core";
import type { EvaluationResult, SellEvaluationResult, Position } from "./types.js";

export class TokenEvaluator {
  shouldBuy(strategy: StrategyGenome, token: PumpFunToken): EvaluationResult {
    const reasons: string[] = [];
    let score = 0;

    if (
      token.marketCap < strategy.genes.entryMcapMin ||
      token.marketCap > strategy.genes.entryMcapMax
    ) {
      return {
        shouldTrade: false,
        score: 0,
        matchedPatterns: [],
        matchedKeywords: [],
        socialScore: 0,
        reasons: ["Market cap outside range"],
      };
    }
    reasons.push("Market cap within range");
    score += 20;

    if (token.volume24h < strategy.genes.entryVolumeMin) {
      return {
        shouldTrade: false,
        score,
        matchedPatterns: [],
        matchedKeywords: [],
        socialScore: 0,
        reasons: ["Volume below minimum"],
      };
    }
    reasons.push("Volume above minimum");
    score += 15;

    const patternResult = this.matchesPatterns(strategy, token);
    const matchedPatterns = patternResult.matched;
    score += patternResult.score;
    if (matchedPatterns.length > 0) {
      reasons.push(`Matched patterns: ${matchedPatterns.join(", ")}`);
    }

    const keywordResult = this.matchesKeywords(strategy, token);
    const matchedKeywords = keywordResult.matched;
    score += keywordResult.score;
    if (matchedKeywords.length > 0) {
      reasons.push(`Matched keywords: ${matchedKeywords.join(", ")}`);
    }

    const socialResult = this.checkSocialSignals(strategy, token);
    const socialScore = socialResult.score;
    score += socialScore;
    if (socialResult.passed) {
      reasons.push("Social signals passed");
    }

    const shouldTrade = score >= 50 && (matchedPatterns.length > 0 || matchedKeywords.length > 0);

    return {
      shouldTrade,
      score,
      matchedPatterns,
      matchedKeywords,
      socialScore,
      reasons,
    };
  }

  matchesPatterns(
    strategy: StrategyGenome,
    token: PumpFunToken
  ): { matched: string[]; score: number } {
    const matched: string[] = [];
    const tokenNameLower = token.name.toLowerCase();
    const tokenSymbolLower = token.symbol.toLowerCase();

    for (const pattern of strategy.genes.buyPatterns) {
      switch (pattern) {
        case "cat_meme":
          if (tokenNameLower.includes("cat") || tokenSymbolLower.includes("cat")) {
            matched.push(pattern);
          }
          break;
        case "dog_meme":
          if (
            tokenNameLower.includes("dog") ||
            tokenSymbolLower.includes("dog") ||
            tokenNameLower.includes("inu") ||
            tokenNameLower.includes("shib")
          ) {
            matched.push(pattern);
          }
          break;
        case "ai_narrative":
          if (
            tokenNameLower.includes("ai") ||
            tokenSymbolLower.includes("ai") ||
            tokenNameLower.includes("gpt") ||
            tokenNameLower.includes("neural")
          ) {
            matched.push(pattern);
          }
          break;
        case "agent_narrative":
          if (tokenNameLower.includes("agent") || tokenSymbolLower.includes("agent")) {
            matched.push(pattern);
          }
          break;
        case "low_holder_gem":
          if (token.holders < 100 && token.volume24h > 5000) {
            matched.push(pattern);
          }
          break;
        case "whale_accumulation":
          if (token.volume24h > token.marketCap * 0.5) {
            matched.push(pattern);
          }
          break;
        case "animal_meme":
          if (
            /cat|dog|ape|frog|pepe|monkey|bear|bull/i.test(tokenNameLower) ||
            /cat|dog|ape|frog|pepe|monkey|bear|bull/i.test(tokenSymbolLower)
          ) {
            matched.push(pattern);
          }
          break;
        case "food_meme":
          if (
            /pizza|burger|taco|sushi|ramen|food/i.test(tokenNameLower) ||
            /pizza|burger|taco|sushi|ramen|food/i.test(tokenSymbolLower)
          ) {
            matched.push(pattern);
          }
          break;
        case "degen_play":
          if (token.priceChange24h > 100 && token.holders > 50) {
            matched.push(pattern);
          }
          break;
        default:
          break;
      }
    }

    return {
      matched,
      score: matched.length * 15,
    };
  }

  matchesKeywords(
    strategy: StrategyGenome,
    token: PumpFunToken
  ): { matched: string[]; score: number } {
    const matched: string[] = [];
    const tokenNameLower = token.name.toLowerCase();
    const tokenSymbolLower = token.symbol.toLowerCase();

    for (const keyword of strategy.genes.tokenNameKeywords) {
      if (tokenNameLower.includes(keyword.toLowerCase()) || tokenSymbolLower.includes(keyword.toLowerCase())) {
        matched.push(keyword);
      }
    }

    return {
      matched,
      score: matched.length * 10,
    };
  }

  checkSocialSignals(
    strategy: StrategyGenome,
    token: PumpFunToken
  ): { passed: boolean; score: number } {
    let score = 0;
    let checks = 0;
    let passed = 0;

    if (strategy.genes.socialSignals.holdersMin > 0) {
      checks++;
      if (token.holders >= strategy.genes.socialSignals.holdersMin) {
        passed++;
        score += 10;
      }
    }

    if (strategy.genes.socialSignals.twitterFollowers > 0) {
      checks++;
      if (token.socialLinks.twitter) {
        passed++;
        score += 10;
      }
    }

    if (strategy.genes.socialSignals.telegramMembers > 0) {
      checks++;
      if (token.socialLinks.telegram) {
        passed++;
        score += 10;
      }
    }

    return {
      passed: checks === 0 || passed >= checks * 0.5,
      score,
    };
  }

  calculateScore(strategy: StrategyGenome, token: PumpFunToken): number {
    const result = this.shouldBuy(strategy, token);
    return result.score;
  }

  shouldSell(
    strategy: StrategyGenome,
    position: Position,
    currentToken: PumpFunToken,
    previousToken?: PumpFunToken
  ): SellEvaluationResult {
    const reasons: string[] = [];
    const matchedPatterns: string[] = [];
    let score = 0;
    const { sellSignals, sellPatterns } = strategy.genes;

    const pnlPercent = position.unrealizedPnLPercent;
    const priceChange = previousToken
      ? (currentToken.priceUSD - previousToken.priceUSD) / previousToken.priceUSD
      : 0;
    const volumeChange = previousToken
      ? (currentToken.volume24h - previousToken.volume24h) / previousToken.volume24h
      : 0;
    const holderChange = previousToken
      ? currentToken.holders - previousToken.holders
      : 0;

    // Check sell signals - lower thresholds for faster exits
    if (sellSignals.momentumReversal && pnlPercent > 0.05 && priceChange < -0.05) {
      score += 30;
      matchedPatterns.push("momentum_death");
      reasons.push(`Momentum reversed: was +${(pnlPercent * 100).toFixed(1)}%, price dropped ${(priceChange * 100).toFixed(1)}%`);
    }

    if (sellSignals.volumeDry && volumeChange < -0.3) {
      score += 25;
      matchedPatterns.push("volume_collapse");
      reasons.push(`Volume collapsed: ${(volumeChange * 100).toFixed(1)}% drop`);
    }

    if (sellSignals.holdersDumping && holderChange < -5) {
      score += 20;
      matchedPatterns.push("holder_exodus");
      reasons.push(`Holders dumping: ${holderChange} holders left`);
    }
    
    // NEW: Direct price drop check - if price dropped more than 10% from entry, sell
    if (pnlPercent < -0.10) {
      score += 35;
      matchedPatterns.push("price_dump");
      reasons.push(`Price dumped ${(pnlPercent * 100).toFixed(1)}% from entry`);
    }

    if (sellSignals.mcapCeiling > 0 && currentToken.marketCap >= sellSignals.mcapCeiling) {
      score += 35;
      matchedPatterns.push("mcap_ceiling");
      reasons.push(`Hit mcap ceiling: $${currentToken.marketCap.toLocaleString()} >= $${sellSignals.mcapCeiling.toLocaleString()}`);
    }

    if (sellSignals.profitSecuring > 0 && pnlPercent >= sellSignals.profitSecuring) {
      score += 25;
      matchedPatterns.push("profit_secure");
      reasons.push(`Profit target hit: +${(pnlPercent * 100).toFixed(1)}% >= +${(sellSignals.profitSecuring * 100).toFixed(1)}%`);
    }

    // Check trailing stop - use highest of entry, previous, or current price as peak
    if (sellSignals.trailingStop > 0) {
      const peakPrice = Math.max(
        position.entryPrice,
        position.currentPrice,
        previousToken?.priceUSD ?? 0
      );
      const dropFromPeak = (peakPrice - currentToken.priceUSD) / peakPrice;
      if (dropFromPeak >= sellSignals.trailingStop) {
        score += 40;
        matchedPatterns.push("trailing_stop_hit");
        reasons.push(`Trailing stop hit: dropped ${(dropFromPeak * 100).toFixed(1)}% from peak`);
      }
    }

    // Check pattern-based sells
    for (const pattern of sellPatterns) {
      if (this.matchesSellPattern(pattern, position, currentToken, previousToken)) {
        score += 15;
        matchedPatterns.push(pattern);
      }
    }

    // Time decay check
    const holdTimeMinutes = (Date.now() - position.openedAt) / 60000;
    const maxHoldTime = strategy.genes.timeBasedExit;
    if (holdTimeMinutes > maxHoldTime * 0.8 && pnlPercent < 0.05) {
      score += 15;
      matchedPatterns.push("time_decay");
      reasons.push(`Held ${holdTimeMinutes.toFixed(0)}min with minimal gains, approaching time limit`);
    }

    // Determine urgency and exit percent
    let urgency: SellEvaluationResult["urgency"] = "hold";
    let suggestedExitPercent = 0;

    if (score >= 40) {
      urgency = "immediate";
      suggestedExitPercent = 1.0;
    } else if (score >= 25) {
      urgency = "soon";
      suggestedExitPercent = 0.75;
    } else if (score >= 15) {
      urgency = "consider";
      suggestedExitPercent = 0.5;
    }

    return {
      shouldSell: score >= 25,
      urgency,
      score,
      matchedPatterns,
      reasons,
      suggestedExitPercent,
    };
  }

  private matchesSellPattern(
    pattern: string,
    position: Position,
    currentToken: PumpFunToken,
    previousToken?: PumpFunToken
  ): boolean {
    const volumeChange = previousToken
      ? (currentToken.volume24h - previousToken.volume24h) / previousToken.volume24h
      : 0;
    const holderChange = previousToken ? currentToken.holders - previousToken.holders : 0;
    const liquidityChange = previousToken
      ? (currentToken.liquidity - previousToken.liquidity) / previousToken.liquidity
      : 0;

    switch (pattern) {
      case "momentum_death":
        return position.unrealizedPnLPercent > 0 && position.unrealizedPnLPercent < position.unrealizedPnLPercent * 0.7;
      case "volume_collapse":
        return volumeChange < -0.5;
      case "whale_dump":
        return volumeChange > 0.5 && currentToken.priceUSD < position.entryPrice;
      case "holder_exodus":
        return holderChange < -20;
      case "hype_fade":
        return volumeChange < -0.3 && holderChange < 0;
      case "liquidity_drain":
        return liquidityChange < -0.3;
      case "time_decay":
        const holdTime = Date.now() - position.openedAt;
        return holdTime > 30 * 60 * 1000 && position.unrealizedPnLPercent < 0.1;
      default:
        return false;
    }
  }
}

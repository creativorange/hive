import type { PumpFunToken } from "./types.js";
import { WebSocket, type MessageEvent } from "ws";

const PUMPPORTAL_WS = "wss://pumpportal.fun/api/data";

interface RateLimiter {
  tokens: number;
  lastRefill: number;
}

interface PumpPortalNewToken {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: string;
  initialBuy: number;
  bondingCurveKey: string;
  vTokensInBondingCurve: number;
  vSolInBondingCurve: number;
  marketCapSol: number;
  name: string;
  symbol: string;
  uri: string;
}

interface PumpPortalTrade {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: "buy" | "sell";
  tokenAmount: number;
  newTokenBalance: number;
  bondingCurveKey: string;
  vTokensInBondingCurve: number;
  vSolInBondingCurve: number;
  marketCapSol: number;
}

export class PumpFunClient {
  private rateLimiter: RateLimiter = {
    tokens: 100,
    lastRefill: Date.now(),
  };
  private wsConnection: WebSocket | null = null;
  private tokenSubscribers: Set<(token: PumpFunToken) => void> = new Set();
  private recentTokens: Map<string, PumpFunToken> = new Map();
  private isConnecting = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private solPrice = 180;

  constructor() {
    this.fetchSolPrice();
    setInterval(() => this.fetchSolPrice(), 60000);
  }

  private async fetchSolPrice(): Promise<void> {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
      );
      const data = await response.json() as { solana?: { usd?: number } };
      if (data.solana?.usd) {
        this.solPrice = data.solana.usd;
      }
    } catch {
      console.warn("[PumpFun] Failed to fetch SOL price, using cached value");
    }
  }

  private convertToToken(data: PumpPortalNewToken): PumpFunToken {
    const marketCapUsd = data.marketCapSol * this.solPrice;
    const priceUSD = marketCapUsd / 1_000_000_000;

    return {
      address: data.mint,
      name: data.name || "Unknown",
      symbol: data.symbol || "???",
      marketCap: marketCapUsd,
      volume24h: data.initialBuy * this.solPrice,
      liquidity: data.vSolInBondingCurve * this.solPrice,
      holders: 1,
      createdAt: Date.now(),
      creator: data.traderPublicKey,
      socialLinks: {},
      priceUSD,
      priceChange24h: 0,
    };
  }

  async fetchNewTokens(limit = 50): Promise<PumpFunToken[]> {
    const tokens = Array.from(this.recentTokens.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    return tokens;
  }

  async getTokenMetrics(address: string): Promise<PumpFunToken | null> {
    const cached = this.recentTokens.get(address);
    if (cached) {
      // More realistic price simulation based on volume
      // Low volume tokens should have smaller, mostly negative moves (most memecoins die)
      const volumeScore = Math.min(1, cached.volume24h / 10000); // 0-1 based on volume
      const volatility = Math.random();
      let priceMultiplier: number;
      
      // Most memecoins lose value - 70% chance of decline
      if (volatility < 0.5) {
        // 50% chance: slight decline (-2% to -8%)
        priceMultiplier = 0.92 + Math.random() * 0.06;
      } else if (volatility < 0.7) {
        // 20% chance: moderate decline (-8% to -20%)
        priceMultiplier = 0.80 + Math.random() * 0.12;
      } else if (volatility < 0.85) {
        // 15% chance: small gain (+2% to +15%) - requires some volume
        priceMultiplier = volumeScore > 0.1 ? 1.02 + Math.random() * 0.13 : 0.95 + Math.random() * 0.05;
      } else if (volatility < 0.95) {
        // 10% chance: moderate gain (+15% to +40%) - requires decent volume
        priceMultiplier = volumeScore > 0.3 ? 1.15 + Math.random() * 0.25 : 0.90 + Math.random() * 0.10;
      } else {
        // 5% chance: big move - moonshot or rug based on volume
        if (volumeScore > 0.5 && Math.random() < 0.3) {
          // 1.5% chance of moonshot (+50% to +100%) - only high volume tokens
          priceMultiplier = 1.5 + Math.random() * 0.5;
        } else {
          // 3.5% chance of rug (-40% to -70%)
          priceMultiplier = 0.30 + Math.random() * 0.30;
        }
      }

      const newPrice = cached.priceUSD * priceMultiplier;
      
      // Update cached price so movements accumulate over time
      cached.priceUSD = newPrice;
      
      // Volume also decays over time for most tokens
      const volumeMultiplier = volatility < 0.7 ? 0.7 + Math.random() * 0.3 : 0.9 + Math.random() * 0.4;
      cached.volume24h = cached.volume24h * volumeMultiplier;
      
      return {
        ...cached,
        priceUSD: newPrice,
        volume24h: cached.volume24h,
        holders: cached.holders + Math.floor(Math.random() * 10) - 3, // Can lose holders too
      };
    }
    return null;
  }

  getRemainingRequests(): number {
    return this.rateLimiter.tokens;
  }

  subscribeToNewTokens(callback: (token: PumpFunToken) => void): () => void {
    this.tokenSubscribers.add(callback);

    if (!this.wsConnection && !this.isConnecting) {
      this.connectWebSocket();
    }

    return () => {
      this.tokenSubscribers.delete(callback);
      if (this.tokenSubscribers.size === 0 && this.wsConnection) {
        this.wsConnection.close();
        this.wsConnection = null;
      }
    };
  }

  private connectWebSocket(): void {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      console.log("[PumpFun] Connecting to PumpPortal WebSocket...");
      this.wsConnection = new WebSocket(PUMPPORTAL_WS);

      this.wsConnection.onopen = () => {
        console.log("[PumpFun] WebSocket connected to PumpPortal");
        this.isConnecting = false;

        const subscribePayload = {
          method: "subscribeNewToken",
        };
        this.wsConnection?.send(JSON.stringify(subscribePayload));
        console.log("[PumpFun] Subscribed to new token events");
      };

      this.wsConnection.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data.toString());

          if (data.txType === "create" && data.mint) {
            const token = this.convertToToken(data as PumpPortalNewToken);

            this.recentTokens.set(token.address, token);

            if (this.recentTokens.size > 500) {
              const oldest = Array.from(this.recentTokens.keys()).slice(0, 100);
              oldest.forEach((key) => this.recentTokens.delete(key));
            }

            console.log(`[PumpFun] New token: ${token.symbol} (${token.name}) - MC: $${token.marketCap.toFixed(0)}`);

            for (const subscriber of this.tokenSubscribers) {
              subscriber(token);
            }
          }
        } catch (err) {
          // Ignore parse errors for heartbeats etc
        }
      };

      this.wsConnection.onerror = (error) => {
        console.error("[PumpFun] WebSocket error:", error);
        this.isConnecting = false;
      };

      this.wsConnection.onclose = () => {
        console.log("[PumpFun] WebSocket closed, reconnecting in 5s...");
        this.wsConnection = null;
        this.isConnecting = false;

        if (this.tokenSubscribers.size > 0) {
          this.reconnectTimeout = setTimeout(() => {
            this.connectWebSocket();
          }, 5000);
        }
      };
    } catch (err) {
      console.error("[PumpFun] Failed to connect WebSocket:", err);
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    this.tokenSubscribers.clear();
    console.log("[PumpFun] Disconnected");
  }
}

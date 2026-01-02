import type {
  Strategy,
  Trade,
  Position,
  EvolutionCycle,
  EvolutionState,
  Treasury,
  TradingStats,
  PopulationStats,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  strategies: {
    getAll: () => fetchApi<Strategy[]>("/api/strategies"),
    getById: (id: string) => fetchApi<Strategy>(`/api/strategies/${id}`),
    getTop: (count: number) => fetchApi<Strategy[]>(`/api/strategies/top/${count}`),
    getGraveyard: () => fetchApi<Strategy[]>("/api/strategies/graveyard"),
    getNeedsFunding: () => fetchApi<Strategy[]>("/api/strategies/needs-funding"),
    getPopulation: () => fetchApi<PopulationStats>("/api/strategies/population"),
    getWithTrades: () => fetchApi<(Strategy & { 
      trades: Trade[]; 
      stats: TradingStats;
      liveStats: { totalTrades: number; openTrades: number; closedTrades: number; realizedPnL: number };
    })[]>("/api/strategies/with-trades"),
    fund: (id: string, amount: number) => 
      fetchApi<{ success: boolean; strategyId: string; fundedAmount: number; newStatus: string }>(
        `/api/strategies/${id}/fund`,
        { method: "POST", body: JSON.stringify({ amount }) }
      ),
  },

  trades: {
    getRecent: () => fetchApi<Trade[]>("/api/trades"),
    getLive: () => fetchApi<{ trades: Trade[]; positions: Position[] }>("/api/trades/live"),
    getByStrategy: (strategyId: string) =>
      fetchApi<Trade[]>(`/api/trades/${strategyId}`),
    getStats: () => fetchApi<TradingStats>("/api/trades/stats"),
    getRecentClosed: () => fetchApi<Trade[]>("/api/trades/recent-closed"),
  },

  evolution: {
    getCurrent: () => fetchApi<EvolutionState>("/api/evolution/current"),
    getHistory: () => fetchApi<EvolutionCycle[]>("/api/evolution/history"),
    getFitnessHistory: () =>
      fetchApi<{ generation: number; avgFitness: number }[]>(
        "/api/evolution/fitness-history"
      ),
    getPnlHistory: () =>
      fetchApi<{ generation: number; totalPnlSol: number }[]>(
        "/api/evolution/pnl-history"
      ),
    triggerCycle: () =>
      fetchApi<{ success: boolean; cycle: EvolutionCycle }>(
        "/api/evolution/trigger",
        { method: "POST" }
      ),
  },

  treasury: {
    get: () => fetchApi<Treasury>("/api/treasury"),
  },
};

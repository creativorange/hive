export interface TradeRecord {
  id: string;
  token: string;
  action: "buy" | "sell";
  amount: number;
  price: number;
  timestamp: Date;
  geneId: string;
}

export interface GenerationRecord {
  id: string;
  generation: number;
  bestFitness: number;
  avgFitness: number;
  timestamp: Date;
}

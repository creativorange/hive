export declare function generateId(): string;
export declare function randomFloat(min: number, max: number): number;
export declare function randomInt(min: number, max: number): number;
export declare function randomChoice<T>(array: readonly T[] | T[]): T;
export declare function randomChoices<T>(array: readonly T[] | T[], count: number): T[];
export declare function shuffleArray<T>(array: T[]): T[];
export declare function clamp(value: number, min: number, max: number): number;
export declare function mutateValue(value: number, mutationRange?: number): number;
export declare function pickFromParents<T>(parent1Value: T, parent2Value: T): T;
export declare function generateStrategyName(): string;
export declare function calculateSharpeRatio(returns: number[], riskFreeRate?: number): number;
export declare function formatSol(amount: number): string;
export declare function formatPercent(value: number): string;
export declare function nowTimestamp(): number;
//# sourceMappingURL=utils.d.ts.map
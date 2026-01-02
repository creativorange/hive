import { v4 as uuidv4 } from "uuid";
export function generateId() {
    return uuidv4();
}
export function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}
export function randomInt(min, max) {
    return Math.floor(randomFloat(min, max + 1));
}
export function randomChoice(array) {
    return array[randomInt(0, array.length - 1)];
}
export function randomChoices(array, count) {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, array.length));
}
export function shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export function mutateValue(value, mutationRange = 0.2) {
    const change = randomFloat(-mutationRange, mutationRange);
    return value * (1 + change);
}
export function pickFromParents(parent1Value, parent2Value) {
    return Math.random() > 0.5 ? parent1Value : parent2Value;
}
export function generateStrategyName() {
    const prefixes = [
        "Alpha", "Beta", "Gamma", "Delta", "Omega", "Sigma", "Theta", "Zeta",
        "Phantom", "Shadow", "Ghost", "Storm", "Thunder", "Lightning", "Blaze",
        "Frost", "Nova", "Stellar", "Quantum", "Cyber", "Neo", "Ultra", "Mega",
        "Hyper", "Turbo", "Swift", "Rapid", "Flash", "Bolt", "Surge"
    ];
    const suffixes = [
        "Hunter", "Trader", "Sniper", "Scout", "Tracker", "Seeker", "Finder",
        "Wolf", "Hawk", "Eagle", "Shark", "Tiger", "Lion", "Bear", "Bull",
        "Warrior", "Knight", "Ninja", "Samurai", "Ronin", "Sentinel", "Guardian",
        "Prophet", "Oracle", "Sage", "Master", "Prime", "Elite", "Apex"
    ];
    return `${randomChoice(prefixes)} ${randomChoice(suffixes)}`;
}
export function calculateSharpeRatio(returns, riskFreeRate = 0) {
    if (returns.length === 0)
        return 0;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0)
        return 0;
    return (avgReturn - riskFreeRate) / stdDev;
}
export function formatSol(amount) {
    return `${amount.toFixed(4)} SOL`;
}
export function formatPercent(value) {
    return `${(value * 100).toFixed(2)}%`;
}
export function nowTimestamp() {
    return Date.now();
}
//# sourceMappingURL=utils.js.map
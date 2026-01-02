"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Strategy, EvolutionCycle } from "@/lib/types";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ARCHETYPE_COLORS } from "@/lib/sprites";

type LabPhase = "idle" | "selection" | "breeding" | "mutation" | "complete";

export function BreedingLab() {
  const [phase, setPhase] = useState<LabPhase>("idle");
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [survivors, setSurvivors] = useState<Strategy[]>([]);
  const [dead, setDead] = useState<Strategy[]>([]);
  const [newborn, setNewborn] = useState<Strategy[]>([]);
  const [lastCycle, setLastCycle] = useState<EvolutionCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const { subscribe } = useWebSocket({ channels: ["evolution"] });

  useEffect(() => {
    async function fetchData() {
      try {
        const [populationData, evolutionData] = await Promise.all([
          api.strategies.getPopulation(),
          api.evolution.getCurrent(),
        ]);
        setStrategies(populationData.strategies);
        setLastCycle(evolutionData.lastCycle);
      } catch (error) {
        console.error("Failed to fetch lab data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    const unsub = subscribe("evolution:cycle", (cycle: EvolutionCycle) => {
      setLastCycle(cycle);
      runEvolutionAnimation(cycle);
    });

    return unsub;
  }, [subscribe]);

  const runEvolutionAnimation = useCallback(async (cycle: EvolutionCycle) => {
    setPhase("selection");
    await sleep(2000);

    const survivorStrategies = strategies.filter((s) =>
      cycle.survivors.includes(s.id)
    );
    const deadStrategies = strategies.filter((s) => cycle.dead.includes(s.id));

    setSurvivors(survivorStrategies);
    setDead(deadStrategies);

    setPhase("breeding");
    await sleep(2000);

    setPhase("mutation");
    await sleep(2000);

    setPhase("complete");
    await sleep(3000);

    setPhase("idle");
    setSurvivors([]);
    setDead([]);
    setNewborn([]);

    const populationData = await api.strategies.getPopulation();
    setStrategies(populationData.strategies);
  }, [strategies]);

  const triggerEvolution = async () => {
    if (triggering) return;

    setTriggering(true);
    try {
      await api.evolution.triggerCycle();
    } catch (error) {
      console.error("Failed to trigger evolution:", error);
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-meta-bg-card border-2 border-meta-cyan p-4">
        <div className="h-80 bg-meta-bg-light animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-pixel text-sm text-meta-cyan">BREEDING LAB</h2>
        <button
          onClick={triggerEvolution}
          disabled={triggering || phase !== "idle"}
          className={`font-pixel text-[8px] px-4 py-2 border-2 transition-all ${
            triggering || phase !== "idle"
              ? "border-meta-green/30 text-meta-green/30 cursor-not-allowed"
              : "border-meta-gold text-meta-gold hover:bg-meta-gold hover:text-meta-bg"
          }`}
        >
          {triggering ? "EVOLVING..." : "TRIGGER EVOLUTION"}
        </button>
      </div>

      <div className="bg-meta-bg-card border-2 border-meta-cyan/50 p-6 min-h-80">
        {phase === "idle" ? (
          <IdleState strategies={strategies} lastCycle={lastCycle} />
        ) : (
          <EvolutionAnimation
            phase={phase}
            strategies={strategies}
            survivors={survivors}
            dead={dead}
            newborn={newborn}
          />
        )}
      </div>
    </div>
  );
}

function IdleState({
  strategies,
  lastCycle,
}: {
  strategies: Strategy[];
  lastCycle: EvolutionCycle | null;
}) {
  const sortedByFitness = [...strategies].sort(
    (a, b) => b.performance.fitnessScore - a.performance.fitnessScore
  );

  const survivorCount = Math.floor(strategies.length * 0.2);
  const deadCount = Math.floor(strategies.length * 0.2);

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <p className="font-pixel text-[8px] text-meta-green/50">
          NEXT EVOLUTION PREVIEW
        </p>
        {lastCycle && (
          <p className="font-pixel text-[6px] text-meta-green/30 mt-1">
            LAST CYCLE: GEN {lastCycle.generation} |{" "}
            {new Date(lastCycle.cycleTimestamp).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-meta-green/30 p-3">
          <p className="font-pixel text-[7px] text-meta-green mb-2">
            SURVIVORS (TOP 20%)
          </p>
          <div className="space-y-1">
            {sortedByFitness.slice(0, survivorCount).map((s) => (
              <StrategyChip key={s.id} strategy={s} highlight="green" />
            ))}
          </div>
        </div>

        <div className="border border-meta-cyan/30 p-3">
          <p className="font-pixel text-[7px] text-meta-cyan mb-2">
            MUTATORS (60%)
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {sortedByFitness
              .slice(survivorCount, -deadCount)
              .slice(0, 10)
              .map((s) => (
                <StrategyChip key={s.id} strategy={s} highlight="cyan" />
              ))}
            {strategies.length > survivorCount + deadCount + 10 && (
              <p className="font-pixel text-[5px] text-meta-cyan/50">
                +{strategies.length - survivorCount - deadCount - 10} more
              </p>
            )}
          </div>
        </div>

        <div className="border border-meta-red/30 p-3">
          <p className="font-pixel text-[7px] text-meta-red mb-2">
            DEATH ROW (BOTTOM 20%)
          </p>
          <div className="space-y-1">
            {sortedByFitness.slice(-deadCount).map((s) => (
              <StrategyChip key={s.id} strategy={s} highlight="red" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EvolutionAnimation({
  phase,
  strategies,
  survivors,
  dead,
}: {
  phase: LabPhase;
  strategies: Strategy[];
  survivors: Strategy[];
  dead: Strategy[];
  newborn: Strategy[];
}) {
  return (
    <div className="relative h-64">
      <AnimatePresence mode="wait">
        {phase === "selection" && (
          <motion.div
            key="selection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <p className="font-pixel text-lg text-meta-gold text-glow">
                SELECTION PHASE
              </p>
            </motion.div>
            <p className="font-pixel text-[8px] text-meta-green/50 mt-4">
              Evaluating fitness scores...
            </p>

            <div className="flex gap-8 mt-6">
              <div className="text-center">
                <p className="font-pixel text-sm text-meta-green">
                  {survivors.length}
                </p>
                <p className="font-pixel text-[6px] text-meta-green/50">
                  SURVIVORS
                </p>
              </div>
              <div className="text-center">
                <p className="font-pixel text-sm text-meta-red">{dead.length}</p>
                <p className="font-pixel text-[6px] text-meta-red/50">DYING</p>
              </div>
            </div>
          </motion.div>
        )}

        {phase === "breeding" && (
          <motion.div
            key="breeding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <DNAHelix />
            <p className="font-pixel text-lg text-meta-cyan text-glow mt-4">
              BREEDING PHASE
            </p>
            <p className="font-pixel text-[8px] text-meta-green/50 mt-2">
              Crossing genetic material...
            </p>
          </motion.div>
        )}

        {phase === "mutation" && (
          <motion.div
            key="mutation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <motion.div
              animate={{
                rotate: [0, 5, -5, 0],
                scale: [1, 1.05, 0.95, 1],
              }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="text-6xl"
            >
              🧬
            </motion.div>
            <p className="font-pixel text-lg text-meta-gold text-glow mt-4">
              MUTATION PHASE
            </p>
            <p className="font-pixel text-[8px] text-meta-green/50 mt-2">
              Applying random mutations...
            </p>
          </motion.div>
        )}

        {phase === "complete" && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: 3, duration: 0.5 }}
            >
              <p className="font-pixel text-2xl text-meta-green text-glow">
                EVOLUTION COMPLETE
              </p>
            </motion.div>
            <p className="font-pixel text-[8px] text-meta-cyan mt-4">
              New generation ready
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DNAHelix() {
  return (
    <div className="relative w-20 h-32">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-full flex justify-between"
          style={{ top: `${i * 12.5}%` }}
          animate={{
            x: [0, 10, 0, -10, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
            delay: i * 0.1,
          }}
        >
          <div className="w-3 h-3 rounded-full bg-meta-cyan" />
          <div className="flex-1 h-0.5 bg-meta-green/30 self-center mx-1" />
          <div className="w-3 h-3 rounded-full bg-meta-gold" />
        </motion.div>
      ))}
    </div>
  );
}

function StrategyChip({
  strategy,
  highlight,
}: {
  strategy: Strategy;
  highlight: "green" | "cyan" | "red";
}) {
  const borderColor = {
    green: "border-meta-green/50",
    cyan: "border-meta-cyan/50",
    red: "border-meta-red/50",
  }[highlight];

  return (
    <div
      className={`flex items-center justify-between p-1 border ${borderColor} bg-meta-bg-light`}
    >
      <span className="font-pixel text-[5px] text-meta-green truncate flex-1">
        {strategy.name?.slice(0, 10) || strategy.id.slice(0, 8)}
      </span>
      <span
        className="font-pixel text-[5px] ml-2"
        style={{ color: ARCHETYPE_COLORS[strategy.archetype ?? "momentum"] }}
      >
        {strategy.performance.fitnessScore.toFixed(0)}
      </span>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

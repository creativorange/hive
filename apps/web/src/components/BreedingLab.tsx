"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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

  if (loading) {
    return (
      <div className="bg-roman-bg-card border-2 border-roman-purple-light p-4">
        <div className="h-80 bg-roman-bg-light animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-roman-text">THE SENATE</h2>
      </div>

      <div className="bg-roman-bg-card border-2 border-roman-purple-light/50 p-6 min-h-80">
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
        <p className="font-serif text-lg text-roman-text">
          SUCCESSION FORECAST
        </p>
        {lastCycle && (
          <p className="font-serif text-sm text-roman-stone mt-1">
            LAST DECREE: GEN {lastCycle.generation} |{" "}
            {new Date(lastCycle.cycleTimestamp).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-roman-stone/30 p-3">
          <p className="font-serif text-xl text-roman-text mb-2">
            PATRICIANS (TOP 20%)
          </p>
          <div className="space-y-1">
            {sortedByFitness.slice(0, survivorCount).map((s) => (
              <StrategyChip key={s.id} strategy={s} highlight="green" />
            ))}
          </div>
        </div>

        <div className="border border-roman-stone/30 p-3">
          <p className="font-serif text-xl text-roman-text mb-2">
            PLEBEIANS (60%)
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {sortedByFitness
              .slice(survivorCount, -deadCount)
              .slice(0, 10)
              .map((s) => (
                <StrategyChip key={s.id} strategy={s} highlight="cyan" />
              ))}
            {strategies.length > survivorCount + deadCount + 10 && (
              <p className="font-serif text-sm text-roman-stone">
                +{strategies.length - survivorCount - deadCount - 10} more
              </p>
            )}
          </div>
        </div>

        <div className="border border-roman-stone/30 p-3">
          <p className="font-serif text-xl text-roman-text mb-2">
            EXILED (BOTTOM 20%)
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
              <p className="font-serif text-3xl text-roman-text text-glow">
                JUDGMENT PHASE
              </p>
            </motion.div>
            <p className="font-serif text-lg text-roman-stone mt-4">
              Evaluating worthiness...
            </p>

            <div className="flex gap-8 mt-6">
              <div className="text-center">
                <p className="font-serif text-xl text-roman-text">
                  {survivors.length}
                </p>
                <p className="font-serif text-sm text-roman-stone">
                  PATRICIANS
                </p>
              </div>
              <div className="text-center">
                <p className="font-serif text-xl text-roman-crimson">{dead.length}</p>
                <p className="font-serif text-sm text-roman-stone">EXILED</p>
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
            <p className="font-serif text-3xl text-roman-text text-glow mt-4">
              LINEAGE PHASE
            </p>
            <p className="font-serif text-lg text-roman-stone mt-2">
              Forging new bloodlines...
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
            <p className="font-serif text-3xl text-roman-text text-glow mt-4">
              TRANSFORMATION PHASE
            </p>
            <p className="font-serif text-lg text-roman-stone mt-2">
              Divine intervention...
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
              <p className="font-serif text-3xl text-roman-text text-glow">
                SUCCESSION COMPLETE
              </p>
            </motion.div>
            <p className="font-serif text-lg text-roman-stone mt-4">
              New dynasty rises
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
          <div className="w-3 h-3 rounded-full bg-roman-text" />
          <div className="flex-1 h-0.5 bg-roman-stone/50 self-center mx-1" />
          <div className="w-3 h-3 rounded-full bg-roman-stone" />
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
    green: "border-roman-gold/50",
    cyan: "border-roman-purple-light/50",
    red: "border-roman-crimson/50",
  }[highlight];

  return (
    <Link
      href={`/strategy/${strategy.id}`}
      className={`flex items-center justify-between p-2 border ${borderColor} bg-roman-bg-light hover:bg-roman-bg-card transition-colors`}
    >
      <span className="font-serif text-base text-roman-text truncate flex-1">
        {strategy.name?.slice(0, 10) || strategy.id.slice(0, 8)}
      </span>
      <span
        className="font-serif text-base ml-2 font-semibold"
        style={{ color: ARCHETYPE_COLORS[strategy.archetype ?? "momentum"] }}
      >
        {strategy.performance.fitnessScore.toFixed(0)}
      </span>
    </Link>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

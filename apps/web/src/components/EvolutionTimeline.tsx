"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { EvolutionCycle } from "@/lib/types";
import { api } from "@/lib/api";

interface FitnessData {
  generation: number;
  avgFitness: number;
  bestFitness?: number;
}

export function EvolutionTimeline() {
  const [cycles, setCycles] = useState<EvolutionCycle[]>([]);
  const [fitnessHistory, setFitnessHistory] = useState<FitnessData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"timeline" | "chart">("timeline");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [cyclesData, fitnessData] = await Promise.all([
          api.evolution.getHistory(),
          api.evolution.getFitnessHistory(),
        ]);
        setCycles(cyclesData.slice(0, 20));
        setFitnessHistory(fitnessData);
      } catch (error) {
        console.error("Failed to fetch evolution data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    if (scrollRef.current && cycles.length > 0) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [cycles]);

  if (loading) {
    return (
      <div className="bg-meta-bg-card border-2 border-meta-green p-4">
        <div className="h-40 bg-meta-bg-light animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-meta-bg-card border-2 border-meta-green p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-sm text-meta-cyan">EVOLUTION TIMELINE</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView("timeline")}
            className={`font-pixel text-[6px] px-2 py-1 border ${
              view === "timeline"
                ? "border-meta-cyan text-meta-cyan"
                : "border-meta-green/30 text-meta-green/50"
            }`}
          >
            TIMELINE
          </button>
          <button
            onClick={() => setView("chart")}
            className={`font-pixel text-[6px] px-2 py-1 border ${
              view === "chart"
                ? "border-meta-cyan text-meta-cyan"
                : "border-meta-green/30 text-meta-green/50"
            }`}
          >
            CHART
          </button>
        </div>
      </div>

      {view === "timeline" ? (
        <div
          ref={scrollRef}
          className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-meta-green"
        >
          <div className="flex gap-4 min-w-max">
            {cycles.length === 0 ? (
              <p className="font-pixel text-[8px] text-meta-green/50 py-8">
                NO EVOLUTION CYCLES YET
              </p>
            ) : (
              cycles.map((cycle, index) => (
                <CycleNode key={cycle.id} cycle={cycle} index={index} />
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="h-60">
          {fitnessHistory.length === 0 ? (
            <p className="font-pixel text-[8px] text-meta-green/50 text-center py-8">
              NO FITNESS DATA YET
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fitnessHistory}>
                <XAxis
                  dataKey="generation"
                  stroke="#00FF41"
                  tick={{ fill: "#00FF41", fontSize: 8 }}
                  tickLine={{ stroke: "#00FF41" }}
                />
                <YAxis
                  stroke="#00FF41"
                  tick={{ fill: "#00FF41", fontSize: 8 }}
                  tickLine={{ stroke: "#00FF41" }}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a24",
                    border: "1px solid #00FF41",
                    fontFamily: '"Press Start 2P"',
                    fontSize: 8,
                  }}
                  labelStyle={{ color: "#00FF41" }}
                />
                <Line
                  type="monotone"
                  dataKey="avgFitness"
                  stroke="#00D9FF"
                  strokeWidth={2}
                  dot={{ fill: "#00D9FF", r: 3 }}
                  name="Avg Fitness"
                />
                <Line
                  type="monotone"
                  dataKey="bestFitness"
                  stroke="#FFD700"
                  strokeWidth={2}
                  dot={{ fill: "#FFD700", r: 3 }}
                  name="Best Fitness"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

function CycleNode({ cycle, index }: { cycle: EvolutionCycle; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const fitnessColor =
    cycle.avgFitness >= 70
      ? "#00FF41"
      : cycle.avgFitness >= 50
      ? "#FFD700"
      : "#FF0051";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className="flex flex-col items-center"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative group"
      >
        <div
          className="w-16 h-16 border-2 flex items-center justify-center transition-all group-hover:scale-110"
          style={{ borderColor: fitnessColor }}
        >
          <span className="font-pixel text-lg" style={{ color: fitnessColor }}>
            {cycle.generation}
          </span>
        </div>

        <div className="absolute -top-1 -right-1 flex gap-0.5">
          {cycle.newlyBorn.length > 0 && (
            <span className="font-pixel text-[5px] px-1 bg-meta-cyan text-meta-bg">
              +{cycle.newlyBorn.length}
            </span>
          )}
          {cycle.dead.length > 0 && (
            <span className="font-pixel text-[5px] px-1 bg-meta-red text-meta-bg">
              -{cycle.dead.length}
            </span>
          )}
        </div>
      </button>

      <div className="mt-2 text-center">
        <p className="font-pixel text-[6px] text-meta-gold">
          {cycle.avgFitness.toFixed(1)}
        </p>
        <p className="font-pixel text-[5px] text-meta-green/30">
          {new Date(cycle.cycleTimestamp).toLocaleDateString()}
        </p>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full mt-2 left-0 bg-meta-bg-card border border-meta-green p-2 z-10 min-w-32"
        >
          <p className="font-pixel text-[6px] text-meta-green mb-1">
            GEN {cycle.generation}
          </p>
          <div className="space-y-1 text-[5px]">
            <p className="text-meta-cyan">
              SURVIVORS: {cycle.survivors.length}
            </p>
            <p className="text-meta-green">BORN: {cycle.newlyBorn.length}</p>
            <p className="text-meta-red">DEAD: {cycle.dead.length}</p>
            <p className="text-meta-gold">
              BEST: {cycle.bestFitness.toFixed(1)}
            </p>
            <p className="text-meta-green/50">
              PNL: {cycle.totalPnlSol.toFixed(4)} SOL
            </p>
          </div>
        </motion.div>
      )}

      {index < 19 && (
        <div className="absolute left-full top-1/2 w-4 h-0.5 bg-meta-green/30" />
      )}
    </motion.div>
  );
}

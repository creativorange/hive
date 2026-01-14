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
      <div className="bg-roman-bg-card border-2 border-roman-gold p-4">
        <div className="h-40 bg-roman-bg-light animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-roman-bg-card border-2 border-roman-gold p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg text-roman-text">DYNASTY TIMELINE</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView("timeline")}
            className={`font-serif text-sm px-2 py-1 border ${
              view === "timeline"
                ? "border-roman-text text-roman-text"
                : "border-roman-stone text-roman-stone"
            }`}
          >
            LINEAGE
          </button>
          <button
            onClick={() => setView("chart")}
            className={`font-serif text-sm px-2 py-1 border ${
              view === "chart"
                ? "border-roman-text text-roman-text"
                : "border-roman-stone text-roman-stone"
            }`}
          >
            PROSPERITY
          </button>
        </div>
      </div>

      {view === "timeline" ? (
        <div
          ref={scrollRef}
          className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-roman-gold"
        >
          <div className="flex gap-4 min-w-max">
            {cycles.length === 0 ? (
              <p className="font-serif text-base text-roman-stone py-8">
                NO DYNASTIES RECORDED
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
            <p className="font-serif text-base text-roman-stone text-center py-8">
              NO PROSPERITY DATA YET
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fitnessHistory}>
                <XAxis
                  dataKey="generation"
                  stroke="#3D2B1F"
                  tick={{ fill: "#3D2B1F", fontSize: 12 }}
                  tickLine={{ stroke: "#3D2B1F" }}
                />
                <YAxis
                  stroke="#3D2B1F"
                  tick={{ fill: "#3D2B1F", fontSize: 12 }}
                  tickLine={{ stroke: "#3D2B1F" }}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FBF7F0",
                    border: "1px solid #3D2B1F",
                    fontFamily: 'serif',
                    fontSize: 14,
                    color: "#3D2B1F",
                  }}
                  labelStyle={{ color: "#3D2B1F" }}
                />
                <Line
                  type="monotone"
                  dataKey="avgFitness"
                  stroke="#7D3C98"
                  strokeWidth={2}
                  dot={{ fill: "#7D3C98", r: 3 }}
                  name="Avg Fitness"
                />
                <Line
                  type="monotone"
                  dataKey="bestFitness"
                  stroke="#F4D03F"
                  strokeWidth={2}
                  dot={{ fill: "#F4D03F", r: 3 }}
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
      ? "#D4AF37"
      : cycle.avgFitness >= 50
      ? "#F4D03F"
      : "#8B0000";

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
          <span className="font-serif text-lg" style={{ color: fitnessColor }}>
            {cycle.generation}
          </span>
        </div>

        <div className="absolute -top-1 -right-1 flex gap-0.5">
          {cycle.newlyBorn.length > 0 && (
            <span className="font-serif text-xs px-1 bg-roman-purple-light text-roman-bg">
              +{cycle.newlyBorn.length}
            </span>
          )}
          {cycle.dead.length > 0 && (
            <span className="font-serif text-xs px-1 bg-roman-crimson text-roman-bg">
              -{cycle.dead.length}
            </span>
          )}
        </div>
      </button>

      <div className="mt-2 text-center">
        <p className="font-serif text-sm text-roman-stone">
          {cycle.avgFitness.toFixed(1)}
        </p>
        <p className="font-serif text-xs text-roman-stone">
          {new Date(cycle.cycleTimestamp).toLocaleDateString()}
        </p>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full mt-2 left-0 bg-roman-bg-card border border-roman-gold p-2 z-10 min-w-32"
        >
          <p className="font-serif text-sm text-roman-text mb-1">
            GEN {cycle.generation}
          </p>
          <div className="space-y-1 text-xs">
            <p className="text-roman-text">
              SURVIVORS: {cycle.survivors.length}
            </p>
            <p className="text-roman-stone">BORN: {cycle.newlyBorn.length}</p>
            <p className="text-roman-crimson">DEAD: {cycle.dead.length}</p>
            <p className="text-roman-stone">
              BEST: {cycle.bestFitness.toFixed(1)}
            </p>
            <p className="text-roman-stone">
              PNL: {cycle.totalPnlSol.toFixed(4)} SOL
            </p>
          </div>
        </motion.div>
      )}

      {index < 19 && (
        <div className="absolute left-full top-1/2 w-4 h-0.5 bg-roman-stone" />
      )}
    </motion.div>
  );
}

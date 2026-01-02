"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import type { Strategy } from "@/lib/types";
import { api } from "@/lib/api";
import { generatePixelAvatar, ARCHETYPE_COLORS } from "@/lib/sprites";

interface GravestoneProps {
  strategy: Strategy;
  index: number;
}

export function Graveyard() {
  const [deadStrategies, setDeadStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "generation" | "archetype">("all");
  const [selectedGen, setSelectedGen] = useState<number | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await api.strategies.getGraveyard();
        setDeadStrategies(data);
      } catch (error) {
        console.error("Failed to fetch graveyard:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const generations = [...new Set(deadStrategies.map((s) => s.generation))].sort(
    (a, b) => b - a
  );
  const archetypes = [...new Set(deadStrategies.map((s) => s.archetype).filter(Boolean))];

  const filteredStrategies = deadStrategies.filter((s) => {
    if (filter === "generation" && selectedGen !== null) {
      return s.generation === selectedGen;
    }
    if (filter === "archetype" && selectedArchetype) {
      return s.archetype === selectedArchetype;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="bg-meta-bg-card border-2 border-meta-red p-4">
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-meta-bg-light animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-pixel text-sm text-meta-red">
          GRAVEYARD ({deadStrategies.length} FALLEN)
        </h2>

        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as "all" | "generation" | "archetype");
              setSelectedGen(null);
              setSelectedArchetype(null);
            }}
            className="font-pixel text-[6px] bg-meta-bg-card border border-meta-green/30 text-meta-green px-2 py-1"
          >
            <option value="all">ALL</option>
            <option value="generation">BY GEN</option>
            <option value="archetype">BY TYPE</option>
          </select>

          {filter === "generation" && (
            <select
              value={selectedGen ?? ""}
              onChange={(e) => setSelectedGen(Number(e.target.value))}
              className="font-pixel text-[6px] bg-meta-bg-card border border-meta-green/30 text-meta-green px-2 py-1"
            >
              <option value="">SELECT GEN</option>
              {generations.map((gen) => (
                <option key={gen} value={gen}>
                  GEN {gen}
                </option>
              ))}
            </select>
          )}

          {filter === "archetype" && (
            <select
              value={selectedArchetype ?? ""}
              onChange={(e) => setSelectedArchetype(e.target.value)}
              className="font-pixel text-[6px] bg-meta-bg-card border border-meta-green/30 text-meta-green px-2 py-1"
            >
              <option value="">SELECT TYPE</option>
              {archetypes.map((type) => (
                <option key={type} value={type ?? ""}>
                  {type?.toUpperCase()}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="bg-meta-bg-card border-2 border-meta-red/50 p-4">
        {filteredStrategies.length === 0 ? (
          <p className="font-pixel text-[8px] text-meta-red/50 text-center py-8">
            NO FALLEN STRATEGIES
          </p>
        ) : (
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {filteredStrategies.map((strategy, index) => (
              <Gravestone key={strategy.id} strategy={strategy} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Gravestone({ strategy, index }: GravestoneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      const avatar = generatePixelAvatar(strategy.id, 24);
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.filter = "grayscale(100%)";
        ctx.globalAlpha = 0.5;
        ctx.clearRect(0, 0, 24, 24);
        ctx.drawImage(avatar, 0, 0);
      }
    }
  }, [strategy.id]);

  const deathDate = strategy.deathTimestamp
    ? new Date(strategy.deathTimestamp).toLocaleDateString()
    : "UNKNOWN";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="relative group"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <div className="bg-meta-bg-light border border-meta-red/30 p-2 flex flex-col items-center cursor-pointer hover:border-meta-red transition-colors">
        <div className="relative mb-2">
          <canvas
            ref={canvasRef}
            width={24}
            height={24}
            className="pixelated opacity-50"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-pixel text-[10px] text-meta-red">†</span>
          </div>
        </div>

        <p className="font-pixel text-[5px] text-meta-green/50 text-center truncate w-full">
          {strategy.name?.slice(0, 8) || strategy.id.slice(0, 6)}
        </p>

        <p className="font-pixel text-[4px] text-meta-red/50">
          GEN {strategy.generation}
        </p>
      </div>

      {showDetails && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-meta-bg-card border border-meta-red p-2 z-20 min-w-36"
        >
          <p className="font-pixel text-[6px] text-meta-red mb-1">
            {strategy.name || `STRATEGY-${strategy.id.slice(0, 8)}`}
          </p>

          <div className="space-y-1 text-[5px]">
            <p className="text-meta-green/50">
              ARCHETYPE:{" "}
              <span
                style={{
                  color: ARCHETYPE_COLORS[strategy.archetype ?? "momentum"],
                }}
              >
                {strategy.archetype?.toUpperCase()}
              </span>
            </p>
            <p className="text-meta-green/50">
              FINAL PNL:{" "}
              <span
                className={
                  strategy.performance.totalPnL >= 0
                    ? "text-meta-green"
                    : "text-meta-red"
                }
              >
                {strategy.performance.totalPnL.toFixed(4)} SOL
              </span>
            </p>
            <p className="text-meta-green/50">
              WIN RATE:{" "}
              <span className="text-meta-cyan">
                {(strategy.performance.winRate * 100).toFixed(1)}%
              </span>
            </p>
            <p className="text-meta-green/50">
              TRADES: {strategy.performance.tradesExecuted}
            </p>
            <p className="text-meta-green/50">
              FINAL FITNESS: {strategy.performance.fitnessScore.toFixed(1)}
            </p>
            <p className="text-meta-red/70">DIED: {deathDate}</p>
          </div>

          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-meta-red" />
        </motion.div>
      )}
    </motion.div>
  );
}

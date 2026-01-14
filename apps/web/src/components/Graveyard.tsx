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
      <div className="bg-roman-bg border-2 border-roman-crimson p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-roman-bg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-roman-crimson">
          CATACOMBS ({deadStrategies.length} FALLEN)
        </h2>

        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as "all" | "generation" | "archetype");
              setSelectedGen(null);
              setSelectedArchetype(null);
            }}
            className="font-serif text-sm bg-roman-bg border border-roman-text/30 text-roman-text px-2 py-1"
          >
            <option value="all">ALL</option>
            <option value="generation">BY GEN</option>
            <option value="archetype">BY TYPE</option>
          </select>

          {filter === "generation" && (
            <select
              value={selectedGen ?? ""}
              onChange={(e) => setSelectedGen(Number(e.target.value))}
              className="font-serif text-sm bg-roman-bg border border-roman-text/30 text-roman-text px-2 py-1"
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
              className="font-serif text-sm bg-roman-bg border border-roman-text/30 text-roman-text px-2 py-1"
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

      <div className="bg-roman-bg border-2 border-roman-crimson/50 p-4">
        {filteredStrategies.length === 0 ? (
          <p className="font-serif text-sm text-roman-crimson/70 text-center py-8">
            NO FALLEN LEGIONS
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
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
      <div className="bg-roman-bg border border-roman-crimson/30 p-2 flex flex-col items-center cursor-pointer hover:border-roman-crimson transition-colors">
        <div className="relative mb-2">
          <canvas
            ref={canvasRef}
            width={24}
            height={24}
            className="pixelated opacity-50"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-lg text-roman-crimson font-bold">†</span>
          </div>
        </div>

        <p className="font-serif text-xs text-roman-text text-center truncate w-full">
          {strategy.name?.slice(0, 8) || strategy.id.slice(0, 6)}
        </p>

        <p className="font-serif text-xs text-roman-crimson/70">
          GEN {strategy.generation}
        </p>
      </div>

      {showDetails && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-roman-bg-card border border-roman-crimson p-3 z-20 min-w-44 shadow-lg"
        >
          <p className="font-serif text-sm text-roman-crimson mb-2">
            {strategy.name || `STRATEGY-${strategy.id.slice(0, 8)}`}
          </p>

          <div className="space-y-1 text-xs font-serif">
            <p className="text-roman-text">
              ARCHETYPE:{" "}
              <span
                style={{
                  color: ARCHETYPE_COLORS[strategy.archetype ?? "momentum"],
                }}
              >
                {strategy.archetype?.toUpperCase()}
              </span>
            </p>
            <p className="text-roman-text">
              FINAL PNL:{" "}
              <span
                className={
                  strategy.performance.totalPnL >= 0
                    ? "text-roman-gold"
                    : "text-roman-crimson"
                }
              >
                {strategy.performance.totalPnL.toFixed(4)} SOL
              </span>
            </p>
            <p className="text-roman-text">
              WIN RATE:{" "}
              <span className="text-roman-purple-light">
                {(strategy.performance.winRate * 100).toFixed(1)}%
              </span>
            </p>
            <p className="text-roman-text">
              TRADES: {strategy.performance.tradesExecuted}
            </p>
            <p className="text-roman-text">
              FINAL FITNESS: {strategy.performance.fitnessScore.toFixed(1)}
            </p>
            <p className="text-roman-crimson">DIED: {deathDate}</p>
          </div>

          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-roman-crimson" />
        </motion.div>
      )}
    </motion.div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Strategy } from "@/lib/types";
import { generatePixelAvatar, ARCHETYPE_COLORS } from "@/lib/sprites";

interface StrategyCardProps {
  strategy: Strategy;
  rank?: number;
  onClick?: () => void;
  compact?: boolean;
}

export function StrategyCard({ strategy, rank, onClick, compact = false }: StrategyCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(false);

  const archetypeColor = ARCHETYPE_COLORS[strategy.archetype ?? "momentum"] || "#00FF41";
  const pnlColor = strategy.performance.totalPnL >= 0 ? "#00FF41" : "#FF0051";
  const fitnessPercent = strategy.performance.fitnessScore / 100;

  useEffect(() => {
    if (canvasRef.current) {
      const avatar = generatePixelAvatar(strategy.id, 32);
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 32, 32);
        ctx.drawImage(avatar, 0, 0);
      }
    }
  }, [strategy.id]);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ scale: 1.02 }}
        onClick={onClick}
        className="bg-meta-bg-card p-2 border border-meta-green/30 flex items-center gap-2 cursor-pointer hover:border-meta-cyan transition-colors"
      >
        <canvas ref={canvasRef} width={32} height={32} className="pixelated" />
        <div className="flex-1 min-w-0">
          <p className="font-pixel text-[6px] text-meta-green truncate">
            {strategy.name || `STR-${strategy.id.slice(0, 6)}`}
          </p>
          <p
            className="font-pixel text-[6px]"
            style={{ color: pnlColor }}
          >
            {strategy.performance.totalPnL >= 0 ? "+" : ""}
            {strategy.performance.totalPnL.toFixed(4)} SOL
          </p>
        </div>
        <div className="text-right">
          <p className="font-pixel text-[6px] text-meta-gold">
            {strategy.performance.fitnessScore.toFixed(0)}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => setExpanded(!expanded)}
      className="bg-meta-bg-card p-4 border-2 cursor-pointer transition-all"
      style={{ borderColor: archetypeColor }}
    >
      <div className="flex items-start gap-4">
        {rank !== undefined && (
          <div
            className="font-pixel text-lg text-glow"
            style={{ color: rank <= 3 ? "#FFD700" : archetypeColor }}
          >
            #{rank}
          </div>
        )}

        <canvas ref={canvasRef} width={32} height={32} className="pixelated" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-pixel text-[8px] text-meta-green truncate">
              {strategy.name || `STRATEGY-${strategy.id.slice(0, 8)}`}
            </p>
            <span
              className="font-pixel text-[6px] px-1 rounded"
              style={{ backgroundColor: archetypeColor, color: "#0a0a0f" }}
            >
              {strategy.archetype?.toUpperCase() || "UNKNOWN"}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-2">
            <div>
              <p className="font-pixel text-[5px] text-meta-green/50">PNL</p>
              <p
                className="font-pixel text-[8px] text-glow"
                style={{ color: pnlColor }}
              >
                {strategy.performance.totalPnL >= 0 ? "+" : ""}
                {strategy.performance.totalPnL.toFixed(4)} SOL
              </p>
            </div>

            <div>
              <p className="font-pixel text-[5px] text-meta-green/50">WIN RATE</p>
              <p className="font-pixel text-[8px] text-meta-cyan">
                {(strategy.performance.winRate * 100).toFixed(1)}%
              </p>
            </div>

            <div>
              <p className="font-pixel text-[5px] text-meta-green/50">TRADES</p>
              <p className="font-pixel text-[8px] text-meta-green">
                {strategy.performance.tradesExecuted}
              </p>
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <p className="font-pixel text-[5px] text-meta-green/50">FITNESS</p>
              <p className="font-pixel text-[6px] text-meta-gold">
                {strategy.performance.fitnessScore.toFixed(1)}
              </p>
            </div>
            <div className="health-bar">
              <div
                className="health-bar-fill"
                style={{
                  width: `${fitnessPercent * 100}%`,
                  backgroundColor: archetypeColor,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-meta-green/30"
        >
          <p className="font-pixel text-[6px] text-meta-cyan mb-2">GENES</p>
          <div className="grid grid-cols-2 gap-2 text-[5px]">
            <div>
              <span className="text-meta-green/50">MCAP RANGE:</span>{" "}
              <span className="text-meta-green">
                ${strategy.genes.entryMcapMin.toFixed(0)} - ${strategy.genes.entryMcapMax.toFixed(0)}
              </span>
            </div>
            <div>
              <span className="text-meta-green/50">TP:</span>{" "}
              <span className="text-meta-green">{strategy.genes.takeProfitMultiplier.toFixed(1)}x</span>
            </div>
            <div>
              <span className="text-meta-green/50">SL:</span>{" "}
              <span className="text-meta-red">{(strategy.genes.stopLossMultiplier * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-meta-green/50">TIME EXIT:</span>{" "}
              <span className="text-meta-green">{strategy.genes.timeBasedExit}min</span>
            </div>
          </div>

          <p className="font-pixel text-[6px] text-meta-cyan mt-3 mb-1">PATTERNS</p>
          <div className="flex flex-wrap gap-1">
            {strategy.genes.buyPatterns.map((pattern) => (
              <span
                key={pattern}
                className="font-pixel text-[5px] px-1 py-0.5 bg-meta-bg-light border border-meta-green/30 text-meta-green"
              >
                {pattern}
              </span>
            ))}
          </div>

          <p className="font-pixel text-[6px] text-meta-cyan mt-3 mb-1">KEYWORDS</p>
          <div className="flex flex-wrap gap-1">
            {strategy.genes.tokenNameKeywords.map((keyword) => (
              <span
                key={keyword}
                className="font-pixel text-[5px] px-1 py-0.5 bg-meta-bg-light border border-meta-cyan/30 text-meta-cyan"
              >
                {keyword}
              </span>
            ))}
          </div>

          {strategy.parentIds.length > 0 && (
            <div className="mt-3">
              <p className="font-pixel text-[6px] text-meta-green/50">
                PARENTS: {strategy.parentIds.map((id) => id.slice(0, 6)).join(", ")}
              </p>
            </div>
          )}

          <p className="font-pixel text-[5px] text-meta-green/30 mt-2">
            GEN {strategy.generation} • BORN {new Date(strategy.birthTimestamp).toLocaleDateString()}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

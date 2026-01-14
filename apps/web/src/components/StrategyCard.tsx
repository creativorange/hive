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

  const archetypeColor = ARCHETYPE_COLORS[strategy.archetype ?? "momentum"] || "#8B7355";
  const pnlPositive = strategy.performance.totalPnL >= 0;
  const fitnessPercent = strategy.performance.fitnessScore / 100;

  useEffect(() => {
    if (canvasRef.current) {
      const avatar = generatePixelAvatar(strategy.id, 40);
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 40, 40);
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
        className="roman-tablet p-3 min-h-[56px] border-2 border-roman-stone/50 flex items-center gap-3 cursor-pointer hover:border-roman-stone transition-colors"
      >
        <canvas ref={canvasRef} width={40} height={40} className="flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-serif text-base text-roman-text truncate">
            {strategy.name || `STR-${strategy.id.slice(0, 6)}`}
          </p>
          <p className={`font-serif text-sm font-semibold ${pnlPositive ? "text-emerald-700" : "text-red-800"}`}>
            {pnlPositive ? "+" : ""}
            {strategy.performance.totalPnL.toFixed(4)} SOL
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-serif text-lg text-roman-text font-bold">
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
      whileHover={{ scale: 1.01 }}
      onClick={() => setExpanded(!expanded)}
      className="roman-tablet p-5 border-3 cursor-pointer transition-all min-h-[120px]"
      style={{ borderColor: archetypeColor }}
    >
      <div className="flex items-start gap-4">
        {rank !== undefined && (
          <div
            className="font-serif text-2xl font-bold flex-shrink-0"
            style={{ color: rank <= 3 ? "#B8860B" : "#3D2B1F" }}
          >
            #{rank}
          </div>
        )}

        <canvas ref={canvasRef} width={40} height={40} className="flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <p className="font-serif text-lg text-roman-text truncate">
              {strategy.name || `STRATEGY-${strategy.id.slice(0, 8)}`}
            </p>
            <span
              className="font-serif text-sm px-2 py-1 rounded text-white"
              style={{ backgroundColor: archetypeColor }}
            >
              {strategy.archetype?.toUpperCase() || "UNKNOWN"}
            </span>
          </div>

          <div className="flex items-center gap-6 mt-3 flex-wrap">
            <div className="min-w-[80px]">
              <p className="font-sans text-sm text-roman-stone uppercase tracking-wide">PNL</p>
              <p className={`font-serif text-base font-semibold ${pnlPositive ? "text-emerald-700" : "text-red-800"}`}>
                {pnlPositive ? "+" : ""}
                {strategy.performance.totalPnL.toFixed(4)} SOL
              </p>
            </div>

            <div className="min-w-[70px]">
              <p className="font-sans text-sm text-roman-stone uppercase tracking-wide">WIN RATE</p>
              <p className="font-serif text-base text-roman-text font-semibold">
                {(strategy.performance.winRate * 100).toFixed(1)}%
              </p>
            </div>

            <div className="min-w-[60px]">
              <p className="font-sans text-sm text-roman-stone uppercase tracking-wide">TRADES</p>
              <p className="font-serif text-base text-roman-text font-semibold">
                {strategy.performance.tradesExecuted}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-sans text-sm text-roman-stone uppercase tracking-wide">FITNESS</p>
              <p className="font-serif text-base text-roman-text font-bold">
                {strategy.performance.fitnessScore.toFixed(1)}
              </p>
            </div>
            <div className="h-3 rounded-sm overflow-hidden bg-roman-bg-light border border-roman-stone">
              <div
                className="h-full rounded-sm transition-all duration-300"
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
          className="mt-5 pt-5 border-t-2 border-roman-stone/30"
        >
          <p className="font-serif text-lg text-roman-text mb-3 tracking-wider">GENES</p>
          <div className="grid grid-cols-2 gap-4 text-base font-sans">
            <div className="p-3 bg-roman-bg-light rounded border border-roman-stone/30">
              <span className="text-roman-stone">MCAP RANGE:</span>{" "}
              <span className="text-roman-text font-semibold">
                ${strategy.genes.entryMcapMin.toFixed(0)} - ${strategy.genes.entryMcapMax.toFixed(0)}
              </span>
            </div>
            <div className="p-3 bg-roman-bg-light rounded border border-roman-stone/30">
              <span className="text-roman-stone">TP:</span>{" "}
              <span className="text-roman-text font-semibold">{strategy.genes.takeProfitMultiplier.toFixed(1)}x</span>
            </div>
            <div className="p-3 bg-roman-bg-light rounded border border-roman-stone/30">
              <span className="text-roman-stone">SL:</span>{" "}
              <span className="text-red-800 font-semibold">{(strategy.genes.stopLossMultiplier * 100).toFixed(0)}%</span>
            </div>
            <div className="p-3 bg-roman-bg-light rounded border border-roman-stone/30">
              <span className="text-roman-stone">TIME EXIT:</span>{" "}
              <span className="text-roman-text font-semibold">{strategy.genes.timeBasedExit}min</span>
            </div>
          </div>

          <p className="font-serif text-lg text-roman-text mt-5 mb-3 tracking-wider">PATTERNS</p>
          <div className="flex flex-wrap gap-2">
            {strategy.genes.buyPatterns.map((pattern) => (
              <span
                key={pattern}
                className="font-sans text-base px-3 py-2 bg-roman-bg-light border border-roman-stone/50 text-roman-text rounded"
              >
                {pattern}
              </span>
            ))}
          </div>

          <p className="font-serif text-lg text-roman-text mt-5 mb-3 tracking-wider">KEYWORDS</p>
          <div className="flex flex-wrap gap-2">
            {strategy.genes.tokenNameKeywords.map((keyword) => (
              <span
                key={keyword}
                className="font-sans text-base px-3 py-2 bg-roman-bg-light border border-roman-stone/50 text-roman-text rounded"
              >
                {keyword}
              </span>
            ))}
          </div>

          {strategy.parentIds.length > 0 && (
            <div className="mt-5 p-3 bg-roman-bg-light rounded border border-roman-stone/30">
              <p className="font-sans text-base text-roman-stone">
                PARENTS: <span className="text-roman-text">{strategy.parentIds.map((id) => id.slice(0, 6)).join(", ")}</span>
              </p>
            </div>
          )}

          <p className="font-sans text-sm text-roman-stone mt-4">
            GEN {strategy.generation} • BORN {new Date(strategy.birthTimestamp).toLocaleDateString()}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

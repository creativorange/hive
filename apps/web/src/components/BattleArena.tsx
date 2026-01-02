"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { Strategy } from "@/lib/types";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  generatePixelAvatar,
  drawHealthBar,
  drawPixelText,
  ARCHETYPE_COLORS,
} from "@/lib/sprites";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: "spark" | "explosion" | "trail" | "heal" | "star";
}

interface Projectile {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  color: string;
  size: number;
  fromId: string;
  toId: string;
  trail: { x: number; y: number }[];
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
}

interface StrategySprite {
  strategy: Strategy;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  targetX: number;
  targetY: number;
  avatar: HTMLCanvasElement;
  animationFrame: number;
  state: "idle" | "attacking" | "damaged" | "charging" | "celebrating";
  stateTimer: number;
  attackCooldown: number;
  wobble: number;
  scale: number;
  targetScale: number;
  flashTimer: number;
  battleEnergy: number;
}

const ARENA_WIDTH = 1000;
const ARENA_HEIGHT = 600;
const SPRITE_SIZE = 32;
const ANIMATION_SPEED = 0.08;
const ATTACK_COOLDOWN = 120;
const PROJECTILE_SPEED = 8;
const MAX_VISIBLE_AGENTS = 50;

export function BattleArena() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const spritesRef = useRef<StrategySprite[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const isRunningRef = useRef(false);

  const { subscribe } = useWebSocket({ channels: ["strategies", "trades"] });

  const spawnParticles = useCallback(
    (
      x: number,
      y: number,
      count: number,
      color: string,
      type: Particle["type"] = "spark"
    ) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 1 + Math.random() * 3;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 30 + Math.random() * 30,
          maxLife: 60,
          color,
          size: type === "explosion" ? 3 + Math.random() * 4 : 2 + Math.random() * 2,
          type,
        });
      }
    },
    []
  );

  const spawnFloatingText = useCallback(
    (x: number, y: number, text: string, color: string) => {
      floatingTextsRef.current.push({
        x,
        y,
        text,
        color,
        life: 60,
        vy: -1.5,
      });
    },
    []
  );

  const fetchStrategies = useCallback(async () => {
    try {
      const data = await api.strategies.getTop(MAX_VISIBLE_AGENTS);
      setStrategies(data);
    } catch (error) {
      console.error("Failed to fetch strategies:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategies();
    const interval = setInterval(fetchStrategies, 30000);
    return () => clearInterval(interval);
  }, [fetchStrategies]);

  useEffect(() => {
    const unsubPerf = subscribe("strategy:performance_updated", ({ strategyId, performance }) => {
      setStrategies((prev) =>
        prev.map((s) =>
          s.id === strategyId ? { ...s, performance } : s
        )
      );

      const sprite = spritesRef.current.find((s) => s.strategy.id === strategyId);
      if (sprite) {
        sprite.strategy = { ...sprite.strategy, performance };
      }
    });

    const unsubTradeClose = subscribe("trade:closed", (trade) => {
      const sprite = spritesRef.current.find((s) => s.strategy.id === trade.strategyId);
      if (sprite) {
        const pnl = trade.pnlSol ?? 0;
        if (pnl > 0) {
          sprite.state = "celebrating";
          sprite.stateTimer = 0;
          spawnParticles(sprite.x, sprite.y, 12, "#FFD700", "star");
          spawnFloatingText(sprite.x, sprite.y - 30, `+${pnl.toFixed(3)}`, "#00FF41");
        } else {
          sprite.state = "damaged";
          sprite.stateTimer = 0;
          sprite.flashTimer = 10;
          spawnFloatingText(sprite.x, sprite.y - 30, `${pnl.toFixed(3)}`, "#FF0051");
        }
      }
    });

    return () => {
      unsubPerf();
      unsubTradeClose();
    };
  }, [subscribe, spawnParticles, spawnFloatingText]);

  const fireProjectile = useCallback(
    (from: StrategySprite, to: StrategySprite) => {
      const color = ARCHETYPE_COLORS[from.strategy.archetype ?? "momentum"];
      projectilesRef.current.push({
        x: from.x,
        y: from.y,
        targetX: to.x,
        targetY: to.y,
        speed: PROJECTILE_SPEED,
        color,
        size: 6,
        fromId: from.strategy.id,
        toId: to.strategy.id,
        trail: [],
      });
    },
    []
  );

  const initializeSprites = useCallback(() => {
    const cols = 10;
    const cellWidth = (ARENA_WIDTH - 60) / cols;
    const cellHeight = 80;

    const sprites: StrategySprite[] = strategies.map((strategy, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = 40 + col * cellWidth + cellWidth / 2;
      const y = 50 + row * cellHeight + cellHeight / 2;

      return {
        strategy,
        x,
        y,
        baseX: x,
        baseY: y,
        targetX: x,
        targetY: y,
        avatar: generatePixelAvatar(strategy.id, SPRITE_SIZE),
        animationFrame: Math.random() * Math.PI * 2,
        state: "idle",
        stateTimer: 0,
        attackCooldown: Math.random() * ATTACK_COOLDOWN,
        wobble: 0,
        scale: 1,
        targetScale: 1,
        flashTimer: 0,
        battleEnergy: 50 + Math.random() * 50,
      };
    });

    spritesRef.current = sprites;
    particlesRef.current = [];
    projectilesRef.current = [];
    floatingTextsRef.current = [];
  }, [strategies]);

  const updateBattleLogic = useCallback(() => {
    const sprites = spritesRef.current;
    if (sprites.length < 2) return;

    sprites.forEach((sprite) => {
      sprite.attackCooldown--;
      sprite.battleEnergy += 0.1;

      if (
        sprite.attackCooldown <= 0 &&
        sprite.state === "idle" &&
        sprite.battleEnergy >= 30
      ) {
        const otherSprites = sprites.filter((s) => s.strategy.id !== sprite.strategy.id);
        const target = otherSprites[Math.floor(Math.random() * otherSprites.length)];

        if (target && Math.random() < 0.3) {
          sprite.state = "charging";
          sprite.stateTimer = 0;
          sprite.targetScale = 1.2;
          sprite.battleEnergy -= 30;

          const color = ARCHETYPE_COLORS[sprite.strategy.archetype ?? "momentum"];
          spawnParticles(sprite.x, sprite.y, 8, color, "trail");

          setTimeout(() => {
            if (sprite.state === "charging") {
              sprite.state = "attacking";
              sprite.stateTimer = 0;
              fireProjectile(sprite, target);

              const dx = target.x - sprite.x;
              const dy = target.y - sprite.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              sprite.targetX = sprite.x + (dx / dist) * 20;
              sprite.targetY = sprite.y + (dy / dist) * 20;
            }
          }, 300);

          sprite.attackCooldown = ATTACK_COOLDOWN + Math.random() * 60;
        }
      }

      if (sprite.state !== "idle" && sprite.state !== "charging") {
        sprite.stateTimer++;
        if (sprite.stateTimer > 40) {
          sprite.state = "idle";
          sprite.stateTimer = 0;
          sprite.targetX = sprite.baseX;
          sprite.targetY = sprite.baseY;
          sprite.targetScale = 1;
        }
      }

      if (sprite.state === "charging") {
        sprite.stateTimer++;
        if (sprite.stateTimer > 60) {
          sprite.state = "idle";
          sprite.stateTimer = 0;
          sprite.targetScale = 1;
        }
      }
    });

    projectilesRef.current = projectilesRef.current.filter((proj) => {
      proj.trail.push({ x: proj.x, y: proj.y });
      if (proj.trail.length > 8) proj.trail.shift();

      const dx = proj.targetX - proj.x;
      const dy = proj.targetY - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < proj.speed) {
        const target = sprites.find((s) => s.strategy.id === proj.toId);
        if (target) {
          target.state = "damaged";
          target.stateTimer = 0;
          target.flashTimer = 10;
          target.wobble = 0.3;
          target.targetScale = 0.9;

          spawnParticles(target.x, target.y, 12, proj.color, "explosion");
          spawnParticles(target.x, target.y, 6, "#FFFFFF", "star");

          const damage = Math.floor(Math.random() * 20) + 5;
          spawnFloatingText(target.x, target.y - 30, `-${damage}`, "#FF0051");

          const attacker = sprites.find((s) => s.strategy.id === proj.fromId);
          if (attacker && Math.random() < 0.3) {
            attacker.state = "celebrating";
            spawnFloatingText(attacker.x, attacker.y - 30, "HIT!", "#FFD700");
          }
        }
        return false;
      }

      proj.x += (dx / dist) * proj.speed;
      proj.y += (dy / dist) * proj.speed;
      return true;
    });

    if (Math.random() < 0.02) {
      const luckySprite = sprites[Math.floor(Math.random() * sprites.length)];
      spawnParticles(luckySprite.x, luckySprite.y, 5, "#00FF41", "heal");
      spawnFloatingText(luckySprite.x, luckySprite.y - 30, "+PNL", "#00FF41");
    }
  }, [spawnParticles, spawnFloatingText, fireProjectile]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    timeRef.current++;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    const gridOffset = (timeRef.current * 0.2) % 20;
    ctx.strokeStyle = "rgba(0, 255, 65, 0.08)";
    ctx.lineWidth = 1;
    for (let x = -20 + gridOffset; x < ARENA_WIDTH + 20; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < ARENA_HEIGHT; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_WIDTH, y);
      ctx.stroke();
    }

    const borderPulse = Math.sin(timeRef.current * 0.05) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(0, 255, 65, ${borderPulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, ARENA_WIDTH - 4, ARENA_HEIGHT - 4);

    const titleGlow = Math.sin(timeRef.current * 0.08) * 0.3 + 0.7;
    ctx.shadowColor = "#00FF41";
    ctx.shadowBlur = 10 * titleGlow;
    drawPixelText(ctx, "$META BATTLE ARENA", ARENA_WIDTH / 2, 25, 10, "#00FF41");
    ctx.shadowBlur = 0;

    updateBattleLogic();

    particlesRef.current = particlesRef.current.filter((p) => {
      if (p.life <= 0) return false;
      
      p.life--;
      p.x += p.vx;
      p.y += p.vy;

      if (p.type === "spark" || p.type === "explosion") {
        p.vy += 0.1;
        p.vx *= 0.98;
      } else if (p.type === "heal") {
        p.vy -= 0.05;
      } else if (p.type === "star") {
        p.vy += 0.05;
      }

      const alpha = Math.max(0, p.life / p.maxLife);
      const radius = Math.max(0.1, p.size * alpha);
      
      ctx.fillStyle =
        p.color +
        Math.floor(alpha * 255)
          .toString(16)
          .padStart(2, "0");

      if (p.type === "star") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(timeRef.current * 0.1);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      return p.life > 0;
    });

    projectilesRef.current.forEach((proj) => {
      proj.trail.forEach((pos, i) => {
        const alpha = i / proj.trail.length;
        ctx.fillStyle =
          proj.color +
          Math.floor(alpha * 150)
            .toString(16)
            .padStart(2, "0");
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, proj.size * alpha * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    spritesRef.current.forEach((sprite, index) => {
      sprite.x += (sprite.targetX - sprite.x) * ANIMATION_SPEED;
      sprite.y += (sprite.targetY - sprite.y) * ANIMATION_SPEED;
      sprite.scale += (sprite.targetScale - sprite.scale) * 0.1;

      if (sprite.wobble > 0) {
        sprite.wobble *= 0.9;
      }
      if (sprite.flashTimer > 0) {
        sprite.flashTimer--;
      }

      sprite.animationFrame += 0.06;

      const idleBounce = sprite.state === "idle" ? Math.sin(sprite.animationFrame) * 3 : 0;
      const wobbleOffset = Math.sin(timeRef.current * 0.5) * sprite.wobble * 10;
      const celebrateBounce =
        sprite.state === "celebrating" ? Math.abs(Math.sin(sprite.animationFrame * 3)) * 8 : 0;

      const scaledSize = SPRITE_SIZE * sprite.scale;
      const drawX = sprite.x - scaledSize / 2 + wobbleOffset;
      const drawY = sprite.y - scaledSize / 2 + idleBounce - celebrateBounce;

      const archetypeColor = ARCHETYPE_COLORS[sprite.strategy.archetype ?? "momentum"];

      if (sprite.state === "attacking" || sprite.state === "charging") {
        ctx.shadowColor = archetypeColor;
        ctx.shadowBlur = 15 + Math.sin(timeRef.current * 0.3) * 5;
      } else if (sprite.state === "damaged") {
        ctx.shadowColor = "#FF0051";
        ctx.shadowBlur = 20;
      } else if (sprite.state === "celebrating") {
        ctx.shadowColor = "#FFD700";
        ctx.shadowBlur = 15;
      } else {
        const idleGlow = Math.sin(sprite.animationFrame * 0.5) * 3 + 5;
        ctx.shadowColor = archetypeColor;
        ctx.shadowBlur = idleGlow;
      }

      if (sprite.flashTimer > 0 && sprite.flashTimer % 2 === 0) {
        ctx.globalAlpha = 0.5;
      }

      ctx.drawImage(sprite.avatar, drawX, drawY, scaledSize, scaledSize);

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      if (sprite.state === "charging") {
        const chargeRadius = 30 + Math.sin(timeRef.current * 0.2) * 5;
        ctx.strokeStyle = archetypeColor + "80";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sprite.x, sprite.y, chargeRadius, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < 3; i++) {
          const angle = (timeRef.current * 0.1 + (i * Math.PI * 2) / 3) % (Math.PI * 2);
          const orbX = sprite.x + Math.cos(angle) * chargeRadius;
          const orbY = sprite.y + Math.sin(angle) * chargeRadius;
          ctx.fillStyle = archetypeColor;
          ctx.beginPath();
          ctx.arc(orbX, orbY, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const fitnessPercent = sprite.strategy.performance.fitnessScore / 100;
      drawHealthBar(ctx, drawX, drawY - 12, scaledSize, 6, fitnessPercent, {
        bg: "#1a1a24",
        fill: archetypeColor,
        border: "#00FF41",
      });

      const rankColor = index < 3 ? "#FFD700" : "#AAAAAA";
      drawPixelText(ctx, `#${index + 1}`, sprite.x, drawY + scaledSize + 12, 6, rankColor);

      const name = sprite.strategy.name?.slice(0, 8) || sprite.strategy.id.slice(0, 6);
      drawPixelText(ctx, name, sprite.x, drawY + scaledSize + 22, 5, "#00FF41");

      const pnl = sprite.strategy.performance.totalPnL;
      const pnlColor = pnl >= 0 ? "#00FF41" : "#FF0051";
      const pnlText = `${pnl >= 0 ? "+" : ""}${pnl.toFixed(3)}`;
      drawPixelText(ctx, pnlText, sprite.x, drawY + scaledSize + 32, 5, pnlColor);
    });

    floatingTextsRef.current = floatingTextsRef.current.filter((ft) => {
      ft.life--;
      ft.y += ft.vy;
      ft.vy *= 0.95;

      const alpha = ft.life / 60;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 5;
      drawPixelText(ctx, ft.text, ft.x, ft.y, 7, ft.color);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      return ft.life > 0;
    });

    const statsY = ARENA_HEIGHT - 15;
    const activeCount = spritesRef.current.length;
    const totalPnL = strategies.reduce((sum, s) => sum + s.performance.totalPnL, 0);
    drawPixelText(
      ctx,
      `ACTIVE: ${activeCount} | TOTAL PNL: ${totalPnL.toFixed(3)} SOL`,
      ARENA_WIDTH / 2,
      statsY,
      6,
      "#00FF41"
    );

    if (isRunningRef.current) {
      animationRef.current = requestAnimationFrame(render);
    }
  }, [strategies, updateBattleLogic]);

  useEffect(() => {
    if (strategies.length > 0 && !isRunningRef.current) {
      isRunningRef.current = true;
      initializeSprites();
      render();
    }

    return () => {
      isRunningRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [strategies, initializeSprites, render]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = ARENA_WIDTH / rect.width;
    const scaleY = ARENA_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const clicked = spritesRef.current.find((sprite) => {
      const dx = Math.abs(sprite.x - x);
      const dy = Math.abs(sprite.y - y);
      return dx < SPRITE_SIZE / 2 && dy < SPRITE_SIZE / 2;
    });

    if (clicked) {
      setSelectedStrategy(clicked.strategy);
      spawnParticles(
        clicked.x,
        clicked.y,
        15,
        ARCHETYPE_COLORS[clicked.strategy.archetype ?? "momentum"],
        "star"
      );
    } else {
      setSelectedStrategy(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-meta-bg-card border-2 border-meta-green p-4">
        <div
          className="animate-pulse bg-meta-bg-light"
          style={{ width: ARENA_WIDTH, height: ARENA_HEIGHT }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-meta-bg-card border-2 border-meta-green p-4 overflow-x-auto">
        <canvas
          ref={canvasRef}
          width={ARENA_WIDTH}
          height={ARENA_HEIGHT}
          onClick={handleCanvasClick}
          className="cursor-pointer mx-auto block"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      {selectedStrategy && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-meta-bg-card border-2 border-meta-cyan p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-pixel text-sm text-meta-cyan">
              {selectedStrategy.name || `STRATEGY-${selectedStrategy.id.slice(0, 8)}`}
            </h3>
            <button
              onClick={() => setSelectedStrategy(null)}
              className="font-pixel text-xs text-meta-red hover:text-meta-red/70"
            >
              X
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[7px]">
            <div>
              <p className="text-meta-green/50">ARCHETYPE</p>
              <p
                className="text-glow"
                style={{
                  color: ARCHETYPE_COLORS[selectedStrategy.archetype ?? "momentum"],
                }}
              >
                {selectedStrategy.archetype?.toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-meta-green/50">FITNESS</p>
              <p className="text-meta-gold">
                {selectedStrategy.performance.fitnessScore.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-meta-green/50">TOTAL PNL</p>
              <p
                className={
                  selectedStrategy.performance.totalPnL >= 0
                    ? "text-meta-green"
                    : "text-meta-red"
                }
              >
                {selectedStrategy.performance.totalPnL >= 0 ? "+" : ""}
                {selectedStrategy.performance.totalPnL.toFixed(4)} SOL
              </p>
            </div>
            <div>
              <p className="text-meta-green/50">WIN RATE</p>
              <p className="text-meta-cyan">
                {(selectedStrategy.performance.winRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

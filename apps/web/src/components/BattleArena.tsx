"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Strategy } from "@/lib/types";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  generatePixelAvatar,
  drawPixelText,
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
  type: "spark" | "laurel" | "coin" | "dust";
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
}

interface GladiatorSprite {
  strategy: Strategy;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  avatar: HTMLCanvasElement;
  animationFrame: number;
  state: "idle" | "victory" | "defeat" | "trading";
  stateTimer: number;
  scale: number;
  targetScale: number;
  rotation: number;
  targetRotation: number;
}

const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 520;
const SPRITE_SIZE = 36;
const MAX_VISIBLE_AGENTS = 32;

// Roman colosseum colors - warm tones for parchment theme
const SAND_COLOR = "#E8D5B5";
const SAND_DARK = "#D4C4A0";
const STONE_COLOR = "#8B7355";
const STONE_DARK = "#6B5344";
const STONE_LIGHT = "#A89070";
const GOLD = "#D4AF37";
const CRIMSON = "#8B0000";
const DARK_BROWN = "#3D2B1F";
const EMERALD = "#2E7D32";

export function BattleArena() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const spritesRef = useRef<GladiatorSprite[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const isRunningRef = useRef(false);

  const { subscribe } = useWebSocket({ channels: ["strategies", "trades"] });

  const spawnParticles = useCallback(
    (x: number, y: number, count: number, color: string, type: Particle["type"] = "spark") => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 1 + Math.random() * 2;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: type === "laurel" ? -Math.random() * 2 - 1 : Math.sin(angle) * speed,
          life: 40 + Math.random() * 20,
          maxLife: 60,
          color,
          size: type === "coin" ? 4 : 2 + Math.random() * 2,
          type,
        });
      }
    },
    []
  );

  const spawnFloatingText = useCallback((x: number, y: number, text: string, color: string) => {
    floatingTextsRef.current.push({
      x,
      y,
      text,
      color,
      life: 80,
      vy: -1.2,
    });
  }, []);

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

  // Handle real trade events
  useEffect(() => {
    const unsubPerf = subscribe("strategy:performance_updated", ({ strategyId, performance }) => {
      setStrategies((prev) =>
        prev.map((s) => (s.id === strategyId ? { ...s, performance } : s))
      );

      const sprite = spritesRef.current.find((s) => s.strategy.id === strategyId);
      if (sprite) {
        sprite.strategy = { ...sprite.strategy, performance };
      }
    });

    const unsubTradeOpen = subscribe("trade:opened", (trade) => {
      const sprite = spritesRef.current.find((s) => s.strategy.id === trade.strategyId);
      if (sprite) {
        sprite.state = "trading";
        sprite.stateTimer = 0;
        sprite.targetScale = 1.15;
        spawnParticles(sprite.x, sprite.y, 6, GOLD, "coin");
        spawnFloatingText(sprite.x, sprite.y - 40, "TRADING", DARK_BROWN);
      }
    });

    const unsubTradeClose = subscribe("trade:closed", (trade) => {
      const sprite = spritesRef.current.find((s) => s.strategy.id === trade.strategyId);
      if (sprite) {
        const pnl = trade.pnlSol ?? 0;
        if (pnl > 0) {
          // Victory animation - raise arms, celebrate
          sprite.state = "victory";
          sprite.stateTimer = 0;
          sprite.targetScale = 1.2;
          sprite.targetRotation = 0;
          spawnParticles(sprite.x, sprite.y - 20, 10, GOLD, "laurel");
          spawnParticles(sprite.x, sprite.y, 8, GOLD, "coin");
          spawnFloatingText(sprite.x, sprite.y - 50, `+${pnl.toFixed(3)} SOL`, EMERALD);
        } else {
          // Defeat animation - stumble, bow head
          sprite.state = "defeat";
          sprite.stateTimer = 0;
          sprite.targetScale = 0.85;
          sprite.targetRotation = Math.PI / 12; // slight tilt
          spawnParticles(sprite.x, sprite.y + 20, 6, STONE_COLOR, "dust");
          spawnFloatingText(sprite.x, sprite.y - 50, `${pnl.toFixed(3)} SOL`, CRIMSON);
        }
      }
    });

    return () => {
      unsubPerf();
      unsubTradeOpen();
      unsubTradeClose();
    };
  }, [subscribe, spawnParticles, spawnFloatingText]);

  const initializeSprites = useCallback(() => {
    const cols = 8;
    const rows = Math.ceil(Math.min(strategies.length, MAX_VISIBLE_AGENTS) / cols);
    const cellWidth = (ARENA_WIDTH - 80) / cols;
    const availableHeight = ARENA_HEIGHT - 100;
    const cellHeight = Math.min(105, availableHeight / rows);
    const startY = 55 + (availableHeight - rows * cellHeight) / 2;

    const sprites: GladiatorSprite[] = strategies.slice(0, MAX_VISIBLE_AGENTS).map((strategy, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = 50 + col * cellWidth + cellWidth / 2;
      const y = startY + row * cellHeight + cellHeight / 2;

      return {
        strategy,
        x,
        y,
        baseX: x,
        baseY: y,
        avatar: generatePixelAvatar(strategy.id, SPRITE_SIZE),
        animationFrame: Math.random() * Math.PI * 2,
        state: "idle",
        stateTimer: 0,
        scale: 1,
        targetScale: 1,
        rotation: 0,
        targetRotation: 0,
      };
    });

    spritesRef.current = sprites;
    particlesRef.current = [];
    floatingTextsRef.current = [];
  }, [strategies]);

  const drawArenaBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    // Arena floor - warm sand color
    const floorGradient = ctx.createRadialGradient(
      ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 0,
      ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_WIDTH / 2
    );
    floorGradient.addColorStop(0, SAND_COLOR);
    floorGradient.addColorStop(1, SAND_DARK);
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Subtle arena markings - elliptical rings
    ctx.strokeStyle = STONE_COLOR + "30";
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 150 * i, 100 * i, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Stone border
    const borderWidth = 30;
    
    // Outer stone frame
    ctx.fillStyle = STONE_COLOR;
    ctx.fillRect(0, 0, ARENA_WIDTH, borderWidth);
    ctx.fillRect(0, ARENA_HEIGHT - borderWidth, ARENA_WIDTH, borderWidth);
    ctx.fillRect(0, 0, borderWidth, ARENA_HEIGHT);
    ctx.fillRect(ARENA_WIDTH - borderWidth, 0, borderWidth, ARENA_HEIGHT);

    // Inner border highlight
    ctx.strokeStyle = STONE_LIGHT;
    ctx.lineWidth = 2;
    ctx.strokeRect(borderWidth, borderWidth, ARENA_WIDTH - borderWidth * 2, ARENA_HEIGHT - borderWidth * 2);

    // Title banner
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(ARENA_WIDTH / 2 - 120, 5, 240, 22);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.strokeRect(ARENA_WIDTH / 2 - 120, 5, 240, 22);
    drawPixelText(ctx, "⚔ GLADIATOR ARENA ⚔", ARENA_WIDTH / 2, 16, 14, GOLD);
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    timeRef.current++;

    // Clear and draw background
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    drawArenaBackground(ctx);

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter((p) => {
      p.life--;
      p.x += p.vx;
      p.y += p.vy;
      if (p.type === "coin" || p.type === "dust") p.vy += 0.08; // gravity
      p.vx *= 0.98;
      p.vy *= 0.98;

      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.type === "coin") {
        // Draw as small circle/coin
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = DARK_BROWN;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      } else if (p.type === "laurel") {
        // Draw as leaf shape
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 2, p.size, p.life * 0.1, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      return p.life > 0;
    });

    // Update and draw gladiators
    spritesRef.current.forEach((sprite, index) => {
      // Animate state timers
      if (sprite.state !== "idle") {
        sprite.stateTimer++;
        if (sprite.stateTimer > 80) {
          sprite.state = "idle";
          sprite.stateTimer = 0;
          sprite.targetScale = 1;
          sprite.targetRotation = 0;
        }
      }

      // Smooth scale/rotation transitions
      sprite.scale += (sprite.targetScale - sprite.scale) * 0.1;
      sprite.rotation += (sprite.targetRotation - sprite.rotation) * 0.1;
      sprite.animationFrame += 0.04;

      // Idle breathing animation
      const breathe = sprite.state === "idle" ? Math.sin(sprite.animationFrame) * 2 : 0;
      
      // Victory bounce
      const victoryBounce = sprite.state === "victory" 
        ? Math.abs(Math.sin(sprite.animationFrame * 4)) * 6 
        : 0;

      // Defeat droop
      const defeatDroop = sprite.state === "defeat" ? 4 : 0;

      const scaledSize = SPRITE_SIZE * sprite.scale;
      const drawX = sprite.x - scaledSize / 2;
      const drawY = sprite.y - scaledSize / 2 + breathe - victoryBounce + defeatDroop;

      // Save context for rotation
      ctx.save();
      ctx.translate(sprite.x, sprite.y);
      ctx.rotate(sprite.rotation);
      ctx.translate(-sprite.x, -sprite.y);

      // Glow effect based on state
      if (sprite.state === "victory") {
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 15;
      } else if (sprite.state === "defeat") {
        ctx.shadowColor = CRIMSON;
        ctx.shadowBlur = 10;
      } else if (sprite.state === "trading") {
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 8;
      }

      // Draw avatar
      ctx.drawImage(sprite.avatar, drawX, drawY, scaledSize, scaledSize);
      ctx.shadowBlur = 0;
      ctx.restore();

      // Draw rank badge
      const rankY = drawY - 8;
      const isTopThree = index < 3;
      const rankBgColor = isTopThree ? GOLD : STONE_DARK;
      const rankTextColor = isTopThree ? DARK_BROWN : "#F5E6D3";
      
      ctx.fillStyle = rankBgColor;
      ctx.beginPath();
      ctx.arc(sprite.x, rankY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = DARK_BROWN;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      drawPixelText(ctx, `${index + 1}`, sprite.x, rankY, 10, rankTextColor);

      // Draw name
      const name = sprite.strategy.name?.slice(0, 8) || sprite.strategy.id.slice(0, 6);
      drawPixelText(ctx, name, sprite.x, drawY + scaledSize + 12, 11, DARK_BROWN);

      // Draw PnL
      const pnl = sprite.strategy.performance.totalPnL;
      const pnlColor = pnl >= 0 ? EMERALD : CRIMSON;
      const pnlText = `${pnl >= 0 ? "+" : ""}${pnl.toFixed(3)}`;
      drawPixelText(ctx, pnlText, sprite.x, drawY + scaledSize + 24, 10, pnlColor);
    });

    // Draw floating texts
    floatingTextsRef.current = floatingTextsRef.current.filter((ft) => {
      ft.life--;
      ft.y += ft.vy;
      ft.vy *= 0.97;

      const alpha = Math.min(1, ft.life / 40);
      ctx.globalAlpha = alpha;
      
      // Background for readability
      ctx.fillStyle = "rgba(251, 247, 240, 0.85)";
      const metrics = ctx.measureText(ft.text);
      const textWidth = metrics.width || ft.text.length * 8;
      ctx.fillRect(ft.x - textWidth / 2 - 4, ft.y - 8, textWidth + 8, 16);
      ctx.strokeStyle = ft.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(ft.x - textWidth / 2 - 4, ft.y - 8, textWidth + 8, 16);
      
      drawPixelText(ctx, ft.text, ft.x, ft.y, 12, ft.color);
      ctx.globalAlpha = 1;

      return ft.life > 0;
    });

    // Stats bar at bottom
    const statsY = ARENA_HEIGHT - 15;
    const activeCount = spritesRef.current.length;
    const totalPnL = strategies.reduce((sum, s) => sum + s.performance.totalPnL, 0);
    const pnlColor = totalPnL >= 0 ? EMERALD : CRIMSON;

    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(ARENA_WIDTH / 2 - 180, statsY - 10, 360, 22);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.strokeRect(ARENA_WIDTH / 2 - 180, statsY - 10, 360, 22);

    drawPixelText(ctx, `TOP ${activeCount} GLADIATORS`, ARENA_WIDTH / 2 - 80, statsY + 1, 12, "#F5E6D3");
    drawPixelText(ctx, `|`, ARENA_WIDTH / 2, statsY + 1, 12, GOLD);
    drawPixelText(ctx, `TOTAL: ${totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(3)} SOL`, ARENA_WIDTH / 2 + 80, statsY + 1, 12, pnlColor);

    if (isRunningRef.current) {
      animationRef.current = requestAnimationFrame(render);
    }
  }, [strategies, drawArenaBackground]);

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
      return dx < SPRITE_SIZE && dy < SPRITE_SIZE;
    });

    if (clicked) {
      spawnParticles(clicked.x, clicked.y, 8, GOLD, "spark");
      router.push(`/strategy/${clicked.strategy.id}`);
    }
  };

  if (loading) {
    return (
      <div className="roman-tablet">
        <div
          className="animate-pulse bg-roman-bg-light rounded"
          style={{ width: "100%", maxWidth: ARENA_WIDTH, height: ARENA_HEIGHT / 2 }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="roman-tablet p-2 sm:p-4">
        <canvas
          ref={canvasRef}
          width={ARENA_WIDTH}
          height={ARENA_HEIGHT}
          onClick={handleCanvasClick}
          className="cursor-pointer mx-auto block w-full rounded"
          style={{ 
            aspectRatio: `${ARENA_WIDTH}/${ARENA_HEIGHT}`,
            minHeight: '300px',
            maxHeight: '70vh',
          }}
        />
      </div>
    </div>
  );
}

export interface SpriteSheet {
  image: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  framesPerRow: number;
  totalFrames: number;
}

export interface SpriteAnimation {
  name: string;
  startFrame: number;
  endFrame: number;
  frameDuration: number;
  loop: boolean;
}

export const ARCHETYPE_COLORS: Record<string, string> = {
  momentum: "#D4AF37", // Roman gold
  mean_reversion: "#5B2C6F", // Imperial purple
  breakout: "#C46A4E", // Terracotta/red
  scalper: "#CD7F32", // Bronze
  swing: "#5C5C3D", // Olive/legion green
  default: "#E8E4D9",
};

export const ARCHETYPE_SPRITES: Record<string, number> = {
  aggressive: 0,
  conservative: 1,
  social: 2,
  whale_follower: 3,
  sniper: 4,
  momentum: 5,
};

export class SpriteManager {
  private cache: Map<string, SpriteSheet> = new Map();
  private animations: Map<string, SpriteAnimation[]> = new Map();

  async loadSpriteSheet(
    name: string,
    url: string,
    frameWidth: number,
    frameHeight: number,
    totalFrames: number
  ): Promise<SpriteSheet> {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const sheet: SpriteSheet = {
          image,
          frameWidth,
          frameHeight,
          framesPerRow: Math.floor(image.width / frameWidth),
          totalFrames,
        };
        this.cache.set(name, sheet);
        resolve(sheet);
      };
      image.onerror = reject;
      image.src = url;
    });
  }

  registerAnimations(sheetName: string, animations: SpriteAnimation[]): void {
    this.animations.set(sheetName, animations);
  }

  getAnimation(sheetName: string, animName: string): SpriteAnimation | undefined {
    const anims = this.animations.get(sheetName);
    return anims?.find((a) => a.name === animName);
  }

  drawFrame(
    ctx: CanvasRenderingContext2D,
    sheetName: string,
    frame: number,
    x: number,
    y: number,
    scale: number = 1
  ): void {
    const sheet = this.cache.get(sheetName);
    if (!sheet) return;

    const frameX = (frame % sheet.framesPerRow) * sheet.frameWidth;
    const frameY = Math.floor(frame / sheet.framesPerRow) * sheet.frameHeight;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sheet.image,
      frameX,
      frameY,
      sheet.frameWidth,
      sheet.frameHeight,
      x,
      y,
      sheet.frameWidth * scale,
      sheet.frameHeight * scale
    );
  }
}

export const spriteManager = new SpriteManager();

const HELMET_STYLES = ["galea", "murmillo", "thraex", "hoplomachus"] as const;
type HelmetStyle = (typeof HELMET_STYLES)[number];

const ROMAN_PALETTES = [
  { main: "#D4AF37", dark: "#8B7355", light: "#FFD700", accent: "#8B0000", skin: "#D4A574" }, // Gold
  { main: "#CD7F32", dark: "#8B4513", light: "#DAA520", accent: "#800020", skin: "#C4956A" }, // Bronze
  { main: "#B8860B", dark: "#6B4423", light: "#F0E68C", accent: "#5B2C6F", skin: "#E0B088" }, // Dark gold
  { main: "#C0C0C0", dark: "#708090", light: "#E8E8E8", accent: "#4A0000", skin: "#C9A882" }, // Silver
];

type Palette = (typeof ROMAN_PALETTES)[number];

interface GladiatorConfig {
  helmetStyle: HelmetStyle;
  palette: Palette;
  hasCrest: boolean;
  crestColor: string;
  hasShield: boolean;
  weaponType: "sword" | "trident" | "spear";
}

function seededRandom(hash: number, offset: number): number {
  const x = Math.sin(hash + offset) * 10000;
  return x - Math.floor(x);
}

export function generatePixelAvatar(
  seed: string,
  size: number = 32
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  
  ctx.imageSmoothingEnabled = false;

  const hash = seed.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const config: GladiatorConfig = {
    helmetStyle: HELMET_STYLES[Math.abs(hash) % HELMET_STYLES.length],
    palette: ROMAN_PALETTES[Math.abs(hash >> 4) % ROMAN_PALETTES.length],
    hasCrest: (hash >> 8) % 3 !== 0,
    crestColor: (hash >> 10) % 2 === 0 ? "#8B0000" : "#5B2C6F",
    hasShield: (hash >> 12) % 2 === 0,
    weaponType: (["sword", "trident", "spear"] as const)[Math.abs(hash >> 14) % 3],
  };

  const scale = size / 40;
  
  drawGladiatorFigure(ctx, scale, config);

  return canvas;
}

function drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

function drawGladiatorFigure(ctx: CanvasRenderingContext2D, scale: number, config: GladiatorConfig): void {
  const { palette, helmetStyle, hasCrest, crestColor, hasShield, weaponType } = config;
  const px = scale; // pixel size
  
  const centerX = 20 * scale;
  const baseY = 38 * scale;

  // Legs (2px wide each, 8px tall)
  const legColor = palette.dark;
  const skinColor = palette.skin;
  
  // Left leg
  drawPixel(ctx, centerX - 4 * px, baseY - 8 * px, 2 * px, 5 * px, legColor); // armor
  drawPixel(ctx, centerX - 4 * px, baseY - 3 * px, 2 * px, 2 * px, skinColor); // knee
  drawPixel(ctx, centerX - 4 * px, baseY - 1 * px, 2 * px, 1 * px, "#4A3728"); // sandal
  
  // Right leg
  drawPixel(ctx, centerX + 2 * px, baseY - 8 * px, 2 * px, 5 * px, legColor);
  drawPixel(ctx, centerX + 2 * px, baseY - 3 * px, 2 * px, 2 * px, skinColor);
  drawPixel(ctx, centerX + 2 * px, baseY - 1 * px, 2 * px, 1 * px, "#4A3728");

  // Torso (6px wide, 8px tall) - starting from above legs
  const torsoTop = baseY - 16 * px;
  drawPixel(ctx, centerX - 3 * px, torsoTop, 6 * px, 8 * px, palette.main); // main armor
  drawPixel(ctx, centerX - 3 * px, torsoTop, 6 * px, 1 * px, palette.light); // highlight top
  drawPixel(ctx, centerX - 3 * px, torsoTop + 7 * px, 6 * px, 1 * px, palette.dark); // shadow bottom
  
  // Belt
  drawPixel(ctx, centerX - 4 * px, torsoTop + 6 * px, 8 * px, 2 * px, palette.dark);
  drawPixel(ctx, centerX - 1 * px, torsoTop + 6 * px, 2 * px, 2 * px, palette.light); // belt buckle

  // Shield arm (left side) or bare arm
  if (hasShield) {
    // Arm behind shield
    drawPixel(ctx, centerX - 6 * px, torsoTop + 1 * px, 2 * px, 4 * px, skinColor);
    // Shield (round-ish)
    drawPixel(ctx, centerX - 10 * px, torsoTop - 1 * px, 6 * px, 8 * px, palette.main);
    drawPixel(ctx, centerX - 9 * px, torsoTop, 4 * px, 6 * px, palette.light);
    drawPixel(ctx, centerX - 8 * px, torsoTop + 2 * px, 2 * px, 2 * px, palette.accent); // emblem
  } else {
    // Bare arm
    drawPixel(ctx, centerX - 6 * px, torsoTop + 1 * px, 2 * px, 5 * px, skinColor);
    drawPixel(ctx, centerX - 6 * px, torsoTop + 1 * px, 2 * px, 2 * px, palette.main); // shoulder guard
  }

  // Weapon arm (right side)
  drawPixel(ctx, centerX + 4 * px, torsoTop + 1 * px, 2 * px, 5 * px, skinColor);
  drawPixel(ctx, centerX + 4 * px, torsoTop + 1 * px, 2 * px, 2 * px, palette.main); // shoulder guard
  
  // Weapon
  const weaponColor = "#A0A0A0"; // steel gray
  const handleColor = "#5C4033"; // wood brown
  
  switch (weaponType) {
    case "sword":
      // Handle
      drawPixel(ctx, centerX + 6 * px, torsoTop + 4 * px, 1 * px, 3 * px, handleColor);
      // Blade
      drawPixel(ctx, centerX + 6 * px, torsoTop - 6 * px, 1 * px, 10 * px, weaponColor);
      drawPixel(ctx, centerX + 5 * px, torsoTop + 4 * px, 3 * px, 1 * px, palette.dark); // crossguard
      break;
    case "trident":
      // Handle
      drawPixel(ctx, centerX + 6 * px, torsoTop - 8 * px, 1 * px, 14 * px, handleColor);
      // Prongs
      drawPixel(ctx, centerX + 5 * px, torsoTop - 10 * px, 1 * px, 4 * px, weaponColor);
      drawPixel(ctx, centerX + 6 * px, torsoTop - 12 * px, 1 * px, 6 * px, weaponColor);
      drawPixel(ctx, centerX + 7 * px, torsoTop - 10 * px, 1 * px, 4 * px, weaponColor);
      break;
    case "spear":
      // Handle
      drawPixel(ctx, centerX + 6 * px, torsoTop - 6 * px, 1 * px, 12 * px, handleColor);
      // Spearhead
      drawPixel(ctx, centerX + 6 * px, torsoTop - 10 * px, 1 * px, 4 * px, weaponColor);
      drawPixel(ctx, centerX + 5 * px, torsoTop - 8 * px, 1 * px, 2 * px, weaponColor);
      drawPixel(ctx, centerX + 7 * px, torsoTop - 8 * px, 1 * px, 2 * px, weaponColor);
      break;
  }

  // Neck
  const neckY = torsoTop - 2 * px;
  drawPixel(ctx, centerX - 1 * px, neckY, 2 * px, 2 * px, skinColor);

  // Head/Helmet
  const headY = neckY - 8 * px;
  drawHelmetOnFigure(ctx, centerX, headY, px, helmetStyle, palette, hasCrest, crestColor);
}

function drawHelmetOnFigure(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  headY: number,
  px: number,
  style: HelmetStyle,
  palette: Palette,
  hasCrest: boolean,
  crestColor: string
): void {
  // Base head shape (all helmets have this)
  drawPixel(ctx, centerX - 3 * px, headY, 6 * px, 6 * px, palette.main);
  drawPixel(ctx, centerX - 2 * px, headY + 1 * px, 4 * px, 4 * px, palette.light);
  
  // Face slit / visor
  drawPixel(ctx, centerX - 2 * px, headY + 3 * px, 4 * px, 1 * px, "#1A1A1A");

  switch (style) {
    case "galea":
      // Classic Roman soldier helmet with cheek guards
      drawPixel(ctx, centerX - 4 * px, headY + 2 * px, 1 * px, 4 * px, palette.main); // left cheek
      drawPixel(ctx, centerX + 3 * px, headY + 2 * px, 1 * px, 4 * px, palette.main); // right cheek
      drawPixel(ctx, centerX - 3 * px, headY - 1 * px, 6 * px, 1 * px, palette.dark); // brow ridge
      if (hasCrest) {
        // Forward-facing crest
        for (let i = 0; i < 5; i++) {
          drawPixel(ctx, centerX - 1 * px, headY - (2 + i) * px, 2 * px, 1 * px, crestColor);
        }
      }
      break;

    case "murmillo":
      // Fish-shaped crest helmet, tall and distinctive
      drawPixel(ctx, centerX - 4 * px, headY - 1 * px, 8 * px, 2 * px, palette.main); // wide brim
      drawPixel(ctx, centerX - 2 * px, headY - 2 * px, 4 * px, 1 * px, palette.dark); // top
      if (hasCrest) {
        // Tall fish-fin style crest
        drawPixel(ctx, centerX - 1 * px, headY - 6 * px, 2 * px, 4 * px, crestColor);
        drawPixel(ctx, centerX, headY - 8 * px, 1 * px, 2 * px, crestColor);
      }
      break;

    case "thraex":
      // Griffin-crested helmet with wide brim
      drawPixel(ctx, centerX - 4 * px, headY + 1 * px, 8 * px, 1 * px, palette.main); // wide visor
      drawPixel(ctx, centerX - 3 * px, headY - 1 * px, 6 * px, 1 * px, palette.dark);
      if (hasCrest) {
        // Curved griffin crest
        drawPixel(ctx, centerX - 1 * px, headY - 3 * px, 2 * px, 2 * px, crestColor);
        drawPixel(ctx, centerX + 1 * px, headY - 5 * px, 2 * px, 2 * px, crestColor);
        drawPixel(ctx, centerX + 2 * px, headY - 6 * px, 1 * px, 1 * px, crestColor);
      }
      break;

    case "hoplomachus":
      // Greek-style with feather plumes
      drawPixel(ctx, centerX - 4 * px, headY, 1 * px, 6 * px, palette.main); // left guard
      drawPixel(ctx, centerX + 3 * px, headY, 1 * px, 6 * px, palette.main); // right guard
      drawPixel(ctx, centerX - 3 * px, headY - 1 * px, 6 * px, 1 * px, palette.light); // crown
      if (hasCrest) {
        // Multiple feather plumes
        drawPixel(ctx, centerX - 2 * px, headY - 4 * px, 1 * px, 3 * px, crestColor);
        drawPixel(ctx, centerX, headY - 5 * px, 1 * px, 4 * px, crestColor);
        drawPixel(ctx, centerX + 2 * px, headY - 4 * px, 1 * px, 3 * px, crestColor);
      }
      break;
  }
}

export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  percent: number,
  colors: { bg: string; fill: string; border: string }
): void {
  const stoneGradient = ctx.createLinearGradient(x, y, x, y + height);
  stoneGradient.addColorStop(0, "#E8E4D9");
  stoneGradient.addColorStop(0.3, "#D4CFC4");
  stoneGradient.addColorStop(0.7, "#C8C3B8");
  stoneGradient.addColorStop(1, "#B8B3A8");
  ctx.fillStyle = stoneGradient;
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = "#8B8578";
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) {
    const lineY = y + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, lineY);
    ctx.lineTo(x + width, lineY);
    ctx.stroke();
  }

  const fillWidth = Math.max(0, Math.min(1, percent)) * width;
  if (fillWidth > 0) {
    const fillGradient = ctx.createLinearGradient(x, y, x, y + height);
    fillGradient.addColorStop(0, "#C46A4E");
    fillGradient.addColorStop(0.5, "#A85A3E");
    fillGradient.addColorStop(1, "#8B4A2E");
    ctx.fillStyle = fillGradient;
    ctx.fillRect(x + 1, y + 1, fillWidth - 2, height - 2);
  }

  ctx.strokeStyle = "#6B5B4F";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  ctx.strokeStyle = "#4A3F35";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);

  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(x + 2, y + 2, width - 4, height * 0.3);
}

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number = 12,
  color: string = "#3D2914"
): void {
  ctx.font = `bold ${fontSize}px "Cinzel", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fillText(text, x + 1, y + 1);

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

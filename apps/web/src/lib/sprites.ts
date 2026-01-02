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
  aggressive: "#FF0051",
  conservative: "#00D9FF",
  social: "#FFD700",
  whale_follower: "#9B59B6",
  sniper: "#00FF41",
  momentum: "#FF8C00",
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

export function generatePixelAvatar(
  seed: string,
  size: number = 32
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const hash = seed.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const hue = Math.abs(hash % 360);
  const mainColor = `hsl(${hue}, 70%, 50%)`;
  const darkColor = `hsl(${hue}, 70%, 30%)`;
  const lightColor = `hsl(${hue}, 70%, 70%)`;

  const pixelSize = size / 8;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const shouldDraw = ((hash >> (y * 4 + x)) & 1) === 1;
      if (shouldDraw) {
        const colorChoice = ((hash >> (y * 4 + x + 16)) & 3);
        ctx.fillStyle =
          colorChoice === 0 ? mainColor : colorChoice === 1 ? darkColor : lightColor;

        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        ctx.fillRect((7 - x) * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
  }

  return canvas;
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
  ctx.fillStyle = colors.bg;
  ctx.fillRect(x, y, width, height);

  const fillWidth = Math.max(0, Math.min(1, percent)) * width;
  ctx.fillStyle = colors.fill;
  ctx.fillRect(x, y, fillWidth, height);

  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
}

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number = 8,
  color: string = "#00FF41"
): void {
  ctx.font = `${fontSize}px "Press Start 2P", monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

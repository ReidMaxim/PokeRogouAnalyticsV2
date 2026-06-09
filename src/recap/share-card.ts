import type { RunRecap } from "../analytics/run-recap";
import { formatRecapDuration } from "../analytics/run-recap";
import { getPokemonSpriteUrl } from "../shared/pokemon-sprites";

const CARD_WIDTH = 800;
const CARD_HEIGHT = 520;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function renderRecapSharePng(recap: RunRecap): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create canvas context");
  }

  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, "#1e293b");
  gradient.addColorStop(1, "#0f172a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 14px Segoe UI, system-ui, sans-serif";
  ctx.fillText("PokéRogue Analytics", 40, 42);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 32px Segoe UI, system-ui, sans-serif";
  ctx.fillText(recap.headline, 40, 88);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "400 16px Segoe UI, system-ui, sans-serif";
  const subtitle = `${recap.eventCount} events · ${formatRecapDuration(recap.durationMs)}`;
  ctx.fillText(subtitle, 40, 118);

  const stats: Array<[string, string | number]> = [
    ["Wave", recap.maxWave ?? "—"],
    ["Money", recap.finalMoney ?? "—"],
    ["Score", recap.finalScore ?? "—"],
    ["Biome", recap.currentBiome ?? "—"],
  ];

  let statX = 40;
  for (const [label, value] of stats) {
    roundRect(ctx, statX, 140, 170, 72, 12);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 12px Segoe UI, system-ui, sans-serif";
    ctx.fillText(label, statX + 16, 168);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 22px Segoe UI, system-ui, sans-serif";
    ctx.fillText(String(value), statX + 16, 198);
    statX += 182;
  }

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "600 16px Segoe UI, system-ui, sans-serif";
  ctx.fillText("Party", 40, 252);

  let partyX = 40;
  for (const member of recap.currentParty.slice(0, 6)) {
    const url = getPokemonSpriteUrl(member.speciesId);
    const img = url ? await loadImage(url) : null;

    roundRect(ctx, partyX, 268, 72, 88, 12);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();

    if (img) {
      ctx.drawImage(img, partyX + 12, 276, 48, 48);
    } else {
      ctx.fillStyle = "#64748b";
      ctx.font = "700 20px Segoe UI, system-ui, sans-serif";
      ctx.fillText(member.name.charAt(0).toUpperCase(), partyX + 30, 308);
    }

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 11px Segoe UI, system-ui, sans-serif";
    const name = member.name.length > 8 ? `${member.name.slice(0, 7)}…` : member.name;
    ctx.fillText(name, partyX + 8, 352);
    if (member.level != null) {
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Lv${member.level}`, partyX + 8, 368);
    }

    partyX += 82;
  }

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "600 16px Segoe UI, system-ui, sans-serif";
  ctx.fillText("Key Moments", 40, 404);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "400 15px Segoe UI, system-ui, sans-serif";
  let momentY = 430;
  for (const moment of recap.keyMoments.slice(0, 4)) {
    ctx.fillText(`• ${moment}`, 48, momentY);
    momentY += 24;
  }

  if (recap.personalBestNote) {
    ctx.fillStyle = "#fcd34d";
    ctx.font = "600 14px Segoe UI, system-ui, sans-serif";
    ctx.fillText(recap.personalBestNote, 40, CARD_HEIGHT - 28);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("PNG export failed"));
      }
    }, "image/png");
  });
}

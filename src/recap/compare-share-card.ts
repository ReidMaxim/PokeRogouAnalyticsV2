import { buildRunComparison } from "../analytics/run-compare";
import type { RunRecap } from "../analytics/run-recap";

const CARD_WIDTH = 800;
const CARD_HEIGHT = 560;
const PAD = 40;
const ROW_HEIGHT = 34;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export async function renderCompareSharePng(left: RunRecap, right: RunRecap): Promise<Blob> {
  const rows = buildRunComparison(left, right);
  const height = Math.max(CARD_HEIGHT, PAD * 2 + 120 + rows.length * ROW_HEIGHT);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create canvas context");
  }

  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, height);
  gradient.addColorStop(0, "#1e293b");
  gradient.addColorStop(1, "#0f172a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, height);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 14px Segoe UI, system-ui, sans-serif";
  ctx.fillText("PokéRogue Analytics — Run Comparison", PAD, 42);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 22px Segoe UI, system-ui, sans-serif";
  ctx.fillText("Run A", PAD, 78);
  ctx.fillText("Run B", CARD_WIDTH / 2 + 20, 78);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "500 14px Segoe UI, system-ui, sans-serif";
  ctx.fillText(truncate(left.headline, 34), PAD, 102);
  ctx.fillText(truncate(right.headline, 34), CARD_WIDTH / 2 + 20, 102);

  let y = 130;
  ctx.font = "600 12px Segoe UI, system-ui, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("STAT", PAD, y);
  ctx.fillText("RUN A", PAD + 180, y);
  ctx.fillText("RUN B", PAD + 400, y);
  y += 16;

  for (const row of rows) {
    y += ROW_HEIGHT;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 13px Segoe UI, system-ui, sans-serif";
    ctx.fillText(row.label, PAD, y);

    ctx.fillStyle = row.highlight === "left" ? "#4ade80" : "#e2e8f0";
    ctx.font = row.highlight === "left" ? "700 13px Segoe UI, system-ui, sans-serif" : "500 13px Segoe UI, system-ui, sans-serif";
    ctx.fillText(truncate(row.left, 28), PAD + 180, y);

    ctx.fillStyle = row.highlight === "right" ? "#4ade80" : "#e2e8f0";
    ctx.font = row.highlight === "right" ? "700 13px Segoe UI, system-ui, sans-serif" : "500 13px Segoe UI, system-ui, sans-serif";
    ctx.fillText(truncate(row.right, 28), PAD + 400, y);
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

export interface PanelDimensions {
  width: number;
  height: number;
}

export interface BattlePanelLayout {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MIN_WIDTH = 180;
const MAX_WIDTH_RATIO = 0.48;
const MIN_HEIGHT = 140;
const MAX_HEIGHT_RATIO = 0.78;

export function defaultPanelSize(side: "allies" | "enemies"): PanelDimensions {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = clamp(Math.round(vw * 0.24), MIN_WIDTH, Math.round(vw * MAX_WIDTH_RATIO));
  const height = clamp(Math.round(vh * 0.36), MIN_HEIGHT, Math.round(vh * MAX_HEIGHT_RATIO));
  return { width, height };
}

export function defaultPanelPosition(side: "allies" | "enemies", size: PanelDimensions): { left: number; top: number } {
  const margin = Math.max(8, Math.round(window.innerWidth * 0.01));
  const top = margin;
  if (side === "enemies") {
    return { left: margin, top };
  }
  return {
    left: Math.max(margin, window.innerWidth - size.width - margin),
    top,
  };
}

export function clampPanelToViewport(layout: BattlePanelLayout): BattlePanelLayout {
  const margin = 8;
  const maxWidth = Math.round(window.innerWidth * MAX_WIDTH_RATIO);
  const maxHeight = Math.round(window.innerHeight * MAX_HEIGHT_RATIO);
  const width = clamp(layout.width, MIN_WIDTH, maxWidth);
  const height = clamp(layout.height, MIN_HEIGHT, maxHeight);
  const left = clamp(layout.left, margin, Math.max(margin, window.innerWidth - width - margin));
  const top = clamp(layout.top, margin, Math.max(margin, window.innerHeight - height - margin));
  return { left, top, width, height };
}

export function panelScale(width: number, height: number): number {
  const baseW = 280;
  const baseH = 220;
  return clamp(Math.min(width / baseW, height / baseH), 0.75, 2.2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

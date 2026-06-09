export const BATTLE_CARDS_STYLES = `
#pr-dex-battle-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483647;
  font-family: "Segoe UI", system-ui, sans-serif;
}
.pr-dex-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  touch-action: none;
  box-sizing: border-box;
}
#pr-dex-enemies { left: 12px; top: 12px; }
#pr-dex-allies { right: auto; left: auto; top: 12px; }
.pr-dex-panel-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(51, 51, 51, 0.72);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  color: #f8fafc;
  overflow: hidden;
  container-type: size;
  font-size: clamp(10px, 4.5cqw, 16px);
}
.pr-dex-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0.45em 0.65em;
  background: rgba(0, 0, 0, 0.25);
  user-select: none;
  flex-shrink: 0;
}
.pr-dex-panel-label {
  cursor: grab;
  font-weight: 700;
  font-size: 1.05em;
  text-shadow: 1px 1px 0 #000;
}
.pr-dex-panel-label:active {
  cursor: grabbing;
}
.pr-dex-panel-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 2;
  pointer-events: auto;
}
.pr-dex-nav-btn, .pr-dex-close-btn {
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(0,0,0,0.3);
  color: #fff;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 0.85em;
}
.pr-dex-nav-btn:disabled { opacity: 0.35; cursor: default; }
.pr-dex-opacity {
  width: clamp(48px, 18cqw, 88px);
  accent-color: #60a5fa;
}
.pr-dex-card {
  padding: 0.65em;
  overflow: auto;
  flex: 1;
  min-height: 0;
}
.pr-dex-card-head {
  display: flex;
  gap: 0.65em;
  align-items: flex-start;
}
.pr-dex-sprite img, .pr-dex-fallback {
  display: block;
  width: clamp(36px, 22cqw, 80px);
  height: clamp(36px, 22cqw, 80px);
  image-rendering: pixelated;
}
.pr-dex-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.1);
  border-radius: 8px;
  font-size: 1.6em;
  font-weight: 700;
}
.pr-dex-title strong {
  display: block;
  font-size: 1.15em;
  text-shadow: 1px 1px 0 #000;
  line-height: 1.2;
}
.pr-dex-level { color: #cbd5e1; font-size: 0.85em; }
.pr-dex-index { color: #94a3b8; font-size: 0.85em; margin-left: auto; }
.pr-dex-types { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.pr-dex-type-chip {
  padding: 0.1em 0.45em;
  border-radius: 999px;
  font-size: 0.75em;
  font-weight: 600;
  text-transform: capitalize;
}
.pr-dex-ability {
  margin: 0.55em 0 0.35em;
  font-size: 0.85em;
  color: #e2e8f0;
  cursor: help;
  line-height: 1.35;
}
.pr-dex-band {
  margin-top: 0.45em;
  padding: 0.35em 0.45em;
  border-radius: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.pr-dex-band-label {
  font-size: 0.72em;
  font-weight: 700;
  min-width: 3.2em;
  text-transform: uppercase;
}
.pr-dex-band.weak { background: rgba(239, 68, 68, 0.25); }
.pr-dex-band.resist { background: rgba(34, 197, 94, 0.25); }
.pr-dex-band.immune { background: rgba(148, 163, 184, 0.25); }
.pr-dex-resize-handle {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  z-index: 3;
  pointer-events: auto;
  opacity: 0.55;
}
.pr-dex-resize-handle::before {
  content: "";
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 10px;
  height: 10px;
  border-right: 2px solid rgba(255,255,255,0.85);
  border-bottom: 2px solid rgba(255,255,255,0.85);
}
.pr-dex-type-chip.normal { background: #a8a878; }
.pr-dex-type-chip.fire { background: #f08030; }
.pr-dex-type-chip.water { background: #6890f0; }
.pr-dex-type-chip.electric { background: #f8d030; color: #1e293b; }
.pr-dex-type-chip.grass { background: #78c850; }
.pr-dex-type-chip.ice { background: #98d8d8; color: #1e293b; }
.pr-dex-type-chip.fighting { background: #c03028; }
.pr-dex-type-chip.poison { background: #a040a0; }
.pr-dex-type-chip.ground { background: #e0c068; color: #1e293b; }
.pr-dex-type-chip.flying { background: #a890f0; }
.pr-dex-type-chip.psychic { background: #f85888; }
.pr-dex-type-chip.bug { background: #a8b820; color: #1e293b; }
.pr-dex-type-chip.rock { background: #b8a038; color: #1e293b; }
.pr-dex-type-chip.ghost { background: #705898; }
.pr-dex-type-chip.dragon { background: #7038f8; }
.pr-dex-type-chip.dark { background: #705848; }
.pr-dex-type-chip.steel { background: #b8b8d0; color: #1e293b; }
.pr-dex-type-chip.fairy { background: #ee99ac; color: #1e293b; }
`;

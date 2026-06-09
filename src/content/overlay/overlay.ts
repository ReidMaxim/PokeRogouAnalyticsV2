import { formatBiomeName } from "../../shared/biome-names";
import type { GameStateSnapshot } from "../game-access/types";

export interface OverlayViewState {
  wave: number | null;
  money: number | null;
  score: number | null;
  biome: string | null;
  starterName: string | null;
  trainerName: string | null;
  phase: string | null;
  isBoss: boolean;
  modifierCount: number;
  voucherTotal: number;
  runId: string | null;
  collectionEnabled: boolean;
  gameCaptured: boolean;
  battleSceneActive: boolean;
}

const OVERLAY_ID = "pr-analytics-overlay";

function formatOverlayPhase(phase: string | null | undefined): string | null {
  if (!phase) {
    return null;
  }
  return phase.replace(/Phase$/, "").trim() || phase;
}

const STYLES = `
#${OVERLAY_ID} {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 2147483646;
  font-family: "Segoe UI", system-ui, sans-serif;
  font-size: 12px;
  color: #f8fafc;
  pointer-events: auto;
  touch-action: none;
}
#${OVERLAY_ID} .pr-card {
  min-width: 168px;
  border-radius: 12px;
  border: 1px solid rgba(96, 165, 250, 0.35);
  background: rgba(15, 23, 42, 0.92);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  overflow: hidden;
}
#${OVERLAY_ID} .pr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(96, 165, 250, 0.12);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  cursor: grab;
  user-select: none;
}
#${OVERLAY_ID} .pr-head.dragging {
  cursor: grabbing;
}
#${OVERLAY_ID} .pr-title {
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #93c5fd;
}
#${OVERLAY_ID} .pr-actions button {
  border: 0;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 0 4px;
  font-size: 14px;
  line-height: 1;
}
#${OVERLAY_ID} .pr-body {
  padding: 10px;
}
#${OVERLAY_ID} .pr-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}
#${OVERLAY_ID} .pr-row:last-child {
  margin-bottom: 0;
}
#${OVERLAY_ID} .pr-label {
  color: #94a3b8;
}
#${OVERLAY_ID} .pr-value {
  font-weight: 700;
  text-align: right;
}
#${OVERLAY_ID} .pr-status {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 6px;
  color: #94a3b8;
  font-size: 11px;
}
#${OVERLAY_ID} .pr-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}
#${OVERLAY_ID} .pr-dot.live {
  background: #4ade80;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
}
#${OVERLAY_ID} .pr-dot.waiting {
  background: #fbbf24;
}
#${OVERLAY_ID}.collapsed .pr-body {
  display: none;
}
#${OVERLAY_ID}.collapsed .pr-card {
  min-width: auto;
}
`;

export class AnalyticsOverlay {
  private root: HTMLElement | null = null;
  private collapsed = false;
  private onPositionChange: ((left: number, top: number) => void) | null = null;
  private dragInstalled = false;

  mount(onPositionChange?: (left: number, top: number) => void): void {
    this.onPositionChange = onPositionChange ?? null;

    if (this.root || document.getElementById(OVERLAY_ID)) {
      this.root = document.getElementById(OVERLAY_ID);
      if (this.root && !this.dragInstalled) {
        this.installDrag();
      }
      return;
    }

    if (!document.getElementById("pr-analytics-overlay-styles")) {
      const style = document.createElement("style");
      style.id = "pr-analytics-overlay-styles";
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    this.root = document.createElement("div");
    this.root.id = OVERLAY_ID;
    this.root.innerHTML = `
      <div class="pr-card">
        <div class="pr-head">
          <span class="pr-title">Analytics</span>
          <div class="pr-actions">
            <button type="button" data-action="collapse" title="Collapse">−</button>
          </div>
        </div>
        <div class="pr-body">
          <div class="pr-row"><span class="pr-label">Wave</span><span class="pr-value" data-field="wave">—</span></div>
          <div class="pr-row"><span class="pr-label">Money</span><span class="pr-value" data-field="money">—</span></div>
          <div class="pr-row"><span class="pr-label">Score</span><span class="pr-value" data-field="score">—</span></div>
          <div class="pr-row"><span class="pr-label">Starter</span><span class="pr-value" data-field="starter">—</span></div>
          <div class="pr-row"><span class="pr-label">Biome</span><span class="pr-value" data-field="biome">—</span></div>
          <div class="pr-row"><span class="pr-label">Phase</span><span class="pr-value" data-field="phase">—</span></div>
          <div class="pr-row"><span class="pr-label">Modifiers</span><span class="pr-value" data-field="modifiers">—</span></div>
          <div class="pr-status">
            <span class="pr-dot waiting" data-field="dot"></span>
            <span data-field="status">Waiting for game…</span>
          </div>
        </div>
      </div>
    `;

    this.root.querySelector('[data-action="collapse"]')?.addEventListener("click", () => {
      this.collapsed = !this.collapsed;
      this.root?.classList.toggle("collapsed", this.collapsed);
      const btn = this.root?.querySelector('[data-action="collapse"]');
      if (btn) {
        btn.textContent = this.collapsed ? "+" : "−";
      }
    });

    document.body.appendChild(this.root);
    this.installDrag();
  }

  applyPosition(left: number | null | undefined, top: number | null | undefined): void {
    if (!this.root) {
      return;
    }

    if (typeof left === "number" && typeof top === "number") {
      this.root.style.right = "auto";
      this.root.style.bottom = "auto";
      this.root.style.left = `${Math.max(0, left)}px`;
      this.root.style.top = `${Math.max(0, top)}px`;
      return;
    }

    this.root.style.left = "auto";
    this.root.style.top = "auto";
    this.root.style.right = "12px";
    this.root.style.bottom = "12px";
  }

  private installDrag(): void {
    if (!this.root || this.dragInstalled) {
      return;
    }

    const head = this.root.querySelector(".pr-head") as HTMLElement | null;
    if (!head) {
      return;
    }

    this.dragInstalled = true;

    head.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }
      if ((event.target as HTMLElement).closest("button")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const root = this.root;
      if (!root) {
        return;
      }

      head.classList.add("dragging");

      const rect = root.getBoundingClientRect();
      root.style.right = "auto";
      root.style.bottom = "auto";
      root.style.left = `${rect.left}px`;
      root.style.top = `${rect.top}px`;

      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      const onMove = (moveEvent: MouseEvent): void => {
        moveEvent.preventDefault();
        const maxLeft = Math.max(0, window.innerWidth - root.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - root.offsetHeight);
        const left = Math.min(maxLeft, Math.max(0, moveEvent.clientX - offsetX));
        const top = Math.min(maxTop, Math.max(0, moveEvent.clientY - offsetY));
        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
      };

      const onUp = (upEvent: MouseEvent): void => {
        upEvent.preventDefault();
        head.classList.remove("dragging");
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);

        const left = parseFloat(root.style.left) || root.getBoundingClientRect().left;
        const top = parseFloat(root.style.top) || root.getBoundingClientRect().top;
        this.onPositionChange?.(Math.round(left), Math.round(top));
      };

      // Capture phase so Phaser/canvas handlers don't swallow move/up events.
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
    });
  }

  unmount(): void {
    this.root?.remove();
    this.root = null;
    this.dragInstalled = false;
  }

  update(state: OverlayViewState): void {
    if (!this.root) {
      return;
    }

    const waveEl = this.root.querySelector('[data-field="wave"]');
    const moneyEl = this.root.querySelector('[data-field="money"]');
    const scoreEl = this.root.querySelector('[data-field="score"]');
    const starterEl = this.root.querySelector('[data-field="starter"]');
    const biomeEl = this.root.querySelector('[data-field="biome"]');
    const phaseEl = this.root.querySelector('[data-field="phase"]');
    const modifiersEl = this.root.querySelector('[data-field="modifiers"]');
    const statusEl = this.root.querySelector('[data-field="status"]');
    const dotEl = this.root.querySelector('[data-field="dot"]');

    if (waveEl) {
      waveEl.textContent = state.wave != null ? String(state.wave) : "—";
    }
    if (moneyEl) {
      moneyEl.textContent = state.money != null ? String(state.money) : "—";
    }
    if (scoreEl) {
      scoreEl.textContent = state.score != null ? String(state.score) : "—";
    }
    if (starterEl) {
      starterEl.textContent = state.starterName ?? "—";
    }
    if (biomeEl) {
      biomeEl.textContent = state.biome ?? "—";
    }
    if (phaseEl) {
      phaseEl.textContent = state.phase ?? "—";
    }
    if (modifiersEl) {
      modifiersEl.textContent = state.modifierCount > 0 ? String(state.modifierCount) : "—";
    }

    let status = "Game not captured";
    let dotClass = "pr-dot waiting";

    if (state.gameCaptured) {
      if (!state.battleSceneActive) {
        status = state.collectionEnabled ? "Collection on · menu" : "Collection off";
        dotClass = state.collectionEnabled ? "pr-dot waiting" : "pr-dot";
      } else if (state.collectionEnabled) {
        status = "Logging run data";
        dotClass = "pr-dot live";
      } else {
        status = "Collection paused";
        dotClass = "pr-dot";
      }
    }

    if (statusEl) {
      statusEl.textContent = status;
    }
    if (dotEl) {
      dotEl.className = dotClass;
    }
  }
}

export function overlayStateFromSnapshot(
  snapshot: GameStateSnapshot | null | undefined,
  collectionEnabled: boolean,
): OverlayViewState {
  if (!snapshot) {
    return {
      wave: null,
      money: null,
      score: null,
      biome: null,
      starterName: null,
      trainerName: null,
      phase: null,
      isBoss: false,
      modifierCount: 0,
      voucherTotal: 0,
      runId: null,
      collectionEnabled,
      gameCaptured: false,
      battleSceneActive: false,
    };
  }

  return {
    wave: snapshot.wave,
    money: snapshot.money,
    score: snapshot.score,
    biome: formatBiomeName(snapshot.biome),
    starterName: snapshot.party[0]?.name ?? null,
    trainerName: snapshot.trainerName,
    phase: formatOverlayPhase(snapshot.phase),
    isBoss: snapshot.isBoss === true,
    modifierCount: snapshot.modifierCount ?? 0,
    voucherTotal: snapshot.voucherTotal ?? 0,
    runId: snapshot.runId,
    collectionEnabled,
    gameCaptured: snapshot.gameCaptured,
    battleSceneActive: snapshot.battleSceneActive,
  };
}

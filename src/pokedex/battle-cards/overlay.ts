import type { EnrichedBattleSpecies } from "../types";
import { renderBattleCard } from "./card-renderer";
import {
  clampPanelToViewport,
  defaultPanelPosition,
  defaultPanelSize,
  type BattlePanelLayout,
} from "./panel-layout";
import { BATTLE_CARDS_STYLES } from "./styles";

export type BattlePanelSide = "allies" | "enemies";

interface PanelState {
  species: EnrichedBattleSpecies[];
  index: number;
  opacity: number;
  layout: BattlePanelLayout;
  userSized: boolean;
}

export interface BattleCardsLayoutSnapshot {
  alliesLeft: number;
  alliesTop: number;
  alliesWidth: number;
  alliesHeight: number;
  enemiesLeft: number;
  enemiesTop: number;
  enemiesWidth: number;
  enemiesHeight: number;
}

export class BattleCardsOverlay {
  private root: HTMLElement | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private allies: PanelState = this.createPanelState("allies");
  private enemies: PanelState = this.createPanelState("enemies");
  private onLayoutChanged: (() => void) | null = null;
  private windowResizeListener: (() => void) | null = null;
  private dragState: {
    panel: HTMLElement;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null = null;
  private resizeState: {
    side: BattlePanelSide;
    panel: HTMLElement;
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
  } | null = null;

  setOnLayoutChanged(listener: (() => void) | null): void {
    this.onLayoutChanged = listener;
  }

  mount(): void {
    if (this.root) {
      return;
    }

    this.styleEl = document.createElement("style");
    this.styleEl.textContent = BATTLE_CARDS_STYLES;
    document.head.appendChild(this.styleEl);

    this.root = document.createElement("div");
    this.root.id = "pr-dex-battle-root";
    this.root.innerHTML = `
      <div id="pr-dex-enemies" class="pr-dex-panel"></div>
      <div id="pr-dex-allies" class="pr-dex-panel"></div>
    `;
    document.body.appendChild(this.root);

    this.bindDrag(document.getElementById("pr-dex-enemies")!, "enemies");
    this.bindDrag(document.getElementById("pr-dex-allies")!, "allies");

    this.windowResizeListener = () => this.handleWindowResize();
    window.addEventListener("resize", this.windowResizeListener);
  }

  unmount(): void {
    if (this.windowResizeListener) {
      window.removeEventListener("resize", this.windowResizeListener);
      this.windowResizeListener = null;
    }
    this.root?.remove();
    this.styleEl?.remove();
    this.root = null;
    this.styleEl = null;
  }

  applyLayout(snapshot: Partial<BattleCardsLayoutSnapshot>): void {
    const alliesHasSize = snapshot.alliesWidth != null && snapshot.alliesHeight != null;
    const enemiesHasSize = snapshot.enemiesWidth != null && snapshot.enemiesHeight != null;
    this.applySideLayout(
      "allies",
      {
        left: snapshot.alliesLeft,
        top: snapshot.alliesTop,
        width: snapshot.alliesWidth,
        height: snapshot.alliesHeight,
      },
      alliesHasSize,
    );
    this.applySideLayout(
      "enemies",
      {
        left: snapshot.enemiesLeft,
        top: snapshot.enemiesTop,
        width: snapshot.enemiesWidth,
        height: snapshot.enemiesHeight,
      },
      enemiesHasSize,
    );
    this.paintLayouts();
  }

  getLayoutSnapshot(): BattleCardsLayoutSnapshot {
    return {
      alliesLeft: this.allies.layout.left,
      alliesTop: this.allies.layout.top,
      alliesWidth: this.allies.layout.width,
      alliesHeight: this.allies.layout.height,
      enemiesLeft: this.enemies.layout.left,
      enemiesTop: this.enemies.layout.top,
      enemiesWidth: this.enemies.layout.width,
      enemiesHeight: this.enemies.layout.height,
    };
  }

  update(allies: EnrichedBattleSpecies[], enemies: EnrichedBattleSpecies[]): void {
    if (!this.root) {
      this.mount();
    }
    this.allies.species = allies;
    this.enemies.species = enemies;
    if (this.allies.index >= allies.length) {
      this.allies.index = 0;
    }
    if (this.enemies.index >= enemies.length) {
      this.enemies.index = 0;
    }
    this.renderPanel("allies");
    this.renderPanel("enemies");
  }

  private createPanelState(side: BattlePanelSide): PanelState {
    const size = defaultPanelSize(side);
    const position = defaultPanelPosition(side, size);
    return {
      species: [],
      index: 0,
      opacity: 100,
      userSized: false,
      layout: clampPanelToViewport({
        left: position.left,
        top: position.top,
        width: size.width,
        height: size.height,
      }),
    };
  }

  private applySideLayout(
    side: BattlePanelSide,
    values: { left?: number | null; top?: number | null; width?: number | null; height?: number | null },
    markUserSized = false,
  ): void {
    const state = side === "allies" ? this.allies : this.enemies;
    if (markUserSized) {
      state.userSized = true;
    }
    if (values.left != null) {
      state.layout.left = values.left;
    }
    if (values.top != null) {
      state.layout.top = values.top;
    }
    if (values.width != null) {
      state.layout.width = values.width;
    }
    if (values.height != null) {
      state.layout.height = values.height;
    }
    state.layout = clampPanelToViewport(state.layout);
  }

  private handleWindowResize(): void {
    for (const side of ["allies", "enemies"] as const) {
      const state = side === "allies" ? this.allies : this.enemies;
      if (!state.userSized) {
        const size = defaultPanelSize(side);
        const position = defaultPanelPosition(side, size);
        state.layout = clampPanelToViewport({
          left: position.left,
          top: position.top,
          width: size.width,
          height: size.height,
        });
      } else {
        state.layout = clampPanelToViewport(state.layout);
      }
    }
    this.paintLayouts();
    this.renderPanel("allies");
    this.renderPanel("enemies");
  }

  private paintLayouts(): void {
    this.paintPanel("allies");
    this.paintPanel("enemies");
  }

  private paintPanel(side: BattlePanelSide): void {
    const panelId = side === "allies" ? "pr-dex-allies" : "pr-dex-enemies";
    const panel = document.getElementById(panelId);
    if (!panel) {
      return;
    }
    const state = side === "allies" ? this.allies : this.enemies;
    panel.style.left = `${state.layout.left}px`;
    panel.style.top = `${state.layout.top}px`;
    panel.style.width = `${state.layout.width}px`;
    panel.style.height = `${state.layout.height}px`;
    panel.style.right = "auto";
    panel.style.opacity = String(state.opacity / 100);
  }

  private renderPanel(side: BattlePanelSide): void {
    const panelId = side === "allies" ? "pr-dex-allies" : "pr-dex-enemies";
    const panel = document.getElementById(panelId);
    if (!panel) {
      return;
    }

    const state = side === "allies" ? this.allies : this.enemies;
    const label = side === "allies" ? "Allies" : "Enemies";
    this.paintPanel(side);

    if (state.species.length === 0) {
      panel.innerHTML = "";
      return;
    }

    const current = state.species[state.index];
    const cardHtml = renderBattleCard(current, state.index, state.species.length);

    panel.innerHTML = `
      <div class="pr-dex-panel-inner">
        <div class="pr-dex-panel-head" data-side="${side}">
          <span class="pr-dex-panel-label">${label}</span>
          <div class="pr-dex-panel-controls">
            <button type="button" class="pr-dex-nav-btn" data-action="prev" data-side="${side}" ${state.index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="pr-dex-nav-btn" data-action="next" data-side="${side}" ${state.index >= state.species.length - 1 ? "disabled" : ""}>↓</button>
            <input type="range" class="pr-dex-opacity" min="10" max="100" value="${state.opacity}" data-side="${side}" aria-label="Opacity" />
          </div>
        </div>
        ${cardHtml}
        <span class="pr-dex-resize-handle" data-side="${side}" aria-label="Resize panel" title="Drag to resize"></span>
      </div>
    `;

    panel.querySelectorAll(".pr-dex-nav-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = event.currentTarget as HTMLButtonElement;
        if (target.disabled) {
          return;
        }
        const action = target.dataset.action;
        const panelSide = target.dataset.side as BattlePanelSide;
        this.navigate(panelSide, action === "next" ? 1 : -1);
      });
      btn.addEventListener("pointerdown", (event) => event.stopPropagation());
    });

    const slider = panel.querySelector(".pr-dex-opacity") as HTMLInputElement | null;
    slider?.addEventListener("input", (event) => {
      event.stopPropagation();
      const panelSide = slider.dataset.side as BattlePanelSide;
      const panelState = panelSide === "allies" ? this.allies : this.enemies;
      panelState.opacity = Number(slider.value);
      panel.style.opacity = String(panelState.opacity / 100);
    });
    slider?.addEventListener("pointerdown", (event) => event.stopPropagation());

    const resizeHandle = panel.querySelector(".pr-dex-resize-handle") as HTMLElement | null;
    resizeHandle?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const panelSide = resizeHandle.dataset.side as BattlePanelSide;
      const panelState = panelSide === "allies" ? this.allies : this.enemies;
      resizeHandle.setPointerCapture(event.pointerId);
      this.resizeState = {
        side: panelSide,
        panel,
        startX: event.clientX,
        startY: event.clientY,
        originWidth: panelState.layout.width,
        originHeight: panelState.layout.height,
      };
    });
    resizeHandle?.addEventListener("pointermove", (event) => {
      if (!this.resizeState || this.resizeState.panel !== panel) {
        return;
      }
      const dx = event.clientX - this.resizeState.startX;
      const dy = event.clientY - this.resizeState.startY;
      const panelState = this.resizeState.side === "allies" ? this.allies : this.enemies;
      panelState.userSized = true;
      panelState.layout = clampPanelToViewport({
        ...panelState.layout,
        width: this.resizeState.originWidth + dx,
        height: this.resizeState.originHeight + dy,
      });
      this.paintPanel(this.resizeState.side);
    });
    resizeHandle?.addEventListener("pointerup", () => {
      if (this.resizeState?.panel === panel) {
        this.resizeState = null;
        this.onLayoutChanged?.();
      }
    });
  }

  private navigate(side: BattlePanelSide, delta: number): void {
    const state = side === "allies" ? this.allies : this.enemies;
    state.index = Math.max(0, Math.min(state.species.length - 1, state.index + delta));
    this.renderPanel(side);
  }

  private bindDrag(panel: HTMLElement, side: BattlePanelSide): void {
    panel.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(".pr-dex-panel-controls") ||
        target.closest(".pr-dex-resize-handle") ||
        target.closest("button") ||
        target.closest("input")
      ) {
        return;
      }
      if (!target.closest(".pr-dex-panel-label")) {
        return;
      }
      event.preventDefault();
      panel.setPointerCapture(event.pointerId);
      const state = side === "allies" ? this.allies : this.enemies;
      this.dragState = {
        panel,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: state.layout.left,
        originTop: state.layout.top,
      };
    });

    panel.addEventListener("pointermove", (event) => {
      if (!this.dragState || this.dragState.panel !== panel) {
        return;
      }
      const dx = event.clientX - this.dragState.startX;
      const dy = event.clientY - this.dragState.startY;
      const state = side === "allies" ? this.allies : this.enemies;
      state.layout = clampPanelToViewport({
        ...state.layout,
        left: this.dragState.originLeft + dx,
        top: this.dragState.originTop + dy,
      });
      this.paintPanel(side);
    });

    panel.addEventListener("pointerup", () => {
      const wasDragging = this.dragState?.panel === panel;
      this.dragState = null;
      if (wasDragging) {
        this.onLayoutChanged?.();
      }
    });
  }
}

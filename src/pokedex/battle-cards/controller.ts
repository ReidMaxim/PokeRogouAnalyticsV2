import { MESSAGE_SOURCE } from "../../shared/constants";
import { createLogger } from "../../shared/logger";
import type { ExtensionSettings } from "../../shared/types";
import { updateSettings } from "../../storage/settings";
import type { GameStateSnapshot } from "../../content/game-access/types";
import type { BattleSpeciesInput, EnrichedBattleSpecies } from "../types";
import { BattleCardsOverlay } from "./overlay";

const logger = createLogger("pokedex/battle-cards");

const BATTLE_UI_MODES = new Set(["MESSAGE", "COMMAND", "CONFIRM"]);

type SnapshotFetcher = () => Promise<GameStateSnapshot | null>;

export class BattleCardsController {
  private overlay = new BattleCardsOverlay();
  private observer: MutationObserver | null = null;
  private visible = false;
  private refreshTimer: number | null = null;
  private lastSignature = "";

  constructor(
    private fetchSnapshot: SnapshotFetcher,
    private getSettings: () => ExtensionSettings | null,
  ) {}

  start(): void {
    if (this.observer) {
      return;
    }

    const observe = (): void => {
      const touchControls = document.querySelector("#touchControls");
      if (!touchControls) {
        window.setTimeout(observe, 500);
        return;
      }

      this.observer = new MutationObserver(() => {
        void this.handleUiModeChange();
      });
      this.observer.observe(touchControls, { attributes: true, attributeFilter: ["data-ui-mode"] });
      void this.handleUiModeChange();
      logger.info("Battle cards UI mode observer started");
    };

    observe();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.stopRefresh();
    this.hide();
  }

  applySettings(settings: ExtensionSettings): void {
    this.overlay.applyLayout({
      alliesLeft: settings.battleCardsAlliesLeft ?? undefined,
      alliesTop: settings.battleCardsAlliesTop ?? undefined,
      alliesWidth: settings.battleCardsAlliesWidth ?? undefined,
      alliesHeight: settings.battleCardsAlliesHeight ?? undefined,
      enemiesLeft: settings.battleCardsEnemiesLeft ?? undefined,
      enemiesTop: settings.battleCardsEnemiesTop ?? undefined,
      enemiesWidth: settings.battleCardsEnemiesWidth ?? undefined,
      enemiesHeight: settings.battleCardsEnemiesHeight ?? undefined,
    });

    if (!settings.battleCardsEnabled) {
      this.hide();
      return;
    }

    if (!this.observer) {
      this.start();
    }
  }

  private async handleUiModeChange(): Promise<void> {
    const settings = this.getSettings();
    if (!settings?.battleCardsEnabled) {
      this.hide();
      return;
    }

    const touchControls = document.querySelector("#touchControls");
    const mode = touchControls?.getAttribute("data-ui-mode") ?? "";
    if (BATTLE_UI_MODES.has(mode)) {
      this.show();
      await this.refreshCards();
      this.startRefresh();
    } else {
      this.hide();
    }
  }

  private show(): void {
    if (this.visible) {
      return;
    }
    this.overlay.setOnLayoutChanged(() => {
      void this.persistLayout();
    });
    this.overlay.mount();
    const settings = this.getSettings();
    if (settings) {
      this.applySettings(settings);
    }
    this.visible = true;
  }

  private hide(): void {
    this.stopRefresh();
    this.overlay.unmount();
    this.visible = false;
    this.lastSignature = "";
  }

  private startRefresh(): void {
    this.stopRefresh();
    this.refreshTimer = window.setInterval(() => {
      void this.refreshCards();
    }, 2000);
  }

  private stopRefresh(): void {
    if (this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async refreshCards(): Promise<void> {
    const snapshot = await this.fetchSnapshot();
    if (!snapshot) {
      return;
    }

    const allies = mapParty(pickBattleSide(snapshot.playerField, snapshot.party));
    const enemies = mapParty(pickBattleSide(snapshot.enemyField, snapshot.enemyParty));
    const signature = JSON.stringify({ allies, enemies });
    if (signature === this.lastSignature) {
      return;
    }
    this.lastSignature = signature;

    try {
      const response = (await chrome.runtime.sendMessage({
        source: MESSAGE_SOURCE.CONTENT,
        type: "ENRICH_BATTLE_SPECIES",
        payload: { allies, enemies },
      })) as {
        ok?: boolean;
        allies?: EnrichedBattleSpecies[];
        enemies?: EnrichedBattleSpecies[];
      };

      if (!response?.ok) {
        return;
      }

      this.overlay.update(response.allies ?? [], response.enemies ?? []);
    } catch (error) {
      logger.warn("Battle card enrichment failed", error);
    }
  }

  private async persistLayout(): Promise<void> {
    const layout = this.overlay.getLayoutSnapshot();
    await updateSettings({
      battleCardsAlliesLeft: layout.alliesLeft,
      battleCardsAlliesTop: layout.alliesTop,
      battleCardsAlliesWidth: layout.alliesWidth,
      battleCardsAlliesHeight: layout.alliesHeight,
      battleCardsEnemiesLeft: layout.enemiesLeft,
      battleCardsEnemiesTop: layout.enemiesTop,
      battleCardsEnemiesWidth: layout.enemiesWidth,
      battleCardsEnemiesHeight: layout.enemiesHeight,
    });
  }
}

function pickBattleSide(
  field: Array<{
    name: string;
    level: number | null;
    speciesId: number | null;
    ability?: string | null;
  }>,
  party: Array<{
    name: string;
    level: number | null;
    speciesId: number | null;
    ability?: string | null;
  }>,
): Array<{
  name: string;
  level: number | null;
  speciesId: number | null;
  ability?: string | null;
}> {
  return field.length > 0 ? field : party;
}

function mapParty(
  party: Array<{
    name: string;
    level: number | null;
    speciesId: number | null;
    ability?: string | null;
  }>,
): BattleSpeciesInput[] {
  return party.map((member) => ({
    speciesId: member.speciesId,
    name: member.name,
    level: member.level,
    ability: member.ability ?? null,
  }));
}

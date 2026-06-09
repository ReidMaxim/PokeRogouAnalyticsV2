import { createLogger } from "../../shared/logger";
import type { PhaserGameLike, PokerogueAnalyticsRoot } from "./types";

const logger = createLogger("phaser-hook");

const HOOK_FLAG = "__POKEROGUE_ANALYTICS_PHASER_HOOKED__";

interface PhaserNamespace {
  Game: new (...args: unknown[]) => PhaserGameLike;
}

function getAnalyticsRoot(): PokerogueAnalyticsRoot {
  const win = window as unknown as Record<string, unknown>;
  if (!win.__POKEROGUE_ANALYTICS__ || typeof win.__POKEROGUE_ANALYTICS__ !== "object") {
    win.__POKEROGUE_ANALYTICS__ = {};
  }
  return win.__POKEROGUE_ANALYTICS__ as PokerogueAnalyticsRoot;
}

function installPhaserHook(Phaser: PhaserNamespace): boolean {
  const phaserRecord = Phaser as unknown as Record<string, unknown>;
  if (phaserRecord[HOOK_FLAG]) {
    return true;
  }

  const OriginalGame = Phaser.Game;
  if (typeof OriginalGame !== "function") {
    return false;
  }

  const HookedGame = function (this: unknown, ...args: unknown[]) {
    const game = new OriginalGame(...args);
    const root = getAnalyticsRoot();
    root.game = game;
    root.phaserHookAt = new Date().toISOString();
    logger.info("Captured Phaser.Game instance", {
      sceneKeys: game.scene?.keys ? Object.keys(game.scene.keys) : [],
      isRunning: game.isRunning,
    });
    return game;
  } as unknown as typeof Phaser.Game;

  HookedGame.prototype = OriginalGame.prototype;
  Object.setPrototypeOf(HookedGame, OriginalGame);

  Phaser.Game = HookedGame;
  phaserRecord[HOOK_FLAG] = true;

  const root = getAnalyticsRoot();
  root.phaserHookInstalled = true;
  logger.info("Phaser.Game constructor hooked");
  return true;
}

function waitForPhaser(maxAttempts = 6000): void {
  let attempts = 0;

  const tryInstall = (): boolean => {
    const Phaser = (window as unknown as Record<string, unknown>).Phaser as PhaserNamespace | undefined;
    if (Phaser?.Game) {
      return installPhaserHook(Phaser);
    }
    return false;
  };

  if (tryInstall()) {
    return;
  }

  const timer = window.setInterval(() => {
    attempts += 1;
    if (tryInstall()) {
      window.clearInterval(timer);
      return;
    }
    if (attempts >= maxAttempts) {
      window.clearInterval(timer);
      logger.warn("Phaser not found after polling; reload the page with the extension enabled");
    }
  }, 10);
}

export function installEarlyPhaserHook(): void {
  const root = getAnalyticsRoot();
  if (root.phaserHookInstalled) {
    logger.debug("Phaser hook already installed");
    return;
  }

  waitForPhaser();
  logger.info("Early Phaser hook bootstrap complete");
}

export function getCapturedGame(): PhaserGameLike | null {
  return getAnalyticsRoot().game ?? null;
}

import { createLogger } from "../../shared/logger";
import type { DiscoveryReport } from "../../shared/types";
import { buildGameStateSnapshot, getBattleScene } from "../game-access/battle-scene-access";
import { getCapturedGame } from "../game-access/phaser-hook";
import {
  DEFAULT_DISCOVERY_OPTIONS,
  type DiscoveryScanOptions,
} from "./discovery-config";
import {
  addCandidate,
  buildCandidate,
  createScanContext,
  safeReadProperty,
  safeSerialize,
} from "./object-scanner";
import { describeValueType, keywordMatches } from "./keyword-matcher";

const logger = createLogger("GAME_STATE_DISCOVERY");

const BATTLE_SCENE_PATHS = [
  "currentBattle",
  "arena",
  "money",
  "seed",
  "party",
  "modifiers",
  "phaseManager",
  "gameData",
  "ui",
] as const;

export class GameStateDiscovery {
  constructor(private readonly options: DiscoveryScanOptions = DEFAULT_DISCOVERY_OPTIONS) {}

  run(): DiscoveryReport {
    const startedAt = performance.now();
    logger.group("GAME_STATE_DISCOVERY scan started");

    const notes: string[] = [];
    const context = createScanContext({
      ...this.options,
      includeWindowEnumeration: false,
      maxDepth: 4,
    });

    const game = getCapturedGame();
    const scene = getBattleScene();
    const liveState = buildGameStateSnapshot();

    if (!game) {
      notes.push(
        "Phaser game not captured. Reload the PokéRogue tab with the extension enabled so the document_start hook can wrap Phaser.Game.",
      );
    } else {
      notes.push("Phaser game captured via constructor hook.");
    }

    if (!scene) {
      notes.push("Battle scene not ready yet. Wait for the game to finish loading, then scan again.");
    } else {
      notes.push('Battle scene resolved via game.scene.getScene("battle").');
    }

    const knownGlobals = [
      {
        name: "Phaser.Game (hook)",
        found: Boolean(game),
        type: game ? "Phaser.Game" : "undefined",
        preview: game
          ? {
              isRunning: game.isRunning,
              sceneKeys: game.scene?.keys ? Object.keys(game.scene.keys) : [],
            }
          : undefined,
      },
      {
        name: 'scene.getScene("battle")',
        found: Boolean(scene),
        type: scene ? "BattleScene" : "undefined",
        preview: liveState ? (liveState as unknown as Record<string, unknown>) : undefined,
      },
      {
        name: "window.globalScene",
        found: (window as unknown as Record<string, unknown>).globalScene !== undefined,
        type: "module-only (not on window in production)",
        preview: { note: "Use battle scene hook instead" },
      },
    ];

    if (scene) {
      addCandidate(
        context,
        buildCandidate("battleScene", scene, ["battle", "scene", "wave", "party", "money"]),
      );

      for (const prop of BATTLE_SCENE_PATHS) {
        const value = safeReadProperty(scene as unknown as object, prop);
        if (value === undefined || value === "[Unreadable]") {
          continue;
        }
        const path = `battleScene.${prop}`;
        addCandidate(context, buildCandidate(path, value, keywordMatches(prop)));
      }

      if (scene.currentBattle) {
        addCandidate(
          context,
          buildCandidate(
            "battleScene.currentBattle",
            scene.currentBattle,
            keywordMatches("currentBattle"),
          ),
        );
      }
    }

    if (liveState?.wave !== null && liveState?.wave !== undefined) {
      logger.info("Live game state snapshot", liveState);
    }

    const report: DiscoveryReport = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      durationMs: Math.round(performance.now() - startedAt),
      windowKeys: [],
      knownGlobals,
      candidates: context.candidates,
      notes,
      gameState: liveState,
    };

    this.logReport(report);
    logger.groupEnd();
    return report;
  }

  logReport(report: DiscoveryReport): void {
    logger.group(`Discovery report (${report.candidates.length} candidates, ${report.durationMs}ms)`);
    logger.info("Page URL", report.url);
    logger.table("Known access paths", report.knownGlobals);

    if (report.gameState) {
      logger.table("Live game state", report.gameState);
    }

    if (report.notes.length > 0) {
      logger.info("Notes", report.notes);
    }

    if (report.candidates.length > 0) {
      logger.table(
        "Battle scene candidates",
        report.candidates.map((candidate) => ({
          path: candidate.path,
          score: candidate.score,
          keywords: candidate.matchedKeywords.join(", "),
          type: candidate.type,
        })),
      );
    }

    console.log(
      "%c[PokéRogue Analytics] Report: window.__POKEROGUE_ANALYTICS_DISCOVERY__ | State: __POKEROGUE_ANALYTICS__.getState()",
      "color:#81c995;font-weight:bold",
    );
    (window as unknown as Record<string, unknown>).__POKEROGUE_ANALYTICS_DISCOVERY__ = report;
    logger.groupEnd();
  }

  inspectPath(path: string): unknown {
    logger.group(`Inspect path: ${path}`);

    if (path === "battleScene" || path.startsWith("battleScene.")) {
      const scene = getBattleScene();
      if (!scene) {
        logger.warn("Battle scene not available");
        logger.groupEnd();
        return undefined;
      }

      if (path === "battleScene") {
        logger.info("Battle scene snapshot", buildGameStateSnapshot());
        logger.groupEnd();
        return scene;
      }

      const prop = path.slice("battleScene.".length);
      const value = safeReadProperty(scene as unknown as object, prop);

      logger.info("Type", describeValueType(value));
      logger.info("Value", safeSerialize(value));
      logger.groupEnd();
      return value;
    }

    logger.warn('Use paths like battleScene.currentBattle (window.globalScene is not exposed on pokerogue.net)');
    logger.groupEnd();
    return undefined;
  }
}

export function runGameStateDiscovery(options?: DiscoveryScanOptions): DiscoveryReport {
  return new GameStateDiscovery(options).run();
}

export function installDiscoveryDebugTools(): void {
  const discovery = new GameStateDiscovery();
  const win = window as unknown as Record<string, unknown>;
  const existing = (win.__POKEROGUE_ANALYTICS__ ?? {}) as Record<string, unknown>;

  win.__POKEROGUE_ANALYTICS__ = {
    ...existing,
    discovery: {
      run: (options?: DiscoveryScanOptions) => discovery.run(),
      inspect: (path: string) => discovery.inspectPath(path),
      help: () => {
        console.info(`PokéRogue Analytics commands:
  __POKEROGUE_ANALYTICS__.getState()
  __POKEROGUE_ANALYTICS__.discovery.run()
  __POKEROGUE_ANALYTICS__.discovery.inspect("battleScene.currentBattle")
  __POKEROGUE_ANALYTICS__.discovery.help()

If getState() returns null gameCaptured, reload the tab with the extension enabled.`);
      },
    },
  };

  logger.info("Discovery debug tools installed on window.__POKEROGUE_ANALYTICS__.discovery");
}

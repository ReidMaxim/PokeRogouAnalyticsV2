import type {
  BattleSceneLike,
  GameStateSnapshot,
  ModifierLike,
  PokemonLike,
  PokerogueAnalyticsRoot,
} from "./types";
import type { PartyMemberDetail } from "../../shared/party-detail";
import { summarizeVoucherCounts } from "../../shared/voucher-names";
import { readPhaseRunResult } from "../../shared/run-validation";
import { getCapturedGame } from "./phaser-hook";

export const BATTLE_SCENE_KEY = "battle";

export function getBattleScene(): BattleSceneLike | null {
  const game = getCapturedGame();
  const scene = game?.scene?.getScene?.(BATTLE_SCENE_KEY);
  return scene ?? null;
}

function pokemonName(pokemon: PokemonLike): string {
  if (typeof pokemon.getName === "function") {
    try {
      return String(pokemon.getName());
    } catch {
      // fall through
    }
  }
  if (pokemon.nickname) {
    return String(pokemon.nickname);
  }
  if (pokemon.name) {
    return String(pokemon.name);
  }
  const species = typeof pokemon.getSpecies === "function" ? pokemon.getSpecies() : pokemon.species;
  return species?.name ? String(species.name) : "unknown";
}

function pokemonSpeciesId(pokemon: PokemonLike): number | null {
  const species = typeof pokemon.getSpecies === "function" ? pokemon.getSpecies() : pokemon.species;
  return typeof species?.speciesId === "number" ? species.speciesId : null;
}

function pokemonAbility(pokemon: PokemonLike): string | null {
  try {
    if (typeof pokemon.getAbility === "function") {
      const ability = pokemon.getAbility();
      if (ability?.name) {
        return String(ability.name);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function pokemonMoves(pokemon: PokemonLike): string[] {
  try {
    const moveset =
      typeof pokemon.getMoveset === "function" ? pokemon.getMoveset() : pokemon.moveset;
    if (!Array.isArray(moveset)) {
      return [];
    }

    const names: string[] = [];
    for (const slot of moveset) {
      try {
        const move = typeof slot.getMove === "function" ? slot.getMove() : null;
        if (move?.name) {
          names.push(String(move.name));
        }
      } catch {
        // skip slot
      }
    }
    return names;
  } catch {
    return [];
  }
}

function pokemonHeldItems(pokemon: PokemonLike): string[] {
  try {
    if (typeof pokemon.getHeldItems !== "function") {
      return [];
    }

    return pokemon
      .getHeldItems()
      .map((item) => (item.type?.name ? String(item.type.name) : null))
      .filter((name): name is string => Boolean(name));
  } catch {
    return [];
  }
}

function summarizePokemon(pokemon: PokemonLike): PartyMemberDetail {
  return {
    name: pokemonName(pokemon),
    level: typeof pokemon.level === "number" ? pokemon.level : null,
    speciesId: pokemonSpeciesId(pokemon),
    ability: pokemonAbility(pokemon),
    moves: pokemonMoves(pokemon),
    heldItems: pokemonHeldItems(pokemon),
  };
}

function summarizeParty(party: PokemonLike[] | undefined): GameStateSnapshot["party"] {
  if (!party?.length) {
    return [];
  }
  return party.map((pokemon) => summarizePokemon(pokemon));
}

function trainerLabel(scene: BattleSceneLike): string | null {
  const trainer = scene.currentBattle?.trainer;
  if (!trainer) {
    return null;
  }
  if (trainer.trainerName) {
    return String(trainer.trainerName);
  }
  if (trainer.config?.name) {
    return String(trainer.config.name);
  }
  return null;
}

function buildRunId(scene: BattleSceneLike): string {
  const seed = scene.seed ?? "unknown-seed";
  const slot = scene.sessionSlotId ?? 0;
  return `${seed}:${slot}`;
}

function summarizeModifiers(modifiers: unknown[] | undefined): { count: number; summary: string } {
  if (!modifiers?.length) {
    return { count: 0, summary: "" };
  }

  const labels = modifiers
    .map((raw) => {
      const modifier = raw as ModifierLike;
      const name = modifier.type?.name ?? "Unknown";
      const stacks =
        typeof modifier.getStackCount === "function"
          ? modifier.getStackCount()
          : typeof modifier.stackCount === "number"
            ? modifier.stackCount
            : 1;
      return stacks > 1 ? `${name}×${stacks}` : name;
    })
    .sort();

  return { count: modifiers.length, summary: labels.join("|") };
}

export function buildGameStateSnapshot(): GameStateSnapshot | null {
  const game = getCapturedGame();
  const scene = getBattleScene();

  if (!game) {
    return null;
  }

  if (!scene) {
    return {
      timestamp: new Date().toISOString(),
      source: "battle-scene",
      runId: "no-scene",
      wave: null,
      biome: null,
      money: null,
      score: null,
      phase: null,
      trainerName: null,
      battleType: null,
      isBoss: null,
      runResultHint: null,
      party: [],
      enemyParty: [],
      playerField: [],
      enemyField: [],
      modifierCount: 0,
      modifierSummary: "",
      voucherTotal: 0,
      voucherSummary: "",
      gameCaptured: true,
      battleSceneActive: false,
    };
  }

  let party: PokemonLike[] = [];
  let enemyParty: PokemonLike[] = [];
  let playerField: PokemonLike[] = [];
  let enemyField: PokemonLike[] = [];
  try {
    party = scene.getPlayerParty?.() ?? [];
  } catch {
    party = [];
  }
  try {
    enemyParty = scene.getEnemyParty?.() ?? [];
  } catch {
    enemyParty = [];
  }
  try {
    playerField = scene.getPlayerField?.(true) ?? scene.getPlayerField?.() ?? [];
  } catch {
    playerField = [];
  }
  try {
    enemyField = scene.getEnemyField?.(true) ?? scene.getEnemyField?.() ?? [];
  } catch {
    enemyField = [];
  }

  const phase = scene.phaseManager?.getCurrentPhase?.();
  const phaseName = phase?.constructor?.name ?? null;
  const runResultHint = readPhaseRunResult(phase);
  const battle = scene.currentBattle;
  const { count: modifierCount, summary: modifierSummary } = summarizeModifiers(scene.modifiers);
  const { total: voucherTotal, summary: voucherSummary } = summarizeVoucherCounts(
    scene.gameData?.voucherCounts,
  );

  return {
    timestamp: new Date().toISOString(),
    source: "battle-scene",
    runId: buildRunId(scene),
    wave: battle?.waveIndex ?? null,
    biome: scene.arena?.biomeId ?? null,
    money: typeof scene.money === "number" ? scene.money : null,
    score: typeof scene.score === "number" ? scene.score : null,
    phase: phaseName,
    trainerName: trainerLabel(scene),
    battleType: typeof battle?.battleType === "number" ? battle.battleType : null,
    isBoss: battle?.isClassicFinalBoss === true ? true : battle?.trainer ? false : null,
    runResultHint,
    party: summarizeParty(party),
    enemyParty: summarizeParty(enemyParty),
    playerField: summarizeParty(playerField.length ? playerField : party.slice(0, 1)),
    enemyField: summarizeParty(enemyField.length ? enemyField : enemyParty.slice(0, 1)),
    modifierCount,
    modifierSummary,
    voucherTotal,
    voucherSummary,
    gameCaptured: true,
    battleSceneActive: true,
  };
}

export function installStateDebugTools(): void {
  const win = window as unknown as Record<string, unknown>;
  const existing = (win.__POKEROGUE_ANALYTICS__ ?? {}) as PokerogueAnalyticsRoot;
  win.__POKEROGUE_ANALYTICS__ = {
    ...existing,
    getState: () => buildGameStateSnapshot(),
    getBattleScene,
    getGame: getCapturedGame,
  };
}

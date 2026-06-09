import { createLogger } from "../shared/logger";
import { getPokemonSpriteUrl } from "../shared/pokemon-sprites";
import { getCachedJson, setCachedJson } from "../storage/pokeapi-cache";
import { toPokeApiSpeciesId } from "./species-id-map";
import { computeTypeEffectiveness } from "./type-effectiveness";
import type {
  BattleSpeciesInput,
  DamageRelations,
  EnrichedBattleSpecies,
  SpeciesDetail,
  TypeEffectiveness,
} from "./types";
import { NATIONAL_DEX_MAX } from "./types";

const logger = createLogger("pokedex/pokeapi");
const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PokemonApiResponse {
  types: Array<{ type: { name: string } }>;
  name: string;
}

interface TypeApiResponse {
  damage_relations: DamageRelations;
}

interface AbilityApiResponse {
  flavor_text_entries: Array<{ language: { name: string }; flavor_text: string }>;
}

interface SpeciesApiResponse {
  name: string;
  genera: Array<{ language: { name: string }; genus: string }>;
  flavor_text_entries: Array<{ language: { name: string }; flavor_text: string }>;
}

async function fetchCached<T>(url: string): Promise<T | null> {
  const cached = await getCachedJson<T>(url);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      logger.warn("PokeAPI request failed", { url, status: response.status });
      return null;
    }
    const data = (await response.json()) as T;
    await setCachedJson(url, data, CACHE_TTL_MS);
    return data;
  } catch (error) {
    logger.warn("PokeAPI fetch error", { url, error });
    return null;
  }
}

function englishFlavorText(
  entries: Array<{ language: { name: string }; flavor_text: string }> | undefined,
): string | null {
  if (!entries?.length) {
    return null;
  }
  const entry = entries.find((e) => e.language.name === "en");
  return entry?.flavor_text?.replace(/\f/g, " ").replace(/\s+/g, " ").trim() ?? null;
}

export async function getPokemonTypes(pokeApiId: number): Promise<string[] | null> {
  const data = await fetchCached<PokemonApiResponse>(`${POKEAPI_BASE}/pokemon/${pokeApiId}`);
  return data?.types.map((t) => t.type.name) ?? null;
}

export async function getTypeDamageRelations(typeName: string): Promise<DamageRelations | null> {
  const data = await fetchCached<TypeApiResponse>(`${POKEAPI_BASE}/type/${typeName}`);
  return data?.damage_relations ?? null;
}

export async function getPokemonTypeEffectiveness(pokeApiId: number): Promise<TypeEffectiveness> {
  const types = await getPokemonTypes(pokeApiId);
  if (!types?.length) {
    return { weaknesses: [], resistances: [], immunities: [] };
  }

  const relations = await Promise.all(types.map((t) => getTypeDamageRelations(t)));
  const valid = relations.filter((r): r is DamageRelations => r !== null);
  if (valid.length === 0) {
    return { weaknesses: [], resistances: [], immunities: [] };
  }
  const typed =
    valid.length >= 2
      ? ([valid[0], valid[1]] as [DamageRelations, DamageRelations])
      : ([valid[0]] as [DamageRelations]);
  return computeTypeEffectiveness(typed) ?? { weaknesses: [], resistances: [], immunities: [] };
}

export async function getAbilityDescription(abilityName: string | null): Promise<string | null> {
  if (!abilityName) {
    return null;
  }
  const slug = abilityName.toLowerCase().replace(/\s+/g, "-");
  const data = await fetchCached<AbilityApiResponse>(`${POKEAPI_BASE}/ability/${slug}`);
  return englishFlavorText(data?.flavor_text_entries);
}

export async function enrichBattleSpecies(input: BattleSpeciesInput): Promise<EnrichedBattleSpecies> {
  const pokeApiId = toPokeApiSpeciesId(input.speciesId);
  const types = pokeApiId ? (await getPokemonTypes(pokeApiId)) ?? [] : [];
  const typeEffectiveness =
    pokeApiId && types.length
      ? await getPokemonTypeEffectiveness(pokeApiId)
      : { weaknesses: [], resistances: [], immunities: [] };
  const abilityDescription = await getAbilityDescription(input.ability ?? null);

  return {
    speciesId: input.speciesId,
    pokeApiId,
    name: input.name,
    level: input.level ?? null,
    ability: input.ability ?? null,
    abilityDescription,
    types,
    typeEffectiveness,
    spriteUrl: pokeApiId ? getPokemonSpriteUrl(pokeApiId) : null,
  };
}

export async function enrichBattleParty(
  allies: BattleSpeciesInput[],
  enemies: BattleSpeciesInput[],
): Promise<{ allies: EnrichedBattleSpecies[]; enemies: EnrichedBattleSpecies[] }> {
  const [enrichedAllies, enrichedEnemies] = await Promise.all([
    Promise.all(allies.map(enrichBattleSpecies)),
    Promise.all(enemies.map(enrichBattleSpecies)),
  ]);
  return { allies: enrichedAllies, enemies: enrichedEnemies };
}

export async function getSpeciesDetail(
  rogueSpeciesId: number,
  progress: { seen: boolean; caught: boolean; firstSeenAt: string | null; encounterCount: number } | null,
): Promise<SpeciesDetail | null> {
  const pokeApiId = toPokeApiSpeciesId(rogueSpeciesId);
  if (!pokeApiId) {
    return null;
  }

  const [pokemonData, speciesData, typeEffectiveness] = await Promise.all([
    fetchCached<PokemonApiResponse>(`${POKEAPI_BASE}/pokemon/${pokeApiId}`),
    fetchCached<SpeciesApiResponse>(`${POKEAPI_BASE}/pokemon-species/${pokeApiId}`),
    getPokemonTypeEffectiveness(pokeApiId),
  ]);

  const types = pokemonData?.types.map((t) => t.type.name) ?? [];
  const genus =
    speciesData?.genera.find((g) => g.language.name === "en")?.genus ??
    speciesData?.genera[0]?.genus ??
    null;

  return {
    speciesId: rogueSpeciesId,
    pokeApiId,
    name: formatSpeciesName(pokemonData?.name ?? speciesData?.name ?? String(rogueSpeciesId)),
    genus,
    flavorText: englishFlavorText(speciesData?.flavor_text_entries),
    types,
    typeEffectiveness,
    spriteUrl: getPokemonSpriteUrl(pokeApiId) ?? "",
    progress: progress
      ? {
          speciesId: rogueSpeciesId,
          seen: progress.seen,
          caught: progress.caught,
          firstSeenAt: progress.firstSeenAt,
          encounterCount: progress.encounterCount,
        }
      : null,
  };
}

export function formatSpeciesName(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const nameIndex = new Map<number, string>();

export async function getSpeciesNameIndex(): Promise<Map<number, string>> {
  if (nameIndex.size > 0) {
    return nameIndex;
  }

  const batchSize = 50;
  for (let start = 1; start <= NATIONAL_DEX_MAX; start += batchSize) {
    const end = Math.min(start + batchSize - 1, NATIONAL_DEX_MAX);
    const fetches = [];
    for (let id = start; id <= end; id++) {
      fetches.push(
        fetchCached<PokemonApiResponse>(`${POKEAPI_BASE}/pokemon/${id}`).then((data) => {
          if (data?.name) {
            nameIndex.set(id, formatSpeciesName(data.name));
          }
        }),
      );
    }
    await Promise.all(fetches);
  }

  return nameIndex;
}

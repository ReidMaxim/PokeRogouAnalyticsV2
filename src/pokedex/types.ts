export interface TypeRef {
  name: string;
}

export interface DamageRelations {
  double_damage_from: TypeRef[];
  half_damage_from: TypeRef[];
  no_damage_from: TypeRef[];
}

export interface TypeEffectiveness {
  weaknesses: string[];
  resistances: string[];
  immunities: string[];
}

export interface BattleSpeciesInput {
  speciesId: number | null;
  name: string;
  level?: number | null;
  ability?: string | null;
}

export interface EnrichedBattleSpecies {
  speciesId: number | null;
  pokeApiId: number | null;
  name: string;
  level: number | null;
  ability: string | null;
  abilityDescription: string | null;
  types: string[];
  typeEffectiveness: TypeEffectiveness;
  spriteUrl: string | null;
}

export interface PokedexProgressEntry {
  speciesId: number;
  seen: boolean;
  caught: boolean;
  firstSeenAt: string | null;
  encounterCount: number;
}

export interface PokedexProgressSummary {
  entries: PokedexProgressEntry[];
  seenCount: number;
  caughtCount: number;
  totalSpecies: number;
}

export interface SpeciesDetail {
  speciesId: number;
  pokeApiId: number;
  name: string;
  genus: string | null;
  flavorText: string | null;
  types: string[];
  typeEffectiveness: TypeEffectiveness;
  spriteUrl: string;
  progress: PokedexProgressEntry | null;
}

export const NATIONAL_DEX_MAX = 1025;

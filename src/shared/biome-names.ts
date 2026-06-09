/** PokéRogue BiomeId enum (numeric arena.biomeId → display name). */
const BIOME_NAMES: Record<number, string> = {
  0: "Town",
  1: "Plains",
  2: "Grass",
  3: "Tall Grass",
  4: "Metropolis",
  5: "Forest",
  6: "Sea",
  7: "Swamp",
  8: "Beach",
  9: "Lake",
  10: "Seabed",
  11: "Mountain",
  12: "Badlands",
  13: "Cave",
  14: "Desert",
  15: "Ice Cave",
  16: "Meadow",
  17: "Power Plant",
  18: "Volcano",
  19: "Graveyard",
  20: "Dojo",
  21: "Factory",
  22: "Ruins",
  23: "Wasteland",
  24: "Abyss",
  25: "Space",
  26: "Construction Site",
  27: "Jungle",
  28: "Fairy Cave",
  29: "Temple",
  30: "Slum",
  31: "Snowy Forest",
  40: "Island",
  41: "Laboratory",
  50: "End",
};

export function formatBiomeName(biome: string | number | null | undefined): string | null {
  if (biome === null || biome === undefined || biome === "") {
    return null;
  }

  if (typeof biome === "number") {
    return BIOME_NAMES[biome] ?? `Biome ${biome}`;
  }

  const trimmed = biome.trim();
  if (!trimmed) {
    return null;
  }

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && String(asNumber) === trimmed) {
    return BIOME_NAMES[asNumber] ?? `Biome ${asNumber}`;
  }

  return trimmed;
}

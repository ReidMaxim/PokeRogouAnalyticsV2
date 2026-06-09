import type { DamageRelations, TypeEffectiveness } from "./types";

function typeNames(refs: Array<{ name: string }>): string[] {
  return refs.map((ref) => ref.name);
}

/**
 * Dual-type effectiveness rules adapted from RogueDex (MIT).
 */
export function computeTypeEffectiveness(
  relations: [DamageRelations, DamageRelations] | [DamageRelations] | [],
): TypeEffectiveness | null {
  if (relations.length === 0) {
    return null;
  }

  const weaknesses = new Set<string>();
  const resistances = new Set<string>();
  const immunities = new Set<string>();

  if (relations.length === 1) {
    const data = relations[0];
    typeNames(data.double_damage_from).forEach((t) => weaknesses.add(t));
    typeNames(data.half_damage_from).forEach((t) => resistances.add(t));
    typeNames(data.no_damage_from).forEach((t) => immunities.add(t));
  } else {
    const [type1, type2] = relations;
    const type1Weak = typeNames(type1.double_damage_from);
    const type2Resist = new Set(typeNames(type2.half_damage_from));
    for (const t of type1Weak) {
      if (!type2Resist.has(t)) {
        weaknesses.add(t);
      }
    }

    const type2Weak = typeNames(type2.double_damage_from);
    const type1Resist = new Set(typeNames(type1.half_damage_from));
    for (const t of type2Weak) {
      if (!type1Resist.has(t)) {
        weaknesses.add(t);
      }
    }

    const type1ResistList = typeNames(type1.half_damage_from);
    const type2WeakSet = new Set(typeNames(type2.double_damage_from));
    for (const t of type1ResistList) {
      if (!type2WeakSet.has(t)) {
        resistances.add(t);
      }
    }

    const type2ResistList = typeNames(type2.half_damage_from);
    const type1WeakSet = new Set(typeNames(type1.double_damage_from));
    for (const t of type2ResistList) {
      if (!type1WeakSet.has(t)) {
        resistances.add(t);
      }
    }

    typeNames(type1.no_damage_from).forEach((t) => immunities.add(t));
    typeNames(type2.no_damage_from).forEach((t) => immunities.add(t));

    for (const immunity of immunities) {
      weaknesses.delete(immunity);
      resistances.delete(immunity);
    }
  }

  return {
    weaknesses: [...weaknesses].sort(),
    resistances: [...resistances].sort(),
    immunities: [...immunities].sort(),
  };
}

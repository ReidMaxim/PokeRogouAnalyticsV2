import type { EnrichedBattleSpecies } from "../types";

function capitalizeType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function typeBand(label: string, types: string[], className: string): string {
  if (types.length === 0) {
    return "";
  }
  const chips = types.map((t) => `<span class="pr-dex-type-chip ${t}">${capitalizeType(t)}</span>`).join("");
  return `<div class="pr-dex-band ${className}"><span class="pr-dex-band-label">${label}</span>${chips}</div>`;
}

export function renderBattleCard(species: EnrichedBattleSpecies, index: number, total: number): string {
  const sprite = species.spriteUrl
    ? `<img src="${species.spriteUrl}" alt="${species.name}" />`
    : `<span class="pr-dex-fallback">${species.name.charAt(0).toUpperCase()}</span>`;

  const typeChips = species.types
    .map((t) => `<span class="pr-dex-type-chip ${t}">${capitalizeType(t)}</span>`)
    .join("");

  const { weaknesses, resistances, immunities } = species.typeEffectiveness;
  const abilityTitle = species.abilityDescription
    ? `title="${escapeAttr(species.abilityDescription)}"`
    : "";

  return `
    <div class="pr-dex-card">
      <div class="pr-dex-card-head">
        <div class="pr-dex-sprite">${sprite}</div>
        <div class="pr-dex-title">
          <strong>${escapeHtml(species.name)}</strong>
          ${species.level != null ? `<span class="pr-dex-level">Lv ${species.level}</span>` : ""}
          <div class="pr-dex-types">${typeChips}</div>
        </div>
        ${total > 1 ? `<span class="pr-dex-index">${index + 1}/${total}</span>` : ""}
      </div>
      ${species.ability ? `<p class="pr-dex-ability" ${abilityTitle}>${escapeHtml(species.ability)}</p>` : ""}
      ${typeBand("Weak", weaknesses, "weak")}
      ${typeBand("Resist", resistances, "resist")}
      ${typeBand("Immune", immunities, "immune")}
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, "&#39;");
}

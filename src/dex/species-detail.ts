import type { SpeciesDetail } from "../pokedex/types";

export function renderSpeciesDetailHtml(detail: SpeciesDetail): string {
  const progress = detail.progress;
  const status = progress?.caught ? "Caught" : progress?.seen ? "Seen" : "Unseen";
  const encounters = progress?.encounterCount ?? 0;

  const typePills = detail.types
    .map((t) => `<span class="type-pill">${capitalize(t)}</span>`)
    .join("");

  return `
    <img src="${detail.spriteUrl}" width="96" height="96" alt="${detail.name}" style="image-rendering:pixelated" />
    <h2>#${detail.pokeApiId} ${detail.name}</h2>
    ${detail.genus ? `<p class="genus">${detail.genus}</p>` : ""}
    <p><strong>Status:</strong> ${status}${encounters > 0 ? ` · ${encounters} encounters` : ""}</p>
    <div class="type-row">${typePills}</div>
    ${detail.flavorText ? `<p class="flavor">${escapeHtml(detail.flavorText)}</p>` : ""}
    ${renderEffectBlock("Weak to", detail.typeEffectiveness.weaknesses)}
    ${renderEffectBlock("Resists", detail.typeEffectiveness.resistances)}
    ${renderEffectBlock("Immune to", detail.typeEffectiveness.immunities)}
  `;
}

function renderEffectBlock(label: string, types: string[]): string {
  if (types.length === 0) {
    return "";
  }
  return `<div class="effect-block"><h3>${label}</h3><p>${types.map(capitalize).join(", ")}</p></div>`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

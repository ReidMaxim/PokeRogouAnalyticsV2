const POKEAPI_SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export function getPokemonSpriteUrl(speciesId: number | null | undefined): string | null {
  if (typeof speciesId !== "number" || speciesId <= 0) {
    return null;
  }
  return `${POKEAPI_SPRITE_BASE}/${speciesId}.png`;
}

export function renderPokemonIconHtml(
  member: { name: string; level: number | null; speciesId?: number | null },
  options?: { size?: number; showLevel?: boolean; className?: string },
): string {
  const size = options?.size ?? 32;
  const showLevel = options?.showLevel ?? true;
  const className = options?.className ?? "pokemon-icon";
  const url = getPokemonSpriteUrl(member.speciesId);
  const levelHtml =
    showLevel && member.level != null ? `<span class="pokemon-level">${member.level}</span>` : "";
  const alt = escapeAttr(member.name);

  if (url) {
    return `<span class="${className}" title="${alt}">
      <img src="${url}" width="${size}" height="${size}" alt="${alt}" loading="lazy" decoding="async" />
      ${levelHtml}
    </span>`;
  }

  return `<span class="${className} pokemon-icon-fallback" title="${alt}">
    <span class="pokemon-initial">${escapeHtml(member.name.charAt(0).toUpperCase())}</span>
    ${levelHtml}
  </span>`;
}

export function renderPartyIconsHtml(
  party: Array<{ name: string; level: number | null; speciesId?: number | null }>,
  options?: { size?: number; showLevel?: boolean },
): string {
  if (party.length === 0) {
    return "";
  }
  return party.map((member) => renderPokemonIconHtml(member, options)).join("");
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(text: string): string {
  return escapeAttr(text);
}

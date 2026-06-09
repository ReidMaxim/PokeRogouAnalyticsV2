export interface PartyMemberDetail {
  name: string;
  level: number | null;
  speciesId: number | null;
  ability: string | null;
  moves: string[];
  heldItems: string[];
}

const SLOT_SEPARATOR = "|";
const LIST_SEPARATOR = "+";

export function emptyPartyMemberDetail(
  name: string,
  level: number | null = null,
  speciesId: number | null = null,
): PartyMemberDetail {
  return { name, level, speciesId, ability: null, moves: [], heldItems: [] };
}

export function formatPartyAbilities(party: PartyMemberDetail[]): string {
  return party.map((member) => member.ability ?? "").join(SLOT_SEPARATOR);
}

export function formatPartyMoves(party: PartyMemberDetail[]): string {
  return party.map((member) => member.moves.join(LIST_SEPARATOR)).join(SLOT_SEPARATOR);
}

export function formatPartyHeldItems(party: PartyMemberDetail[]): string {
  return party.map((member) => member.heldItems.join(LIST_SEPARATOR)).join(SLOT_SEPARATOR);
}

export function parsePartyAbilities(summary: string | null | undefined, slotCount: number): string[] {
  return normalizeSlotList(summary, slotCount);
}

export function parsePartyMoves(summary: string | null | undefined, slotCount: number): string[][] {
  return normalizeSlotList(summary, slotCount).map((slot) =>
    slot ? slot.split(LIST_SEPARATOR).filter(Boolean) : [],
  );
}

export function parsePartyHeldItems(summary: string | null | undefined, slotCount: number): string[][] {
  return normalizeSlotList(summary, slotCount).map((slot) =>
    slot ? slot.split(LIST_SEPARATOR).filter(Boolean) : [],
  );
}

function normalizeSlotList(summary: string | null | undefined, slotCount: number): string[] {
  const slots = summary ? summary.split(SLOT_SEPARATOR) : [];
  while (slots.length < slotCount) {
    slots.push("");
  }
  return slots.slice(0, slotCount);
}

export function mergePartyDetails(
  base: Array<{ name: string; level: number | null; speciesId: number | null }>,
  abilities: string[],
  moves: string[][],
  heldItems: string[][],
): PartyMemberDetail[] {
  return base.map((member, index) => ({
    ...member,
    ability: abilities[index] || null,
    moves: moves[index] ?? [],
    heldItems: heldItems[index] ?? [],
  }));
}

export function renderPartyMemberDetailHtml(
  member: {
    ability?: string | null;
    moves?: string[];
    heldItems?: string[];
  },
): string {
  const ability = member.ability ?? null;
  const moves = member.moves ?? [];
  const heldItems = member.heldItems ?? [];
  const parts: string[] = [];
  if (ability) {
    parts.push(`<span class="party-detail-line"><strong>Ability</strong> ${escapeHtml(ability)}</span>`);
  }
  if (moves.length > 0) {
    parts.push(
      `<span class="party-detail-line"><strong>Moves</strong> ${escapeHtml(moves.join(", "))}</span>`,
    );
  }
  if (heldItems.length > 0) {
    parts.push(
      `<span class="party-detail-line"><strong>Items</strong> ${escapeHtml(heldItems.join(", "))}</span>`,
    );
  }
  if (parts.length === 0) {
    return "";
  }
  return `<div class="party-detail-block">${parts.join("")}</div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

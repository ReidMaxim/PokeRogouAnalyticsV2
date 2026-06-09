import { formatSpeciesName } from "../pokedex/pokeapi-client";
import { toPokeApiSpeciesId } from "../pokedex/species-id-map";
import type { PokedexProgressEntry, SpeciesDetail } from "../pokedex/types";
import { NATIONAL_DEX_MAX } from "../pokedex/types";
import { sendBackgroundMessage } from "../shared/background-messaging";
import { getPokemonSpriteUrl } from "../shared/pokemon-sprites";
import { renderSpeciesDetailHtml } from "./species-detail";

const seenCountEl = document.getElementById("seen-count") as HTMLSpanElement;
const caughtCountEl = document.getElementById("caught-count") as HTMLSpanElement;
const gridEl = document.getElementById("dex-grid") as HTMLDivElement;
const detailEl = document.getElementById("dex-detail") as HTMLElement;
const detailContentEl = document.getElementById("dex-detail-content") as HTMLDivElement;
const searchEl = document.getElementById("dex-search") as HTMLInputElement;
const filterEl = document.getElementById("dex-filter") as HTMLSelectElement;
const typeFilterEl = document.getElementById("dex-type-filter") as HTMLSelectElement;
const refreshBtn = document.getElementById("dex-refresh-btn") as HTMLButtonElement;
const closeDetailBtn = document.getElementById("dex-detail-close") as HTMLButtonElement;

interface NationalDexEntry {
  nationalId: number;
  seen: boolean;
  caught: boolean;
  encounterCount: number;
  name: string;
  types: string[];
}

let nationalEntries: NationalDexEntry[] = [];
let nameById = new Map<number, string>();
let typesById = new Map<number, string[]>();

async function loadProgress(): Promise<PokedexProgressEntry[]> {
  const response = await sendBackgroundMessage<{ progress: { entries: PokedexProgressEntry[]; seenCount: number; caughtCount: number; totalSpecies: number } }>(
    "GET_POKEDEX_PROGRESS",
  );
  return response.progress.entries;
}

function buildNationalEntries(progress: PokedexProgressEntry[]): NationalDexEntry[] {
  const seen = new Map<number, { caught: boolean; encounterCount: number }>();

  for (const entry of progress) {
    const nationalId = toPokeApiSpeciesId(entry.speciesId);
    if (!nationalId) {
      continue;
    }
    const existing = seen.get(nationalId) ?? { caught: false, encounterCount: 0 };
    seen.set(nationalId, {
      caught: existing.caught || entry.caught,
      encounterCount: existing.encounterCount + entry.encounterCount,
    });
  }

  const entries: NationalDexEntry[] = [];
  for (let nationalId = 1; nationalId <= NATIONAL_DEX_MAX; nationalId++) {
    const record = seen.get(nationalId);
    entries.push({
      nationalId,
      seen: Boolean(record),
      caught: record?.caught ?? false,
      encounterCount: record?.encounterCount ?? 0,
      name: nameById.get(nationalId) ?? `#${nationalId}`,
      types: typesById.get(nationalId) ?? [],
    });
  }
  return entries;
}

function updateHeader(entries: NationalDexEntry[]): void {
  const seenCount = entries.filter((e) => e.seen).length;
  const caughtCount = entries.filter((e) => e.caught).length;
  seenCountEl.textContent = `Seen ${seenCount} / ${NATIONAL_DEX_MAX}`;
  caughtCountEl.textContent = `Caught ${caughtCount} / ${NATIONAL_DEX_MAX}`;
}

function filteredEntries(): NationalDexEntry[] {
  const query = searchEl.value.trim().toLowerCase();
  const filter = filterEl.value;
  const typeFilter = typeFilterEl.value;

  return nationalEntries.filter((entry) => {
    if (filter === "seen" && !entry.seen) return false;
    if (filter === "caught" && !entry.caught) return false;
    if (filter === "unseen" && entry.seen) return false;
    if (typeFilter !== "all" && !entry.types.includes(typeFilter)) return false;
    if (!query) return true;
    return (
      entry.name.toLowerCase().includes(query) ||
      String(entry.nationalId).includes(query) ||
      String(entry.nationalId).padStart(4, "0").includes(query)
    );
  });
}

function renderGrid(): void {
  const visible = filteredEntries();
  if (visible.length === 0) {
    gridEl.innerHTML = `<p class="empty-hint">No species match your filters.</p>`;
    return;
  }

  gridEl.innerHTML = "";
  for (const entry of visible) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `dex-cell${entry.seen ? " seen" : " unseen"}${entry.caught ? " caught" : ""}`;
    const sprite = getPokemonSpriteUrl(entry.nationalId);
    cell.innerHTML = `
      ${sprite ? `<img src="${sprite}" alt="${entry.name}" loading="lazy" />` : ""}
      <span class="dex-num">#${String(entry.nationalId).padStart(4, "0")}</span>
      <span class="dex-name">${entry.name}</span>
    `;
    cell.addEventListener("click", () => {
      void showDetail(entry.nationalId);
    });
    gridEl.appendChild(cell);
  }
}

async function showDetail(nationalId: number): Promise<void> {
  detailEl.classList.remove("hidden");
  detailContentEl.innerHTML = `<p class="empty-hint">Loading species…</p>`;

  const response = await sendBackgroundMessage<{ detail: SpeciesDetail }>("GET_SPECIES_DETAIL", {
    speciesId: nationalId,
  });

  detailContentEl.innerHTML = renderSpeciesDetailHtml(response.detail);
  if (response.detail.name) {
    nameById.set(nationalId, response.detail.name);
    typesById.set(nationalId, response.detail.types);
    const entry = nationalEntries.find((e) => e.nationalId === nationalId);
    if (entry) {
      entry.name = response.detail.name;
      entry.types = response.detail.types;
      populateTypeFilter();
    }
  }
}

function populateTypeFilter(): void {
  const types = new Set<string>();
  for (const entry of nationalEntries) {
    for (const type of entry.types) {
      types.add(type);
    }
  }
  const current = typeFilterEl.value;
  typeFilterEl.innerHTML = `<option value="all">All types</option>`;
  for (const type of [...types].sort()) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    typeFilterEl.appendChild(option);
  }
  typeFilterEl.value = current;
}

async function hydrateNamesForSeen(entries: NationalDexEntry[]): Promise<void> {
  const seenIds = entries.filter((e) => e.seen).map((e) => e.nationalId);
  await Promise.all(
    seenIds.slice(0, 120).map(async (id) => {
      if (nameById.has(id)) {
        return;
      }
      try {
        const response = await sendBackgroundMessage<{ detail: SpeciesDetail }>("GET_SPECIES_DETAIL", {
          speciesId: id,
        });
        nameById.set(id, response.detail.name);
        typesById.set(id, response.detail.types);
      } catch {
        nameById.set(id, formatSpeciesName(String(id)));
      }
    }),
  );
}

async function refresh(): Promise<void> {
  gridEl.innerHTML = `<p class="empty-hint">Loading Pokédex…</p>`;
  await sendBackgroundMessage("REBUILD_POKEDEX_PROGRESS");
  const progress = await loadProgress();
  nationalEntries = buildNationalEntries(progress);
  await hydrateNamesForSeen(nationalEntries);
  nationalEntries = buildNationalEntries(progress);
  updateHeader(nationalEntries);
  populateTypeFilter();
  renderGrid();
}

searchEl.addEventListener("input", renderGrid);
filterEl.addEventListener("change", renderGrid);
typeFilterEl.addEventListener("change", renderGrid);
refreshBtn.addEventListener("click", () => {
  void refresh();
});
closeDetailBtn.addEventListener("click", () => {
  detailEl.classList.add("hidden");
});

void refresh();

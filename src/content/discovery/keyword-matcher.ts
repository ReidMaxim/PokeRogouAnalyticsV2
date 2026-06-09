import { DISCOVERY_KEYWORDS } from "./discovery-config";

const KEYWORD_SET = new Set(DISCOVERY_KEYWORDS.map((keyword) => keyword.toLowerCase()));

export function normalizeKey(key: string): string {
  return key.replace(/[_-]/g, "").toLowerCase();
}

export function keywordMatches(text: string): string[] {
  const normalized = normalizeKey(text);
  const matches: string[] = [];

  for (const keyword of KEYWORD_SET) {
    if (normalized.includes(keyword)) {
      matches.push(keyword);
    }
  }

  return matches;
}

export function scoreKeywordMatches(matches: string[]): number {
  const unique = new Set(matches);
  return unique.size;
}

export function collectKeywordMatchesFromObject(
  obj: Record<string, unknown>,
  keywords: readonly string[] = DISCOVERY_KEYWORDS,
): string[] {
  const keywordSet = new Set(keywords.map((keyword) => keyword.toLowerCase()));
  const matches = new Set<string>();

  for (const key of Object.keys(obj)) {
    const normalized = normalizeKey(key);
    for (const keyword of keywordSet) {
      if (normalized.includes(keyword)) {
        matches.add(keyword);
      }
    }
  }

  return [...matches];
}

export function describeValueType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }
  if (value instanceof Map) {
    return `Map(${value.size})`;
  }
  if (value instanceof Set) {
    return `Set(${value.size})`;
  }
  if (typeof value === "object") {
    const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
    return ctor && ctor !== "Object" ? ctor : "object";
  }
  return typeof value;
}

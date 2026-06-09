import { DISCOVERY_MAX_STRING_LENGTH } from "../../shared/constants";
import {
  describeValueType,
  keywordMatches,
  scoreKeywordMatches,
} from "./keyword-matcher";
import type { DiscoveryScanOptions } from "./discovery-config";
import { DEFAULT_DISCOVERY_OPTIONS } from "./discovery-config";
import type { DiscoveryCandidate } from "../../shared/types";

const NATIVE_OBJECT_TAGS = new Set([
  "Window",
  "HTMLDocument",
  "Document",
  "HTMLElement",
  "Node",
  "EventTarget",
  "WritableStream",
  "ReadableStream",
  "WritableStreamDefaultWriter",
  "ReadableStreamDefaultReader",
  "ArrayBuffer",
  "MessagePort",
]);

export function shouldSkipScanTarget(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value !== "object" && typeof value !== "function") {
    return false;
  }

  if (typeof Window !== "undefined" && value instanceof Window) {
    return true;
  }
  if (typeof Node !== "undefined" && value instanceof Node) {
    return true;
  }

  const tag = Object.prototype.toString.call(value).slice(8, -1);
  return NATIVE_OBJECT_TAGS.has(tag);
}

function readProperty(value: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.get) {
      return descriptor.get.call(value);
    }
    return Reflect.get(value, key);
  } catch {
    return "[Unreadable]";
  }
}

/** Safely read one property from an object (handles bound getters). */
export function safeReadProperty(value: object, key: string): unknown {
  return readProperty(value, key);
}

export interface ScanContext {
  visited: WeakSet<object>;
  candidates: DiscoveryCandidate[];
  options: Required<DiscoveryScanOptions>;
}

export function safeSerialize(value: unknown, depth = 0): unknown {
  if (depth > 2) {
    return "[MaxDepth]";
  }

  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  const valueType = typeof value;
  if (valueType === "string") {
    const text = value as string;
    return text.length > DISCOVERY_MAX_STRING_LENGTH
      ? `${text.slice(0, DISCOVERY_MAX_STRING_LENGTH)}…`
      : text;
  }
  if (valueType === "number" || valueType === "boolean" || valueType === "bigint") {
    return value;
  }
  if (valueType === "function") {
    return `[Function ${(value as Function).name || "anonymous"}]`;
  }
  if (valueType === "symbol") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return `[array(${value.length})]`;
  }

  if (value instanceof Map) {
    return `[Map size=${value.size}]`;
  }
  if (value instanceof Set) {
    return `[Set size=${value.size}]`;
  }

  if (valueType === "object") {
    if (shouldSkipScanTarget(value)) {
      return describeValueType(value);
    }
    return describeValueType(value);
  }

  return String(value);
}

export function buildCandidate(
  path: string,
  value: unknown,
  matchedKeywords: string[],
): DiscoveryCandidate | null {
  if (matchedKeywords.length === 0) {
    return null;
  }

  return {
    path,
    score: scoreKeywordMatches(matchedKeywords),
    matchedKeywords: [...new Set(matchedKeywords)],
    type: describeValueType(value),
    preview: {
      __path: path,
      __type: describeValueType(value),
      value: safeSerialize(value),
    },
    sampleValues: {},
  };
}

export function addCandidate(context: ScanContext, candidate: DiscoveryCandidate | null): void {
  if (!candidate) {
    return;
  }

  const existingIndex = context.candidates.findIndex((item) => item.path === candidate.path);
  if (existingIndex >= 0) {
    const existing = context.candidates[existingIndex];
    if (candidate.score > existing.score) {
      context.candidates[existingIndex] = candidate;
    }
    return;
  }

  context.candidates.push(candidate);
  context.candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  if (context.candidates.length > context.options.maxCandidates) {
    context.candidates.length = context.options.maxCandidates;
  }
}

export function createScanContext(options?: DiscoveryScanOptions): ScanContext {
  return {
    visited: new WeakSet<object>(),
    candidates: [],
    options: {
      ...DEFAULT_DISCOVERY_OPTIONS,
      ...options,
      keywords: options?.keywords ?? DEFAULT_DISCOVERY_OPTIONS.keywords,
    },
  };
}

export function resolvePath(root: unknown, path: string): unknown {
  if (!path) {
    return root;
  }

  const segments = path.split(".");
  let current: unknown = root;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }

    current = safeReadProperty(current as object, segment);
    if (current === "[Unreadable]") {
      return undefined;
    }
  }

  return current;
}

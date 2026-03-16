import * as fs from 'fs';
import * as yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VocabularyEntry {
  name: string;
  maps_to: string;
  description?: string;
  params?: Record<string, string | string[]>;
}

interface VocabularyFile {
  version: string;
  actions: VocabularyEntry[];
  assertions: VocabularyEntry[];
}

export interface MatchResult {
  matched: boolean;
  entry?: VocabularyEntry;
  /** Extracted parameter values keyed by param name. */
  params?: Record<string, string>;
}

export interface ClosestMatch {
  entry: VocabularyEntry;
  /** Similarity score: 0.0 (no overlap) → 1.0 (exact match). */
  score: number;
}

// ---------------------------------------------------------------------------
// VocabularyRegistry
// ---------------------------------------------------------------------------

/**
 * Loads `vocabulary/core.yaml` and provides step-matching against it.
 *
 * Usage:
 *   const registry = VocabularyRegistry.load('/path/to/vocabulary/core.yaml');
 *   const result = registry.matchStep('login as "admin"');
 */
export class VocabularyRegistry {
  readonly version: string;
  readonly actions: VocabularyEntry[];
  readonly assertions: VocabularyEntry[];

  private constructor(version: string, actions: VocabularyEntry[], assertions: VocabularyEntry[]) {
    this.version = version;
    this.actions = actions;
    this.assertions = assertions;
  }

  /** All entries (actions + assertions) combined. */
  get all(): VocabularyEntry[] {
    return [...this.actions, ...this.assertions];
  }

  /**
   * Loads and parses a vocabulary YAML file.
   * @throws if the file is missing, unreadable, or malformed.
   */
  static load(yamlPath: string): VocabularyRegistry {
    let raw: string;
    try {
      raw = fs.readFileSync(yamlPath, 'utf-8');
    } catch {
      throw new Error(`VocabularyRegistry: cannot read file at ${yamlPath}`);
    }

    let parsed: unknown;
    try {
      parsed = yaml.load(raw);
    } catch (err) {
      throw new Error(`VocabularyRegistry: YAML parse error in ${yamlPath}: ${(err as Error).message}`);
    }

    const vocab = parsed as VocabularyFile;
    if (!vocab.version || !Array.isArray(vocab.actions) || !Array.isArray(vocab.assertions)) {
      throw new Error(`VocabularyRegistry: ${yamlPath} must have version, actions[], and assertions[].`);
    }

    return new VocabularyRegistry(vocab.version, vocab.actions, vocab.assertions);
  }

  /**
   * Tries to match a BDD step text against all vocabulary entries.
   *
   * The match is case-insensitive. Template params like {role} are treated as
   * wildcards that capture the corresponding value.
   *
   * Example:
   *   matchStep('login as "admin"')
   *   // → { matched: true, entry: { name: 'login as {role}', ... }, params: { role: 'admin' } }
   */
  matchStep(stepText: string): MatchResult {
    const original = stepText.trim();
    const normalised = original.toLowerCase();
    // Also try without a leading subject pronoun ("I ", "we ") — common in BDD
    const withoutSubject = normalised.replace(/^(i |we )/i, '');
    const originalWithoutSubject = original.replace(/^(i |we )\s*/i, '');

    // Collect all matches, then pick the most specific one (fewest wildcards).
    // This ensures "click the {element} button" wins over the looser "click {element}".
    let bestMatch: MatchResult | null = null;
    let bestSpecificity = -1;

    for (const entry of this.all) {
      const params =
        tryMatch(normalised, original, entry) ??
        tryMatch(withoutSubject, originalWithoutSubject, entry);

      if (params) {
        // Specificity: fewer {param} placeholders = more specific match
        const wildcardCount = (entry.name.match(/\{/g) ?? []).length;
        const literalChars = entry.name.replace(/\{[^}]+\}/g, '').length;
        const specificity = literalChars * 10 - wildcardCount;
        if (specificity > bestSpecificity) {
          bestSpecificity = specificity;
          bestMatch = { matched: true, entry, params };
        }
      }
    }

    return bestMatch ?? { matched: false };
  }

  /**
   * Finds the closest vocabulary entry to the given step text using word-overlap
   * similarity. Always returns a result (the best available guess).
   */
  findClosest(stepText: string): ClosestMatch {
    const words = tokenise(stepText);
    let best: ClosestMatch = { entry: this.all[0], score: 0 };

    for (const entry of this.all) {
      const entryWords = tokenise(entry.name);
      const score = wordOverlapScore(words, entryWords);
      if (score > best.score) {
        best = { entry, score };
      }
    }

    return best;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a template name like "login as {role}" into a RegExp and tries to
 * match `normalised` (lowercase) to check whether the template applies, then
 * extracts param values from `original` (original casing) to preserve case.
 *
 * Returns extracted param values if matched, otherwise null.
 */
function tryMatch(
  normalised: string,
  original: string,
  entry: VocabularyEntry,
): Record<string, string> | null {
  const paramNames: string[] = [];
  // Escape regex metacharacters in the template, then replace {param} with a capture group
  const pattern = entry.name
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, (ch) => (ch === '{' || ch === '}' ? ch : `\\${ch}`))
    .replace(/\{(\w+)\}/g, (_full, name: string) => {
      paramNames.push(name);
      return '(.+?)';
    });

  const regex = new RegExp(`^${pattern}$`, 'i');

  // Check match against normalised text
  if (!regex.test(normalised)) return null;

  // Extract param values from the original (case-preserved) text
  const match = regex.exec(original);
  if (!match) return null;

  const params: Record<string, string> = {};
  paramNames.forEach((name, i) => {
    params[name] = match[i + 1].replace(/^["']|["']$/g, ''); // strip surrounding quotes
  });
  return params;
}

/** Tokenises a string into lowercase words, stripping punctuation. */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[{}]/g, '')
    .split(/\W+/)
    .filter(Boolean);
}

/** Word-overlap similarity: intersection / union (Jaccard index). */
function wordOverlapScore(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  setA.forEach(w => { if (setB.has(w)) intersection++; });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

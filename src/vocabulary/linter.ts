import { BDDStep, ParsedScenario } from '../types';
import { VocabularyRegistry } from './registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LintWarning {
  step: BDDStep;
  message: string;
  /** Closest vocabulary match, if one was found with score ≥ 0.2. */
  suggestion?: string;
}

export interface LintResult {
  valid: boolean;
  warnings: LintWarning[];
}

// ---------------------------------------------------------------------------
// lintScenario
// ---------------------------------------------------------------------------

/**
 * Validates every step in a scenario against the vocabulary registry.
 *
 * Steps that do not match any canonical template produce a warning with the
 * closest matching vocabulary entry as a suggestion.
 *
 * `valid` is true even if there are warnings — vocabulary compliance is
 * advisory at this stage (see D1: vocabulary is bootstrapped from evidence).
 */
export function lintScenario(scenario: ParsedScenario, registry: VocabularyRegistry): LintResult {
  const warnings: LintWarning[] = [];

  for (const step of scenario.steps) {
    const { matched } = registry.matchStep(step.text);
    if (!matched) {
      const closest = registry.findClosest(step.text);
      const suggestion =
        closest.score >= 0.2
          ? `Did you mean: "${closest.entry.name}"?`
          : undefined;

      warnings.push({
        step,
        message: `[VOCAB] Unrecognised step: "${step.keyword} ${step.text}"`,
        suggestion,
      });
    }
  }

  return { valid: true, warnings };
}

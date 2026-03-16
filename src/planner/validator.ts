import { TestPlan, PageModel } from '../types';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  unknownSelectors: string[];
}

/**
 * Cross-references every selector in the plan against the page model.
 * Flags selectors Gemini produced that don't match any known element.
 */
export function validatePlan(plan: TestPlan, pageModel: PageModel): ValidationResult {
  const warnings: string[] = [];
  const unknownSelectors: string[] = [];
  const knownSelectors = new Set(pageModel.elements.map(e => e.selector));

  for (const action of plan.actions) {
    if (!action.selector) continue;
    if (action.action === 'navigate') continue;

    if (!knownSelectors.has(action.selector)) {
      const closest = findClosestElement(action.selector, pageModel);
      const suggestion = closest
        ? ` Closest match: "${closest.text}" → ${closest.selector}`
        : ' No close match found in page model.';

      warnings.push(
        `[Planner] Unknown selector "${action.selector}" in action "${action.action}".${suggestion}`
      );
      unknownSelectors.push(action.selector);
    }
  }

  const unknownRatio = unknownSelectors.length / Math.max(plan.actions.filter(a => a.selector).length, 1);
  if (unknownRatio > 0.5) {
    warnings.push(
      `[Planner] ${Math.round(unknownRatio * 100)}% of selectors are unknown — ` +
      `Gemini may have hallucinated. Consider re-running the App Explorer.`
    );
  }

  return {
    valid: unknownSelectors.length === 0,
    warnings,
    unknownSelectors,
  };
}

/**
 * Finds the closest element in the page model to the given selector
 * by comparing text content and selector fragments.
 */
function findClosestElement(
  unknownSelector: string,
  pageModel: PageModel
): PageModel['elements'][number] | null {
  const normalised = unknownSelector.toLowerCase();
  let best: PageModel['elements'][number] | null = null;
  let bestScore = 0;

  for (const el of pageModel.elements) {
    let score = 0;
    if (el.selector.toLowerCase().includes(normalised)) score += 3;
    if (normalised.includes(el.selector.toLowerCase())) score += 2;
    if (el.text && normalised.includes(el.text.toLowerCase())) score += 2;
    if (el.id && normalised.includes(el.id.toLowerCase())) score += 2;
    if (el.name && normalised.includes(el.name.toLowerCase())) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return bestScore > 0 ? best : null;
}

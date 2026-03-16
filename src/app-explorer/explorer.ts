import { chromium } from '@playwright/test';
import { PageModel, PageElement, ExplorationStep } from '../types';
import { withRetry } from '../utils/retry';

/**
 * Launches a headless Chromium browser, navigates to the given URL,
 * and extracts a structured PageModel of all interactive and semantic elements.
 *
 * Selector priority chain (most → least stable):
 *   1. [data-testid] / [data-cy] / [data-test]
 *   2. ARIA role + accessible name
 *   3. Unique #id
 *   4. input[name="..."] / button[name="..."]
 *   5. Text-based: button:has-text("...") / a:has-text("...")
 *   6. Rejected — bare tag selectors are never emitted
 *
 * Convenience wrapper around exploreWithScript for single-page use.
 */
export async function explorePage(url: string): Promise<PageModel> {
  const script: ExplorationStep[] = [
    { action: 'navigate', value: url },
    { action: 'capture', value: url },
  ];
  const models = await exploreWithScript(script);
  return models[0];
}

/**
 * Executes an exploration script and returns one PageModel per 'capture' step.
 *
 * Script step semantics:
 *   { action: 'navigate', value: url }     — navigate to URL
 *   { action: 'fill', selector, value }    — fill input
 *   { action: 'click', selector }          — click element
 *   { action: 'wait', ms }                 — pause for N ms
 *   { action: 'capture', value: url }      — snapshot current DOM into a PageModel
 *                                            (value is used as the model's URL label)
 *
 * All navigation is retried with exponential backoff.
 * Returns PageModel[] — one entry per 'capture' step encountered.
 *
 * @throws if no 'capture' step is present, or a step references a missing selector.
 */
export async function exploreWithScript(steps: ExplorationStep[]): Promise<PageModel[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const results: PageModel[] = [];

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      switch (step.action) {
        case 'navigate': {
          const url = step.value;
          if (!url) throw new Error(`Exploration step ${i + 1}: 'navigate' requires a value (URL).`);
          await withRetry(() => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }));
          break;
        }

        case 'fill': {
          if (!step.selector) throw new Error(`Exploration step ${i + 1}: 'fill' requires a selector.`);
          if (step.value === undefined) throw new Error(`Exploration step ${i + 1}: 'fill' requires a value.`);
          await page.fill(step.selector, step.value);
          break;
        }

        case 'click': {
          if (!step.selector) throw new Error(`Exploration step ${i + 1}: 'click' requires a selector.`);
          await page.click(step.selector);
          break;
        }

        case 'wait': {
          const ms = step.ms ?? 1000;
          await page.waitForTimeout(ms);
          break;
        }

        case 'capture': {
          const captureUrl = step.value ?? page.url();
          const model = await capturePageElements(page, captureUrl);
          results.push(model);
          console.log(`[Explorer] Captured ${model.elements.length} elements from ${captureUrl}`);
          break;
        }

        default: {
          const unknown = (step as ExplorationStep).action;
          console.warn(`[Explorer] Unknown step action '${unknown}' at index ${i} — skipped.`);
        }
      }
    }

    if (results.length === 0) {
      throw new Error('Exploration script completed with no capture steps — no page model was produced.');
    }

    return results;
  } finally {
    try {
      await browser.close();
    } catch {
      // Browser may already be gone — not an error we need to surface
    }
  }
}

/**
 * Merges multiple PageModels into a single one by combining their elements.
 * Deduplicates by selector. The URL and title are taken from the first model.
 */
export function mergePageModels(models: PageModel[]): PageModel {
  if (models.length === 0) throw new Error('mergePageModels called with empty array.');
  if (models.length === 1) return models[0];

  const seen = new Set<string>();
  const merged: PageElement[] = [];

  for (const model of models) {
    for (const el of model.elements) {
      if (!seen.has(el.selector)) {
        seen.add(el.selector);
        merged.push(el);
      }
    }
  }

  return {
    url: models[0].url,
    title: models[0].title,
    elements: merged,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Snapshots all interactive and semantic elements on the current page state.
 */
async function capturePageElements(
  page: import('@playwright/test').Page,
  url: string,
): Promise<PageModel> {
  const title = await page.title();

  const rawElements = await page.evaluate(() => {
    const results: Array<{
      type: string;
      tag: string;
      text: string;
      id: string;
      name: string;
      inputType?: string;
      selectorCandidates: string[];
      href?: string;
    }> = [];

    function getTestId(el: Element): string | null {
      return (
        el.getAttribute('data-testid') ||
        el.getAttribute('data-cy') ||
        el.getAttribute('data-test') ||
        null
      );
    }

    function getAriaName(el: Element): string | null {
      return (
        el.getAttribute('aria-label') ||
        el.getAttribute('aria-labelledby')
          ? document.getElementById(el.getAttribute('aria-labelledby') || '')?.textContent?.trim() || null
          : null
      );
    }

    function getVisibleText(el: Element): string {
      const text =
        (el as HTMLElement).innerText?.trim() ||
        (el as HTMLInputElement).placeholder?.trim() ||
        (el as HTMLInputElement).value?.trim() ||
        el.getAttribute('aria-label')?.trim() ||
        '';
      return text.substring(0, 150);
    }

    /**
     * Build an ordered list of selector candidates, from most to least stable.
     * The caller picks the first one that is unique on the page.
     */
    function buildCandidates(el: Element, role?: string): string[] {
      const candidates: string[] = [];
      const tag = el.tagName.toLowerCase();
      const testId = getTestId(el);
      const ariaName = getAriaName(el);
      const text = getVisibleText(el);
      const inputEl = el as HTMLInputElement;

      // 1. data-testid / data-cy / data-test
      if (testId) candidates.push(`[data-testid="${testId}"]`);

      // 2. ARIA role + accessible name
      if (role && ariaName) candidates.push(`role=${role}[name="${ariaName}"]`);
      if (role && text) candidates.push(`role=${role}[name="${text}"]`);

      // 3. Unique #id
      if (el.id) candidates.push(`#${el.id}`);

      // 4. name attribute
      if (inputEl.name) candidates.push(`${tag}[name="${inputEl.name}"]`);

      // 5. Text-based
      if (text) {
        if (tag === 'button' || tag === 'a') {
          candidates.push(`${tag}:has-text("${text.replace(/"/g, '\\"')}")`);
        }
        if (inputEl.placeholder) {
          candidates.push(`${tag}[placeholder="${inputEl.placeholder.replace(/"/g, '\\"')}"]`);
        }
      }

      // Bare tag is intentionally never added — it is never unique enough
      return candidates;
    }

    // Buttons
    document
      .querySelectorAll('button, input[type="submit"], input[type="button"]')
      .forEach(el => {
        results.push({
          type: 'button',
          tag: el.tagName.toLowerCase(),
          text: getVisibleText(el),
          id: el.id || '',
          name: (el as HTMLInputElement).name || '',
          inputType: el.tagName.toLowerCase() === 'input' ? (el as HTMLInputElement).type : undefined,
          selectorCandidates: buildCandidates(el, 'button'),
        });
      });

    // Inputs
    document
      .querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"])')
      .forEach(el => {
        const input = el as HTMLInputElement;
        results.push({
          type: 'input',
          tag: 'input',
          text: getVisibleText(el),
          id: el.id || '',
          name: input.name || '',
          inputType: input.type || 'text',
          selectorCandidates: buildCandidates(el, 'textbox'),
        });
      });

    // Links
    document.querySelectorAll('a[href]').forEach(el => {
      const anchor = el as HTMLAnchorElement;
      const text = getVisibleText(el);
      if (!text) return;
      results.push({
        type: 'link',
        tag: 'a',
        text,
        id: el.id || '',
        name: '',
        selectorCandidates: buildCandidates(el, 'link'),
        href: anchor.href,
      });
    });

    // Headings
    document.querySelectorAll('h1, h2, h3, h4').forEach(el => {
      const text = getVisibleText(el);
      if (!text) return;
      results.push({
        type: 'heading',
        tag: el.tagName.toLowerCase(),
        text,
        id: el.id || '',
        name: '',
        selectorCandidates: buildCandidates(el),
      });
    });

    // Flash / alert messages
    document
      .querySelectorAll('#flash, .flash, [id*="flash"], [class*="flash"], [id*="alert"]')
      .forEach(el => {
        const text = getVisibleText(el);
        if (!text) return;
        results.push({
          type: 'text',
          tag: el.tagName.toLowerCase(),
          text,
          id: el.id || '',
          name: '',
          selectorCandidates: buildCandidates(el),
        });
      });

    return results;
  });

  // Resolve the best unique selector for each element
  const elements: PageElement[] = [];
  for (const raw of rawElements) {
    const selector = await resolveUniqueSelector(page, raw.selectorCandidates, raw.text);
    if (!selector) {
      console.warn(`[Explorer] No unique selector found for [${raw.type}] "${raw.text}" — skipped`);
      continue;
    }
    elements.push({
      type: raw.type as PageElement['type'],
      tag: raw.tag,
      text: raw.text,
      id: raw.id,
      name: raw.name,
      inputType: raw.inputType,
      selector,
      href: raw.href,
    });
  }

  return { url, title, elements };
}

/**
 * Tries each selector candidate in priority order.
 * Returns the first one that matches exactly 1 element on the page.
 * Returns null if no candidate is unique.
 */
async function resolveUniqueSelector(
  page: import('@playwright/test').Page,
  candidates: string[],
  debugText: string,
): Promise<string | null> {
  for (const selector of candidates) {
    try {
      const count = await page.locator(selector).count();
      if (count === 1) return selector;
      if (count > 1) {
        console.warn(`[Explorer] Non-unique selector (${count} matches): ${selector} — trying next`);
      }
    } catch {
      // Invalid selector syntax — try next
    }
  }
  void debugText; // acknowledged — used in caller warning
  return null;
}

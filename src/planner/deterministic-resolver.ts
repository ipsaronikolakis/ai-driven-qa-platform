import { BDDStep, TestAction, PageModel, PageElement } from '../types';
import { VocabularyRegistry } from '../vocabulary/registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Resolver = (
  step: BDDStep,
  params: Record<string, string>,
  pageModel: PageModel,
) => TestAction[];

// ---------------------------------------------------------------------------
// Resolver map  (maps_to value → resolver function)
// ---------------------------------------------------------------------------

const RESOLVERS: Partial<Record<string, Resolver>> = {

  navigateTo: (_step, params) => [{
    action: 'navigate',
    value: params['url'],
    description: `Navigate to ${params['url']}`,
    source: 'vocabulary',
  }],

  /**
   * "I am on the {page} page"
   * Given → navigate (setup)  /  Then → assert_url (assertion)
   */
  assertOnPage: (step, params, pageModel) => {
    if (step.keyword === 'Given' || step.keyword === 'And') {
      return [{
        action: 'navigate',
        value: pageModel.url,
        description: `Navigate to ${params['page']} page`,
        source: 'vocabulary',
      }];
    }
    return [{
      action: 'assert_url',
      value: params['page'],
      description: `Assert on ${params['page']} page`,
      source: 'vocabulary',
    }];
  },

  fillUsername: (_step, params, pageModel) => {
    const el = findInputByHint(pageModel, 'username', 'user', 'email');
    return [{
      action: 'fill',
      selector: el?.selector ?? '#username',
      value: params['value'],
      description: `Fill username: ${params['value']}`,
      source: 'vocabulary',
    }];
  },

  fillPassword: (_step, params, pageModel) => {
    const el = findInputByHint(pageModel, 'password', 'pass');
    return [{
      action: 'fill',
      selector: el?.selector ?? '#password',
      value: params['value'],
      description: 'Fill password',
      source: 'vocabulary',
    }];
  },

  fillInput: (_step, params, pageModel) => {
    const el = findInputByHint(pageModel, params['field'].toLowerCase());
    return [{
      action: 'fill',
      selector: el?.selector ?? `[name="${params['field']}"]`,
      value: params['value'],
      description: `Fill ${params['field']}: ${params['value']}`,
      source: 'vocabulary',
    }];
  },

  clickButton: (_step, params, pageModel) => {
    const el = findButtonByText(pageModel, params['element']);
    return [{
      action: 'click',
      selector: el?.selector ?? `button:has-text("${params['element']}")`,
      description: `Click ${params['element']} button`,
      source: 'vocabulary',
    }];
  },

  clickElement: (_step, params, pageModel) => {
    const el =
      findButtonByText(pageModel, params['element']) ??
      findLinkByText(pageModel, params['element']);
    return [{
      action: 'click',
      selector: el?.selector ?? `[aria-label="${params['element']}"]`,
      description: `Click ${params['element']}`,
      source: 'vocabulary',
    }];
  },

  logout: (_step, _params, pageModel) => {
    const el = findLinkByText(pageModel, 'logout');
    return [{
      action: 'click',
      selector: el?.selector ?? 'a:has-text("Logout")',
      description: 'Log out',
      source: 'vocabulary',
    }];
  },

  assertText: (_step, params) => [{
    action: 'assert_text',
    value: params['text'],
    description: `Assert text visible: "${params['text']}"`,
    source: 'vocabulary',
  }],

  assertUrl: (_step, params) => [{
    action: 'assert_url',
    value: params['url'],
    description: `Assert URL contains: ${params['url']}`,
    source: 'vocabulary',
  }],

  assertVisible: (_step, params, pageModel) => {
    const el = findButtonByText(pageModel, params['element']);
    return [{
      action: 'assert_visible',
      selector: el?.selector,
      description: `Assert "${params['element']}" button is visible`,
      source: 'vocabulary',
    }];
  },

  // loginAs intentionally omitted — multi-step with credential lookup;
  // falls through to LLM for now.
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if every step in the scenario can be resolved without
 * calling the LLM. Steps whose `maps_to` has no registered resolver
 * (e.g. loginAs) cannot be resolved deterministically.
 */
export function canResolveAll(
  steps: BDDStep[],
  registry: VocabularyRegistry,
): boolean {
  for (const step of steps) {
    const { matched, entry } = registry.matchStep(step.text);
    if (!matched || !entry) return false;
    if (!RESOLVERS[entry.maps_to]) return false;
  }
  return true;
}

/**
 * Resolves all steps deterministically. Throws if any step cannot be resolved.
 * Call `canResolveAll` first to check.
 */
export function resolveAll(
  steps: BDDStep[],
  registry: VocabularyRegistry,
  pageModel: PageModel,
): TestAction[] {
  const actions: TestAction[] = [];

  for (const step of steps) {
    const { matched, entry, params } = registry.matchStep(step.text);
    if (!matched || !entry) {
      throw new Error(`[DeterministicResolver] No vocabulary match for step: "${step.keyword} ${step.text}"`);
    }
    const resolver = RESOLVERS[entry.maps_to];
    if (!resolver) {
      throw new Error(`[DeterministicResolver] No resolver for maps_to="${entry.maps_to}" (step: "${step.text}")`);
    }
    const resolved = resolver(step, params ?? {}, pageModel);
    actions.push(...resolved);
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Page model lookup helpers
// ---------------------------------------------------------------------------

function findInputByHint(pageModel: PageModel, ...hints: string[]): PageElement | undefined {
  const lower = hints.map(h => h.toLowerCase());
  return pageModel.elements.find(el =>
    el.type === 'input' &&
    lower.some(h =>
      el.id.toLowerCase().includes(h) ||
      el.name.toLowerCase().includes(h) ||
      el.text.toLowerCase().includes(h),
    ),
  );
}

function findButtonByText(pageModel: PageModel, text: string): PageElement | undefined {
  const lower = text.toLowerCase();
  return pageModel.elements.find(
    el => el.type === 'button' && el.text.toLowerCase().includes(lower),
  );
}

function findLinkByText(pageModel: PageModel, text: string): PageElement | undefined {
  const lower = text.toLowerCase();
  return pageModel.elements.find(
    el => el.type === 'link' && el.text.toLowerCase().includes(lower),
  );
}

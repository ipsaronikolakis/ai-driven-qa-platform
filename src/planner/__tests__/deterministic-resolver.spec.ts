/**
 * Unit tests for the deterministic resolver.
 * No browser required — uses a mock PageModel.
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import { VocabularyRegistry } from '../../vocabulary/registry';
import { canResolveAll, resolveAll } from '../deterministic-resolver';
import { BDDStep, PageModel } from '../../types';

const VOCAB_PATH = path.resolve(__dirname, '..', '..', '..', 'vocabulary', 'core.yaml');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStep(keyword: string, text: string): BDDStep {
  return { keyword: keyword as BDDStep['keyword'], text };
}

/** Minimal page model mirroring what the explorer captures from the login page. */
const LOGIN_PAGE_MODEL: PageModel = {
  url: 'https://the-internet.herokuapp.com/login',
  title: 'The Internet',
  elements: [
    { type: 'input',  tag: 'input', text: '',      id: 'username', name: 'username', selector: '#username' },
    { type: 'input',  tag: 'input', text: '',      id: 'password', name: 'password', selector: '#password' },
    { type: 'button', tag: 'button', text: 'Login', id: '',        name: '',         selector: 'button:has-text("Login")' },
    { type: 'link',   tag: 'a',     text: 'Logout', id: '',        name: '',         selector: 'role=link[name="Logout"]' },
  ],
};

// ---------------------------------------------------------------------------
// canResolveAll
// ---------------------------------------------------------------------------

test('resolver.canResolveAll — all supported steps → true', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [
    makeStep('Given', 'I am on the login page'),
    makeStep('When',  'I enter username "tomsmith"'),
    makeStep('And',   'I enter password "SuperSecretPassword!"'),
    makeStep('And',   'I click the login button'),
    makeStep('Then',  'I should see "You logged into a secure area!"'),
  ];
  expect(canResolveAll(steps, registry)).toBe(true);
});

test('resolver.canResolveAll — empty step list → true', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  expect(canResolveAll([], registry)).toBe(true);
});

test('resolver.canResolveAll — unknown step → false', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [
    makeStep('Given', 'something completely unknown that is not in vocabulary'),
  ];
  expect(canResolveAll(steps, registry)).toBe(false);
});

test('resolver.canResolveAll — loginAs maps_to has no resolver → false', () => {
  // "login as {role}" maps to loginAs, which is intentionally excluded from resolvers
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('When', 'login as admin')];
  expect(canResolveAll(steps, registry)).toBe(false);
});

test('resolver.canResolveAll — single assertText step → true', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('Then', 'I should see "Welcome"')];
  expect(canResolveAll(steps, registry)).toBe(true);
});

test('resolver.canResolveAll — single assertUrl step → true', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('Then', 'I should be on "/secure"')];
  expect(canResolveAll(steps, registry)).toBe(true);
});

test('resolver.canResolveAll — logout step → true', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('When', 'I log out')];
  expect(canResolveAll(steps, registry)).toBe(true);
});

// ---------------------------------------------------------------------------
// resolveAll — action types
// ---------------------------------------------------------------------------

test('resolver.resolveAll — assertOnPage with Given → navigate action', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('Given', 'I am on the login page')];
  const actions = resolveAll(steps, registry, LOGIN_PAGE_MODEL);
  expect(actions).toHaveLength(1);
  expect(actions[0].action).toBe('navigate');
  expect(actions[0].source).toBe('vocabulary');
});

test('resolver.resolveAll — assertOnPage with Then → assert_url action', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('Then', 'I am on the login page')];
  const actions = resolveAll(steps, registry, LOGIN_PAGE_MODEL);
  expect(actions).toHaveLength(1);
  expect(actions[0].action).toBe('assert_url');
});

test('resolver.resolveAll — fillUsername uses page model selector', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('When', 'I enter username "tomsmith"')];
  const actions = resolveAll(steps, registry, LOGIN_PAGE_MODEL);
  expect(actions[0].action).toBe('fill');
  expect(actions[0].selector).toBe('#username');
  expect(actions[0].value).toBe('tomsmith');
});

test('resolver.resolveAll — fillPassword uses page model selector', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('And', 'I enter password "SuperSecretPassword!"')];
  const actions = resolveAll(steps, registry, LOGIN_PAGE_MODEL);
  expect(actions[0].action).toBe('fill');
  expect(actions[0].selector).toBe('#password');
  expect(actions[0].value).toBe('SuperSecretPassword!');
});

test('resolver.resolveAll — clickButton uses page model selector', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('And', 'I click the login button')];
  const actions = resolveAll(steps, registry, LOGIN_PAGE_MODEL);
  expect(actions[0].action).toBe('click');
  expect(actions[0].selector).toBe('button:has-text("Login")');
});

test('resolver.resolveAll — assertText produces assert_text action', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('Then', 'I should see "You logged into a secure area!"')];
  const actions = resolveAll(steps, registry, LOGIN_PAGE_MODEL);
  expect(actions[0].action).toBe('assert_text');
  expect(actions[0].value).toBe('You logged into a secure area!');
});

test('resolver.resolveAll — assertUrl produces assert_url action', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('Then', 'I should be on "/secure"')];
  const actions = resolveAll(steps, registry, LOGIN_PAGE_MODEL);
  expect(actions[0].action).toBe('assert_url');
  expect(actions[0].value).toBe('/secure');
});

test('resolver.resolveAll — logout uses Logout link selector from page model', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('When', 'I log out')];
  const actions = resolveAll(steps, registry, LOGIN_PAGE_MODEL);
  expect(actions[0].action).toBe('click');
  expect(actions[0].selector).toBe('role=link[name="Logout"]');
});

// ---------------------------------------------------------------------------
// resolveAll — all actions have source: 'vocabulary'
// ---------------------------------------------------------------------------

test('resolver.resolveAll — all resolved actions tagged source: vocabulary', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [
    makeStep('Given', 'I am on the login page'),
    makeStep('When',  'I enter username "tomsmith"'),
    makeStep('And',   'I enter password "pass"'),
    makeStep('And',   'I click the login button'),
    makeStep('Then',  'I should see "Welcome"'),
  ];
  const actions = resolveAll(steps, registry, LOGIN_PAGE_MODEL);
  for (const a of actions) {
    expect(a.source).toBe('vocabulary');
  }
});

// ---------------------------------------------------------------------------
// resolveAll — full login scenario end-to-end
// ---------------------------------------------------------------------------

test('resolver.resolveAll — full login scenario produces 5 actions', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [
    makeStep('Given', 'I am on the login page'),
    makeStep('When',  'I enter username "tomsmith"'),
    makeStep('And',   'I enter password "SuperSecretPassword!"'),
    makeStep('And',   'I click the login button'),
    makeStep('Then',  'I should see "You logged into a secure area!"'),
  ];
  const actions = resolveAll(steps, registry, LOGIN_PAGE_MODEL);
  expect(actions).toHaveLength(5);
  expect(actions.map(a => a.action)).toEqual([
    'navigate', 'fill', 'fill', 'click', 'assert_text',
  ]);
});

// ---------------------------------------------------------------------------
// resolveAll — throws on unresolvable step
// ---------------------------------------------------------------------------

test('resolver.resolveAll — throws on unresolvable step', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const steps = [makeStep('Given', 'something completely unknown')];
  expect(() => resolveAll(steps, registry, LOGIN_PAGE_MODEL)).toThrow(/DeterministicResolver/);
});

// ---------------------------------------------------------------------------
// Fallback selectors when element not in page model
// ---------------------------------------------------------------------------

test('resolver.resolveAll — fillUsername fallback selector when not in model', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const emptyModel: PageModel = { url: '/', title: '', elements: [] };
  const steps = [makeStep('When', 'I enter username "admin"')];
  const actions = resolveAll(steps, registry, emptyModel);
  expect(actions[0].selector).toBe('#username'); // hardcoded fallback
});

test('resolver.resolveAll — clickButton fallback selector when not in model', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const emptyModel: PageModel = { url: '/', title: '', elements: [] };
  const steps = [makeStep('And', 'I click the submit button')];
  const actions = resolveAll(steps, registry, emptyModel);
  expect(actions[0].selector).toBe('button:has-text("submit")');
});

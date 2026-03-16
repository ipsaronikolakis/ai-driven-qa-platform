/**
 * Unit tests for the VocabularyRegistry.
 * No browser required.
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import { VocabularyRegistry } from '../registry';

const VOCAB_PATH = path.resolve(__dirname, '..', '..', '..', 'vocabulary', 'core.yaml');

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

test('registry — loads core.yaml without errors', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  expect(registry).toBeTruthy();
});

test('registry — version field is set', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  expect(registry.version).toMatch(/^\d+\.\d+\.\d+$/);
});

test('registry — all entries accessible via .all', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  expect(registry.all.length).toBeGreaterThan(5);
  expect(registry.actions.length).toBeGreaterThan(0);
  expect(registry.assertions.length).toBeGreaterThan(0);
});

test('registry — throws on non-existent file', () => {
  expect(() => VocabularyRegistry.load('/no/such/file.yaml')).toThrow(/cannot read file/);
});

// ---------------------------------------------------------------------------
// matchStep — exact matches (no params)
// ---------------------------------------------------------------------------

test('registry.matchStep — "log out" matches logout entry', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('log out');
  expect(result.matched).toBe(true);
  expect(result.entry?.maps_to).toBe('logout');
});

test('registry.matchStep — "I log out" matches after pronoun strip', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('I log out');
  expect(result.matched).toBe(true);
  expect(result.entry?.maps_to).toBe('logout');
});

test('registry.matchStep — returns matched=false for unknown step', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('do something completely unknown xyz123');
  expect(result.matched).toBe(false);
  expect(result.entry).toBeUndefined();
});

// ---------------------------------------------------------------------------
// matchStep — single param extraction
// ---------------------------------------------------------------------------

test('registry.matchStep — extracts username value param', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('enter username "tomsmith"');
  expect(result.matched).toBe(true);
  expect(result.entry?.maps_to).toBe('fillUsername');
  expect(result.params?.value).toBe('tomsmith');
});

test('registry.matchStep — extracts password value and preserves case', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('enter password "SuperSecretPassword!"');
  expect(result.matched).toBe(true);
  expect(result.entry?.maps_to).toBe('fillPassword');
  // Case must be preserved — not lowercased
  expect(result.params?.value).toBe('SuperSecretPassword!');
});

test('registry.matchStep — extracts URL from "I should be on {url}"', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('I should be on "/secure"');
  expect(result.matched).toBe(true);
  expect(result.entry?.maps_to).toBe('assertUrl');
  expect(result.params?.url).toBe('/secure');
});

test('registry.matchStep — extracts text from "I should see {text}"', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('I should see "You logged into a secure area!"');
  expect(result.matched).toBe(true);
  expect(result.entry?.maps_to).toBe('assertText');
  expect(result.params?.text).toBe('You logged into a secure area!');
});

// ---------------------------------------------------------------------------
// matchStep — two params
// ---------------------------------------------------------------------------

test('registry.matchStep — fills field and value from "fill {field} with {value}"', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('fill email with test@example.com');
  expect(result.matched).toBe(true);
  expect(result.entry?.maps_to).toBe('fillInput');
  expect(result.params?.field).toBe('email');
  expect(result.params?.value).toBe('test@example.com');
});

// ---------------------------------------------------------------------------
// matchStep — specificity: more specific template wins
// ---------------------------------------------------------------------------

test('registry.matchStep — "click the login button" prefers clickButton over clickElement', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('click the login button');
  expect(result.matched).toBe(true);
  expect(result.entry?.maps_to).toBe('clickButton');
  expect(result.params?.element).toBe('login');
});

test('registry.matchStep — "click Logout" matches clickElement (no "the ... button" form)', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('click Logout');
  expect(result.matched).toBe(true);
  expect(result.entry?.maps_to).toBe('clickElement');
  expect(result.params?.element).toBe('Logout');
});

// ---------------------------------------------------------------------------
// matchStep — case insensitivity
// ---------------------------------------------------------------------------

test('registry.matchStep — case insensitive matching', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('ENTER USERNAME "tomsmith"');
  expect(result.matched).toBe(true);
  expect(result.params?.value).toBe('tomsmith');
});

// ---------------------------------------------------------------------------
// matchStep — subject pronoun stripping
// ---------------------------------------------------------------------------

test('registry.matchStep — strips "I " prefix from step text', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('I am on the login page');
  expect(result.matched).toBe(true);
  expect(result.entry?.maps_to).toBe('assertOnPage');
  expect(result.params?.page).toBe('login');
});

test('registry.matchStep — strips "we " prefix from step text', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const result = registry.matchStep('we log out');
  expect(result.matched).toBe(true);
  expect(result.entry?.maps_to).toBe('logout');
});

// ---------------------------------------------------------------------------
// findClosest
// ---------------------------------------------------------------------------

test('registry.findClosest — returns a result for any input', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const closest = registry.findClosest('some random text');
  expect(closest.entry).toBeTruthy();
  expect(typeof closest.score).toBe('number');
});

test('registry.findClosest — near-miss has score > 0', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  // "log in" is close to "login as {role}"
  const closest = registry.findClosest('log in with password');
  expect(closest.score).toBeGreaterThan(0);
});

test('registry.findClosest — "enter my password" scores high for fillPassword', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const closest = registry.findClosest('enter my password');
  // "enter password {value}" should be the top hit
  expect(closest.entry.maps_to).toBe('fillPassword');
});

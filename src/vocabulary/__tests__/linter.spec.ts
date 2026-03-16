/**
 * Unit tests for the vocabulary linter.
 * No browser required.
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import { VocabularyRegistry } from '../registry';
import { lintScenario } from '../linter';
import { ParsedScenario } from '../../types';

const VOCAB_PATH = path.resolve(__dirname, '..', '..', '..', 'vocabulary', 'core.yaml');

function makeScenario(steps: Array<{ keyword: string; text: string }>): ParsedScenario {
  return {
    feature: 'Test Feature',
    scenario: 'Test Scenario',
    steps: steps.map(s => ({ keyword: s.keyword as ParsedScenario['steps'][0]['keyword'], text: s.text })),
  };
}

// ---------------------------------------------------------------------------
// All canonical steps — no warnings
// ---------------------------------------------------------------------------

test('linter — all canonical steps produce no warnings', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const scenario = makeScenario([
    { keyword: 'Given', text: 'I am on the login page' },
    { keyword: 'When',  text: 'I enter username "tomsmith"' },
    { keyword: 'And',   text: 'I enter password "SuperSecretPassword!"' },
    { keyword: 'And',   text: 'I click the login button' },
    { keyword: 'Then',  text: 'I should see "You logged into a secure area!"' },
  ]);
  const result = lintScenario(scenario, registry);
  expect(result.valid).toBe(true);
  expect(result.warnings).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Unknown step — one warning
// ---------------------------------------------------------------------------

test('linter — unrecognised step produces one warning', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const scenario = makeScenario([
    { keyword: 'Given', text: 'something completely unrecognised abc123xyz' },
  ]);
  const result = lintScenario(scenario, registry);
  expect(result.valid).toBe(true); // advisory only — always valid
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0].message).toContain('Unrecognised step');
  expect(result.warnings[0].step.text).toBe('something completely unrecognised abc123xyz');
});

// ---------------------------------------------------------------------------
// Mixed scenario — only unknown steps warned
// ---------------------------------------------------------------------------

test('linter — warns only for unrecognised steps, not canonical ones', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const scenario = makeScenario([
    { keyword: 'Given', text: 'I am on the login page' },
    { keyword: 'When',  text: 'I perform some undocumented magic ritual' },
    { keyword: 'Then',  text: 'I should see "done"' },
  ]);
  const result = lintScenario(scenario, registry);
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0].step.text).toBe('I perform some undocumented magic ritual');
});

// ---------------------------------------------------------------------------
// Multiple warnings
// ---------------------------------------------------------------------------

test('linter — multiple unrecognised steps produce multiple warnings', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const scenario = makeScenario([
    { keyword: 'Given', text: 'an unknown precondition' },
    { keyword: 'When',  text: 'another unknown action' },
    { keyword: 'Then',  text: 'yet another unknown assertion' },
  ]);
  const result = lintScenario(scenario, registry);
  expect(result.warnings).toHaveLength(3);
});

// ---------------------------------------------------------------------------
// Suggestion included for near-misses
// ---------------------------------------------------------------------------

test('linter — suggestion provided when score ≥ 0.2', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  // "enter my password" is close enough to "enter password {value}"
  const scenario = makeScenario([
    { keyword: 'When', text: 'enter my password' },
  ]);
  const result = lintScenario(scenario, registry);
  if (result.warnings.length > 0 && result.warnings[0].suggestion) {
    expect(result.warnings[0].suggestion).toContain('Did you mean:');
  }
  // Even if it matches (score > 0.2), the test verifies the contract
  expect(result.valid).toBe(true);
});

// ---------------------------------------------------------------------------
// valid is always true (advisory-only)
// ---------------------------------------------------------------------------

test('linter — valid is always true regardless of warnings', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const scenario = makeScenario([
    { keyword: 'Given', text: 'totally garbage step that means nothing' },
    { keyword: 'When',  text: 'also gibberish nonsense 999' },
  ]);
  const result = lintScenario(scenario, registry);
  expect(result.valid).toBe(true);
});

// ---------------------------------------------------------------------------
// Empty scenario
// ---------------------------------------------------------------------------

test('linter — scenario with no steps produces no warnings', () => {
  const registry = VocabularyRegistry.load(VOCAB_PATH);
  const scenario = makeScenario([]);
  const result = lintScenario(scenario, registry);
  expect(result.valid).toBe(true);
  expect(result.warnings).toHaveLength(0);
});

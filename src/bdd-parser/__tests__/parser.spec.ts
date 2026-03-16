/**
 * Unit tests for the BDD parser.
 * No browser required — pure file I/O and string parsing.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseAllScenarios, parseFeatureFile } from '../parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Writes a temporary .feature file and returns its path. Cleans up after test. */
function tmpFeature(content: string): string {
  const p = path.join(os.tmpdir(), `qa-parser-test-${Date.now()}-${Math.random().toString(36).slice(2)}.feature`);
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

// ---------------------------------------------------------------------------
// parseAllScenarios — basic structure
// ---------------------------------------------------------------------------

test('parser — parses feature name correctly', () => {
  const f = tmpFeature(`
Feature: My Feature

  Scenario: First
    Given a step
`);
  const scenarios = parseAllScenarios(f);
  expect(scenarios[0].feature).toBe('My Feature');
  fs.unlinkSync(f);
});

test('parser — parses single scenario name', () => {
  const f = tmpFeature(`
Feature: My Feature

  Scenario: Login flow
    Given I am on the login page
`);
  const scenarios = parseAllScenarios(f);
  expect(scenarios).toHaveLength(1);
  expect(scenarios[0].scenario).toBe('Login flow');
  fs.unlinkSync(f);
});

test('parser — parses multiple scenarios from one file', () => {
  const f = tmpFeature(`
Feature: Auth

  Scenario: Successful login
    Given I am on the login page
    When I enter username "tomsmith"
    Then I should see "Welcome"

  Scenario: Failed login
    Given I am on the login page
    When I enter username "baduser"
    Then I should see "Invalid"
`);
  const scenarios = parseAllScenarios(f);
  expect(scenarios).toHaveLength(2);
  expect(scenarios[0].scenario).toBe('Successful login');
  expect(scenarios[1].scenario).toBe('Failed login');
  fs.unlinkSync(f);
});

test('parser — steps do not bleed between scenarios', () => {
  const f = tmpFeature(`
Feature: Auth

  Scenario: First
    Given step A
    When step B

  Scenario: Second
    Given step C
    Then step D
`);
  const scenarios = parseAllScenarios(f);
  expect(scenarios[0].steps).toHaveLength(2);
  expect(scenarios[0].steps[0].text).toBe('step A');
  expect(scenarios[0].steps[1].text).toBe('step B');
  expect(scenarios[1].steps).toHaveLength(2);
  expect(scenarios[1].steps[0].text).toBe('step C');
  expect(scenarios[1].steps[1].text).toBe('step D');
  fs.unlinkSync(f);
});

// ---------------------------------------------------------------------------
// parseAllScenarios — step keywords
// ---------------------------------------------------------------------------

test('parser — recognises Given, When, Then, And, But keywords', () => {
  const f = tmpFeature(`
Feature: Keywords

  Scenario: All keywords
    Given precondition
    When action
    Then assertion
    And another assertion
    But exception
`);
  const [s] = parseAllScenarios(f);
  expect(s.steps).toHaveLength(5);
  expect(s.steps[0].keyword).toBe('Given');
  expect(s.steps[1].keyword).toBe('When');
  expect(s.steps[2].keyword).toBe('Then');
  expect(s.steps[3].keyword).toBe('And');
  expect(s.steps[4].keyword).toBe('But');
  fs.unlinkSync(f);
});

test('parser — step text excludes the keyword prefix', () => {
  const f = tmpFeature(`
Feature: F

  Scenario: S
    Given I am on the login page
`);
  const [s] = parseAllScenarios(f);
  expect(s.steps[0].keyword).toBe('Given');
  expect(s.steps[0].text).toBe('I am on the login page');
  fs.unlinkSync(f);
});

// ---------------------------------------------------------------------------
// parseAllScenarios — comments and blank lines
// ---------------------------------------------------------------------------

test('parser — ignores comment lines starting with #', () => {
  const f = tmpFeature(`
# This is a comment
Feature: F

  # Another comment
  Scenario: S
    # step comment
    Given I do something
`);
  const scenarios = parseAllScenarios(f);
  expect(scenarios).toHaveLength(1);
  expect(scenarios[0].steps).toHaveLength(1);
  fs.unlinkSync(f);
});

test('parser — ignores blank lines', () => {
  const f = tmpFeature(`
Feature: F


  Scenario: S

    Given I do something

    When I do another
`);
  const [s] = parseAllScenarios(f);
  expect(s.steps).toHaveLength(2);
  fs.unlinkSync(f);
});

// ---------------------------------------------------------------------------
// parseAllScenarios — three scenarios
// ---------------------------------------------------------------------------

test('parser — handles three scenarios correctly', () => {
  const f = tmpFeature(`
Feature: Multi

  Scenario: One
    Given step 1

  Scenario: Two
    Given step 2
    When step 3

  Scenario: Three
    Then step 4
`);
  const scenarios = parseAllScenarios(f);
  expect(scenarios).toHaveLength(3);
  expect(scenarios[0].steps).toHaveLength(1);
  expect(scenarios[1].steps).toHaveLength(2);
  expect(scenarios[2].steps).toHaveLength(1);
  fs.unlinkSync(f);
});

// ---------------------------------------------------------------------------
// parseAllScenarios — quoted params in step text
// ---------------------------------------------------------------------------

test('parser — preserves quoted values in step text', () => {
  const f = tmpFeature(`
Feature: F

  Scenario: S
    When I enter username "tomsmith"
    And I enter password "SuperSecretPassword!"
`);
  const [s] = parseAllScenarios(f);
  expect(s.steps[0].text).toBe('I enter username "tomsmith"');
  expect(s.steps[1].text).toBe('I enter password "SuperSecretPassword!"');
  fs.unlinkSync(f);
});

// ---------------------------------------------------------------------------
// parseAllScenarios — error conditions
// ---------------------------------------------------------------------------

test('parser — throws when no Feature: line present', () => {
  const f = tmpFeature(`
  Scenario: S
    Given a step
`);
  expect(() => parseAllScenarios(f)).toThrow(/No Feature:/);
  fs.unlinkSync(f);
});

test('parser — throws when no Scenario: blocks present', () => {
  const f = tmpFeature(`
Feature: F
`);
  expect(() => parseAllScenarios(f)).toThrow(/No Scenario:/);
  fs.unlinkSync(f);
});

// ---------------------------------------------------------------------------
// parseFeatureFile — backward compatibility
// ---------------------------------------------------------------------------

test('parseFeatureFile — returns the first scenario', () => {
  const f = tmpFeature(`
Feature: F

  Scenario: First
    Given step A

  Scenario: Second
    Given step B
`);
  const scenario = parseFeatureFile(f);
  expect(scenario.scenario).toBe('First');
  fs.unlinkSync(f);
});

test('parseFeatureFile — returns same result as parseAllScenarios[0]', () => {
  const f = tmpFeature(`
Feature: F

  Scenario: Only
    Given step
`);
  const all = parseAllScenarios(f);
  const single = parseFeatureFile(f);
  expect(single).toEqual(all[0]);
  fs.unlinkSync(f);
});

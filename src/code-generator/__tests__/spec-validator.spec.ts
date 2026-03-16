/**
 * Unit tests for the spec validator.
 * No browser required — pure TypeScript AST checking.
 */
import { test, expect } from '@playwright/test';
import { validateSpec } from '../spec-validator';

// ---------------------------------------------------------------------------
// Valid TypeScript
// ---------------------------------------------------------------------------

test('validator — valid empty string is valid', () => {
  const result = validateSpec('');
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('validator — valid simple expression is valid', () => {
  const result = validateSpec('const x = 1 + 2;');
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('validator — valid async function is valid', () => {
  const result = validateSpec(`
async function foo(): Promise<void> {
  await Promise.resolve();
}
`);
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('validator — valid Playwright-style spec is valid', () => {
  const result = validateSpec(`
import { test } from '@playwright/test';
import { navigateTo, assertText } from '../src/actions';

test('example', async ({ page }) => {
  await navigateTo(page, 'https://example.com');
  await assertText(page, 'Welcome');
});
`);
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('validator — valid spec with all action imports is valid', () => {
  const result = validateSpec(`
import { test } from '@playwright/test';
import { navigateTo, fillInput, clickElement, loginAs, assertText, assertUrl, assertVisible } from '../src/actions';

test('full scenario', async ({ page }) => {
  await navigateTo(page, 'https://example.com/login');
  await fillInput(page, '#username', 'tomsmith');
  await fillInput(page, '#password', 'pass');
  await clickElement(page, 'button:has-text("Login")');
  await assertUrl(page, '/secure');
  await assertText(page, 'Welcome');
  await assertVisible(page, '#logout');
});
`);
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Syntax errors
// ---------------------------------------------------------------------------

test('validator — unclosed string literal is invalid', () => {
  const result = validateSpec('const x = "unclosed;');
  expect(result.valid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
});

test('validator — missing closing brace is invalid', () => {
  const result = validateSpec(`
function foo() {
  const x = 1;
  // missing closing brace
`);
  expect(result.valid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
});

test('validator — unexpected token is invalid', () => {
  const result = validateSpec('const = = 5;');
  expect(result.valid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
});

test('validator — error message contains TS error code', () => {
  const result = validateSpec('const x = "unclosed;');
  if (!result.valid) {
    // Each error message should start with [TS followed by a code number
    expect(result.errors.some(e => /\[TS\d+\]/.test(e))).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// Note: transpileModule does NOT perform type checking — it only catches
// syntax errors. Type errors such as wrong argument count are NOT reported.
// ---------------------------------------------------------------------------

test('validator — wrong argument types do NOT cause error (transpileModule is syntax-only)', () => {
  // This would be a type error in a full tsc run, but transpileModule skips type checks
  const result = validateSpec(`
const x: number = "this is a string";
`);
  // transpileModule does not type-check — this is expected to pass
  expect(result.valid).toBe(true);
});

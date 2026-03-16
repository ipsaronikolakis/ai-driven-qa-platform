/**
 * Action Library integration tests.
 *
 * These tests run against the-internet.herokuapp.com — the same demo site
 * used by the pipeline — to verify each helper works correctly in isolation.
 *
 * Run with:
 *   npx playwright test src/actions/__tests__/actions.spec.ts
 */
import { test, expect } from '@playwright/test';
import {
  navigateTo,
  fillInput,
  clickElement,
  loginAs,
  assertText,
  assertUrl,
  assertVisible,
} from '../index';

const BASE = 'https://the-internet.herokuapp.com';

// ---------------------------------------------------------------------------
// navigateTo
// ---------------------------------------------------------------------------

test('navigateTo — navigates to the given URL', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  expect(page.url()).toContain('/login');
});

test('navigateTo — page title is set after navigation', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  const title = await page.title();
  expect(title).toBeTruthy();
});

// ---------------------------------------------------------------------------
// fillInput
// ---------------------------------------------------------------------------

test('fillInput — fills a text input by selector', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await fillInput(page, '#username', 'tomsmith');
  const value = await page.inputValue('#username');
  expect(value).toBe('tomsmith');
});

test('fillInput — fills password input', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await fillInput(page, '#password', 'SuperSecretPassword!');
  const value = await page.inputValue('#password');
  expect(value).toBe('SuperSecretPassword!');
});

test('fillInput — clears previous value before filling', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await fillInput(page, '#username', 'first');
  await fillInput(page, '#username', 'second');
  const value = await page.inputValue('#username');
  expect(value).toBe('second');
});

// ---------------------------------------------------------------------------
// clickElement
// ---------------------------------------------------------------------------

test('clickElement — clicks the login button and navigates', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await fillInput(page, '#username', 'tomsmith');
  await fillInput(page, '#password', 'SuperSecretPassword!');
  await clickElement(page, 'button:has-text("Login")');
  expect(page.url()).toContain('/secure');
});

// ---------------------------------------------------------------------------
// loginAs
// ---------------------------------------------------------------------------

test('loginAs — logs in with valid credentials', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await loginAs(page, 'tomsmith', 'SuperSecretPassword!');
  expect(page.url()).toContain('/secure');
});

test('loginAs — failed login stays on login page', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await loginAs(page, 'wronguser', 'wrongpassword');
  expect(page.url()).toContain('/login');
});

// ---------------------------------------------------------------------------
// assertText
// ---------------------------------------------------------------------------

test('assertText — passes when text is present on page', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await loginAs(page, 'tomsmith', 'SuperSecretPassword!');
  await assertText(page, 'You logged into a secure area!');
});

test('assertText — scoped to selector when provided', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await loginAs(page, 'tomsmith', 'SuperSecretPassword!');
  await assertText(page, 'You logged into a secure area!', '#flash');
});

test('assertText — fails when text is absent', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await expect(
    assertText(page, 'this text does not exist on the login page')
  ).rejects.toThrow();
});

// ---------------------------------------------------------------------------
// assertUrl
// ---------------------------------------------------------------------------

test('assertUrl — passes when URL matches pattern', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await loginAs(page, 'tomsmith', 'SuperSecretPassword!');
  await assertUrl(page, '/secure');
});

test('assertUrl — fails when URL does not match', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await expect(
    assertUrl(page, '/this-page-does-not-exist')
  ).rejects.toThrow();
});

// ---------------------------------------------------------------------------
// assertVisible
// ---------------------------------------------------------------------------

test('assertVisible — passes when element is visible', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await assertVisible(page, '#username');
  await assertVisible(page, '#password');
  await assertVisible(page, 'button:has-text("Login")');
});

test('assertVisible — fails when element is absent', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await expect(
    assertVisible(page, '#element-that-does-not-exist')
  ).rejects.toThrow();
});

// ---------------------------------------------------------------------------
// Full login flow using only Action Library
// ---------------------------------------------------------------------------

test('full login flow via action library', async ({ page }) => {
  await navigateTo(page, `${BASE}/login`);
  await fillInput(page, '#username', 'tomsmith');
  await fillInput(page, '#password', 'SuperSecretPassword!');
  await clickElement(page, 'button:has-text("Login")');
  await assertUrl(page, '/secure');
  await assertText(page, 'You logged into a secure area!');
  await assertVisible(page, 'a:has-text("Logout")');
});

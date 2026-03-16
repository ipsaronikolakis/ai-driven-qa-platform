/**
 * Action Library — stable, reusable helpers for generated Playwright specs.
 *
 * Generated specs call these functions instead of raw Playwright APIs.
 * This is the maintenance layer: fix a selector here, fix all tests at once.
 *
 * Rules:
 *   - Never import from test-specific code.
 *   - Each function handles ONE atomic interaction.
 *   - Selectors live here, not in generated specs.
 */
import { Page, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Navigates to a URL and waits for the page to be ready.
 * @param page  Playwright Page object.
 * @param url   Full URL or path (resolved against baseURL in config).
 */
export async function navigateTo(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

/**
 * Fills an input field with the given value.
 * @param page      Playwright Page object.
 * @param selector  CSS or Playwright selector for the input element.
 * @param value     Text to type into the field.
 */
export async function fillInput(page: Page, selector: string, value: string): Promise<void> {
  await page.fill(selector, value);
}

/**
 * Clicks an element identified by the given selector.
 * @param page      Playwright Page object.
 * @param selector  CSS or Playwright selector for the element to click.
 */
export async function clickElement(page: Page, selector: string): Promise<void> {
  await page.click(selector);
}

/**
 * Logs in using the provided credentials.
 * Fills the username field, fills the password field, then submits the form.
 *
 * Selector strategy (stable → fragile):
 *   1. #username / #password  (unique IDs)
 *   2. button[type="submit"]  (semantic fallback)
 *
 * @param page      Playwright Page object.
 * @param username  Username to enter.
 * @param password  Password to enter.
 */
export async function loginAs(page: Page, username: string, password: string): Promise<void> {
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"], input[type="submit"], button:has-text("Login")');
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/**
 * Asserts that the given text is visible on the page.
 * If a selector is provided, checks within that element only.
 * @param page      Playwright Page object.
 * @param text      Expected text string.
 * @param selector  Optional CSS/Playwright selector to scope the assertion.
 */
export async function assertText(page: Page, text: string, selector?: string): Promise<void> {
  const locator = selector ? page.locator(selector) : page.locator('body');
  await expect(locator).toContainText(text);
}

/**
 * Asserts that the current URL contains the given pattern.
 * @param page     Playwright Page object.
 * @param pattern  Substring or regex string to match against the current URL.
 */
export async function assertUrl(page: Page, pattern: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

/**
 * Asserts that the element identified by the selector is visible.
 * @param page      Playwright Page object.
 * @param selector  CSS or Playwright selector for the expected element.
 */
export async function assertVisible(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector)).toBeVisible();
}

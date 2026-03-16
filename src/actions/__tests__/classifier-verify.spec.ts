/**
 * Deliberate-failure tests used to verify the failure classifier.
 * These tests MUST fail — that is the expected outcome.
 * Run via: npx playwright test src/actions/__tests__/classifier-verify.spec.ts
 */
import { test } from '@playwright/test';
import { navigateTo, clickElement, assertText } from '../index';

const BASE = 'https://the-internet.herokuapp.com';

/** Should be classified as 'selector_drift' — expected to fail by design */
test('VERIFY_CLASSIFIER: selector drift — bad selector times out', async ({ page }) => {
  test.fail(); // this test must fail; unexpected pass = classifier broken
  await navigateTo(page, `${BASE}/login`);
  // Use page.click() directly with a short timeout so the action throws
  // (rather than waiting for the full test timeout to kill the test).
  // test.fail() only catches thrown errors, not test-level timeout kills.
  await page.click('#this-selector-does-not-exist-on-the-page', { timeout: 4000 });
});

/** Should be classified as 'product_defect' — expected to fail by design */
test('VERIFY_CLASSIFIER: product defect — wrong expected text', async ({ page }) => {
  test.fail(); // this test must fail; unexpected pass = classifier broken
  await navigateTo(page, `${BASE}/login`);
  await assertText(page, 'THIS TEXT IS DEFINITELY NOT ON THE LOGIN PAGE');
});

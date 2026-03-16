/**
 * Unit tests for mergePageModels and mergePageModels edge cases.
 * No browser required.
 */
import { test, expect } from '@playwright/test';
import { mergePageModels } from '../explorer';
import { PageModel, PageElement } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(selector: string, type: PageElement['type'] = 'button', text = ''): PageElement {
  return { type, tag: 'button', text, id: '', name: '', selector };
}

function makeModel(url: string, elements: PageElement[]): PageModel {
  return { url, title: `Title for ${url}`, elements };
}

// ---------------------------------------------------------------------------
// Basic merging
// ---------------------------------------------------------------------------

test('mergePageModels — single model returned unchanged', () => {
  const model = makeModel('/login', [makeElement('#username', 'input'), makeElement('#password', 'input')]);
  const merged = mergePageModels([model]);
  expect(merged).toEqual(model);
});

test('mergePageModels — combines elements from two models', () => {
  const m1 = makeModel('/login', [makeElement('#username', 'input'), makeElement('#password', 'input')]);
  const m2 = makeModel('/secure', [makeElement('a:has-text("Logout")', 'link')]);
  const merged = mergePageModels([m1, m2]);
  expect(merged.elements).toHaveLength(3);
});

test('mergePageModels — URL comes from first model', () => {
  const m1 = makeModel('/login', [makeElement('#btn')]);
  const m2 = makeModel('/secure', [makeElement('#other')]);
  const merged = mergePageModels([m1, m2]);
  expect(merged.url).toBe('/login');
});

test('mergePageModels — title comes from first model', () => {
  const m1 = makeModel('/login', [makeElement('#btn')]);
  const m2 = makeModel('/secure', [makeElement('#other')]);
  const merged = mergePageModels([m1, m2]);
  expect(merged.title).toBe('Title for /login');
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

test('mergePageModels — deduplicates elements with the same selector', () => {
  const shared = makeElement('#flash', 'text', 'message');
  const m1 = makeModel('/login', [shared, makeElement('#username', 'input')]);
  const m2 = makeModel('/secure', [shared, makeElement('#password', 'input')]);
  const merged = mergePageModels([m1, m2]);
  // #flash appears in both — should be deduplicated
  const flashCount = merged.elements.filter(e => e.selector === '#flash').length;
  expect(flashCount).toBe(1);
  expect(merged.elements).toHaveLength(3); // flash + username + password
});

test('mergePageModels — preserves first occurrence when duplicate exists', () => {
  const e1 = { ...makeElement('#btn', 'button', 'Login') };
  const e2 = { ...makeElement('#btn', 'button', 'Sign In') }; // same selector, different text
  const m1 = makeModel('/a', [e1]);
  const m2 = makeModel('/b', [e2]);
  const merged = mergePageModels([m1, m2]);
  const found = merged.elements.find(e => e.selector === '#btn');
  expect(found?.text).toBe('Login'); // first model's text preserved
});

// ---------------------------------------------------------------------------
// Three models
// ---------------------------------------------------------------------------

test('mergePageModels — combines three models', () => {
  const m1 = makeModel('/a', [makeElement('#a')]);
  const m2 = makeModel('/b', [makeElement('#b')]);
  const m3 = makeModel('/c', [makeElement('#c')]);
  const merged = mergePageModels([m1, m2, m3]);
  expect(merged.elements).toHaveLength(3);
  expect(merged.elements.map(e => e.selector)).toEqual(['#a', '#b', '#c']);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('mergePageModels — empty elements list in model is valid', () => {
  const m1 = makeModel('/a', []);
  const m2 = makeModel('/b', [makeElement('#btn')]);
  const merged = mergePageModels([m1, m2]);
  expect(merged.elements).toHaveLength(1);
});

test('mergePageModels — throws on empty array', () => {
  expect(() => mergePageModels([])).toThrow();
});

test('mergePageModels — preserves element metadata (type, tag, id, name)', () => {
  const el: PageElement = {
    type: 'input',
    tag: 'input',
    text: '',
    id: 'username',
    name: 'username',
    selector: '#username',
    inputType: 'text',
  };
  const merged = mergePageModels([makeModel('/login', [el])]);
  expect(merged.elements[0]).toEqual(el);
});

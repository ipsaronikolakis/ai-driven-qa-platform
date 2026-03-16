import { ExplorationStep } from '../types';

/**
 * Shared exploration script for the login-then-secure flow.
 * Used by both the pipeline (src/index.ts) and the healer (src/healer/index.ts).
 *
 * To add more pages: append navigate → fill/click → capture sequences.
 */
export const EXPLORATION_SCRIPT: ExplorationStep[] = [
  { action: 'navigate', value: 'https://the-internet.herokuapp.com/login' },
  { action: 'capture',  value: 'https://the-internet.herokuapp.com/login' },
  { action: 'fill',     selector: '#username', value: 'tomsmith' },
  { action: 'fill',     selector: '#password', value: 'SuperSecretPassword!' },
  { action: 'click',    selector: 'button.radius' },
  { action: 'capture',  value: 'https://the-internet.herokuapp.com/secure' },
];

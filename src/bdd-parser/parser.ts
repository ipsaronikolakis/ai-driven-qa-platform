import * as fs from 'fs';
import * as path from 'path';
import { ParsedScenario, BDDStep } from '../types';

type ParserState = 'IDLE' | 'IN_FEATURE' | 'IN_SCENARIO';

const STEP_KEYWORDS = ['Given', 'When', 'Then', 'And', 'But'] as const;
type StepKeyword = typeof STEP_KEYWORDS[number];

function isStepKeyword(word: string): word is StepKeyword {
  return (STEP_KEYWORDS as readonly string[]).includes(word);
}

/**
 * Parses a .feature file and returns ALL scenarios found in it.
 * Each Scenario: block becomes a separate ParsedScenario.
 */
export function parseAllScenarios(filePath: string): ParsedScenario[] {
  const absolutePath = path.resolve(filePath);
  const raw = fs.readFileSync(absolutePath, 'utf-8');
  const lines = raw.split('\n');

  const scenarios: ParsedScenario[] = [];
  let state: ParserState = 'IDLE';
  let featureName = '';
  let scenarioName = '';
  let steps: BDDStep[] = [];

  function flushScenario() {
    if (scenarioName && steps.length > 0) {
      scenarios.push({ feature: featureName, scenario: scenarioName, steps });
    }
    scenarioName = '';
    steps = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('Feature:')) {
      featureName = line.replace('Feature:', '').trim();
      state = 'IN_FEATURE';
      continue;
    }

    if (line.startsWith('Scenario:')) {
      flushScenario(); // save the previous scenario before starting a new one
      scenarioName = line.replace('Scenario:', '').trim();
      state = 'IN_SCENARIO';
      continue;
    }

    if (state === 'IN_SCENARIO') {
      const firstWord = line.split(' ')[0];
      if (isStepKeyword(firstWord)) {
        const stepText = line.slice(firstWord.length).trim();
        steps.push({ keyword: firstWord, text: stepText });
      }
    }
  }

  flushScenario(); // save the last scenario

  if (!featureName) throw new Error(`No Feature: found in ${filePath}`);
  if (scenarios.length === 0) throw new Error(`No Scenario: blocks found in ${filePath}`);

  return scenarios;
}

/**
 * Convenience wrapper — returns the first scenario only.
 * Preserved for backward compatibility.
 */
export function parseFeatureFile(filePath: string): ParsedScenario {
  return parseAllScenarios(filePath)[0];
}

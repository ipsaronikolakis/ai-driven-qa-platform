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
  let featureLine = -1;
  let scenarioName = '';
  let scenarioLine = -1;
  let steps: BDDStep[] = [];

  function flushScenario() {
    if (scenarioName && steps.length > 0) {
      scenarios.push({ feature: featureName, scenario: scenarioName, steps });
    }
    scenarioName = '';
    steps = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();

    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('Feature:')) {
      featureName = line.replace('Feature:', '').trim();
      featureLine = lineNum;
      state = 'IN_FEATURE';
      continue;
    }

    if (line.startsWith('Scenario Outline:') || line.startsWith('Scenario:')) {
      flushScenario(); // save the previous scenario before starting a new one
      scenarioName = line.replace('Scenario Outline:', '').replace('Scenario:', '').trim();
      scenarioLine = lineNum;
      state = 'IN_SCENARIO';
      continue;
    }

    if (state === 'IN_SCENARIO') {
      const firstWord = line.split(' ')[0];
      if (isStepKeyword(firstWord)) {
        const stepText = line.slice(firstWord.length).trim();
        steps.push({ keyword: firstWord, text: stepText, line: lineNum });
      }
    }
  }

  flushScenario(); // save the last scenario

  void scenarioLine; // recorded in ParsedScenario steps; here for future use
  if (!featureName) throw new Error(`No Feature: directive found in ${filePath} (${lines.length} lines)`);
  if (scenarios.length === 0) {
    const hint = featureLine > 0 ? ` (Feature: at line ${featureLine})` : '';
    throw new Error(`No Scenario: blocks found in ${filePath}${hint}`);
  }

  return scenarios;
}

/**
 * Convenience wrapper — returns the first scenario only.
 * Preserved for backward compatibility.
 */
export function parseFeatureFile(filePath: string): ParsedScenario {
  return parseAllScenarios(filePath)[0];
}

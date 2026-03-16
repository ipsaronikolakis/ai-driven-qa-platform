/**
 * CLI entry point for scenario linting.
 *
 * Usage:
 *   npm run lint:scenarios
 *
 * Lints all *.feature files in scenarios/ against vocabulary/core.yaml and
 * prints a report. Exits 0 if all steps are canonical, 1 if any unrecognised
 * steps are found.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import { parseFeatureFile } from '../bdd-parser/parser';
import { VocabularyRegistry } from './registry';
import { lintScenario } from './linter';

const SCENARIOS_DIR = path.resolve(__dirname, '..', '..', 'scenarios');
const VOCAB_FILE = path.resolve(__dirname, '..', '..', 'vocabulary', 'core.yaml');

function main(): void {
  const registry = VocabularyRegistry.load(VOCAB_FILE);
  console.log(`Vocabulary ${registry.version} — ${registry.actions.length} actions, ${registry.assertions.length} assertions\n`);

  const featureFiles = fs
    .readdirSync(SCENARIOS_DIR)
    .filter(f => f.endsWith('.feature'))
    .map(f => path.join(SCENARIOS_DIR, f));

  if (featureFiles.length === 0) {
    console.log('No .feature files found in scenarios/.');
    process.exit(0);
  }

  let totalSteps = 0;
  let totalWarnings = 0;

  for (const filePath of featureFiles) {
    const scenario = parseFeatureFile(filePath);
    const result = lintScenario(scenario, registry);
    const fileName = path.relative(SCENARIOS_DIR, filePath);

    totalSteps += scenario.steps.length;
    totalWarnings += result.warnings.length;

    const matched = scenario.steps.length - result.warnings.length;
    const coverage = scenario.steps.length > 0
      ? Math.round((matched / scenario.steps.length) * 100)
      : 100;

    const status = result.warnings.length === 0 ? '✓' : '✗';
    console.log(`${status} ${fileName} — ${matched}/${scenario.steps.length} steps canonical (${coverage}% coverage)`);

    for (const w of result.warnings) {
      console.log(`    ${w.message}`);
      if (w.suggestion) console.log(`    → ${w.suggestion}`);
    }
  }

  console.log('');
  console.log(`Summary: ${featureFiles.length} file(s), ${totalSteps} step(s), ${totalWarnings} unrecognised`);

  if (totalWarnings > 0) {
    console.log('\nTip: Add unrecognised steps to vocabulary/core.yaml or rephrase them to match existing entries.');
    process.exit(1);
  }

  process.exit(0);
}

main();

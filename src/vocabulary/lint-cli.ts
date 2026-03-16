/**
 * CLI entry point for scenario linting.
 *
 * Usage:
 *   npm run lint:scenarios          — lint and report (exits 1 on warnings)
 *   npm run lint:scenarios -- --fix — show proposed rewrites and apply them
 *
 * With --fix:
 *   Steps that don't match the vocabulary but have a closest match with
 *   score >= 0.5 are rewritten to the canonical template form. Quoted param
 *   values are extracted from the original step and substituted in order.
 *   Exits 0 even when rewrites are made.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import { parseAllScenarios } from '../bdd-parser/parser';
import { VocabularyRegistry } from './registry';
import { lintScenario } from './linter';
import type { BDDStep } from '../types';

const SCENARIOS_DIR = path.resolve(__dirname, '..', '..', 'scenarios');
const VOCAB_FILE    = path.resolve(__dirname, '..', '..', 'vocabulary', 'core.yaml');
const FIX_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Fix rewriting helpers
// ---------------------------------------------------------------------------

/**
 * Extracts all quoted string values from a step text, in order.
 * Handles both single and double quotes.
 */
function extractQuotedValues(text: string): string[] {
  const values: string[] = [];
  const re = /["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) values.push(m[1]);
  return values;
}

/**
 * Builds a rewritten step line given the canonical template and the original
 * step. Substitutes quoted values from the original into template {param}
 * placeholders left-to-right.
 *
 * Returns null if the template has params but no quoted values are available.
 */
function buildRewrite(step: BDDStep, templateName: string): string | null {
  const paramNames = [...templateName.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
  const values = extractQuotedValues(step.text);

  if (paramNames.length > 0 && values.length === 0) return null;

  let rewritten = templateName;
  for (let i = 0; i < paramNames.length; i++) {
    const value = values[i] ?? `<${paramNames[i]}>`;
    rewritten = rewritten.replace(`{${paramNames[i]}}`, `"${value}"`);
  }
  return rewritten;
}

/**
 * Finds the 1-based line number of a step in the feature file content.
 * `matchedSoFar` tracks how many times we've matched this text already
 * (to handle duplicate steps across scenarios).
 */
function findStepLine(
  lines: string[],
  step: BDDStep,
  matchedSoFar: Map<string, number>,
): number {
  const key = `${step.keyword} ${step.text}`;
  const occurrencesNeeded = (matchedSoFar.get(key) ?? 0) + 1;
  matchedSoFar.set(key, occurrencesNeeded);

  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === key) {
      seen++;
      if (seen === occurrencesNeeded) return i + 1;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const isFix = process.argv.includes('--fix');
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
  let totalFixed = 0;
  let totalUnfixable = 0;

  for (const filePath of featureFiles) {
    const scenarios = parseAllScenarios(filePath);
    const fileName = path.relative(process.cwd(), filePath);

    // Aggregate lint results across all scenarios in the file
    let fileSteps = 0;
    let fileWarnings = 0;

    // Collect all fixable proposals for this file
    interface FixProposal {
      lineNumber: number;
      originalLine: string;
      rewrittenLine: string;
      originalText: string;
      rewrittenText: string;
    }
    const proposals: FixProposal[] = [];
    const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const matchedSoFar = new Map<string, number>();

    for (const scenario of scenarios) {
      const result = lintScenario(scenario, registry);
      fileSteps  += scenario.steps.length;
      fileWarnings += result.warnings.length;

      for (const w of result.warnings) {
        const closest = registry.findClosest(w.step.text);

        if (isFix && closest.score >= FIX_THRESHOLD) {
          const rewrittenText = buildRewrite(w.step, closest.entry.name);
          if (rewrittenText !== null) {
            const lineNum = findStepLine(fileLines, w.step, matchedSoFar);
            if (lineNum > 0) {
              const originalLine = fileLines[lineNum - 1];
              const indent = originalLine.match(/^(\s*)/)?.[1] ?? '';
              const rewrittenLine = `${indent}${w.step.keyword} ${rewrittenText}`;
              proposals.push({
                lineNumber: lineNum,
                originalLine,
                rewrittenLine,
                originalText: `${w.step.keyword} ${w.step.text}`,
                rewrittenText: `${w.step.keyword} ${rewrittenText}`,
              });
            } else {
              totalUnfixable++;
            }
          } else {
            totalUnfixable++;
          }
        }
      }
    }

    totalSteps    += fileSteps;
    totalWarnings += fileWarnings;

    const matched  = fileSteps - fileWarnings;
    const coverage = fileSteps > 0 ? Math.round((matched / fileSteps) * 100) : 100;
    const status   = fileWarnings === 0 ? '✓' : '✗';
    console.log(`${status} ${fileName} — ${matched}/${fileSteps} steps canonical (${coverage}% coverage)`);

    // Re-lint for display (warnings detail)
    for (const scenario of scenarios) {
      const result = lintScenario(scenario, registry);
      for (const w of result.warnings) {
        const closest = registry.findClosest(w.step.text);
        console.log(`    ${w.message}`);
        if (w.suggestion) console.log(`    → ${w.suggestion}`);

        if (isFix) {
          const proposal = proposals.find(p => p.originalText === `${w.step.keyword} ${w.step.text}`);
          if (proposal) {
            console.log(`    - ${proposal.originalText}`);
            console.log(`    + ${proposal.rewrittenText}  [score: ${closest.score.toFixed(2)}]`);
          } else {
            console.log(`    ⚠ Cannot auto-fix (score: ${closest.score.toFixed(2)} — no quoted params found)`);
          }
        }
      }
    }

    // Apply fixes to this file
    if (isFix && proposals.length > 0) {
      let updatedLines = [...fileLines];
      // Apply in reverse line order so line numbers stay valid
      const sorted = [...proposals].sort((a, b) => b.lineNumber - a.lineNumber);
      for (const p of sorted) {
        updatedLines[p.lineNumber - 1] = p.rewrittenLine;
      }
      fs.writeFileSync(filePath, updatedLines.join('\n'), 'utf-8');
      console.log(`    Fixed ${proposals.length} step(s) in ${fileName}`);
      totalFixed += proposals.length;
    }
  }

  console.log('');
  console.log(`Summary: ${featureFiles.length} file(s), ${totalSteps} step(s), ${totalWarnings} unrecognised`);

  if (isFix) {
    if (totalFixed > 0)      console.log(`Fixed: ${totalFixed} step(s) rewritten`);
    if (totalUnfixable > 0)  console.log(`Skipped: ${totalUnfixable} step(s) could not be auto-fixed (add to vocabulary/core.yaml manually)`);
    process.exit(0);
  }

  if (totalWarnings > 0) {
    console.log('\nTip: Add unrecognised steps to vocabulary/core.yaml or rephrase them to match existing entries.');
    console.log('     Run with --fix to auto-rewrite steps with a close vocabulary match.');
    process.exit(1);
  }

  process.exit(0);
}

main();

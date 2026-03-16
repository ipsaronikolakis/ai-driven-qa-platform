import * as ts from 'typescript';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates generated TypeScript spec content for syntax errors.
 *
 * Uses TypeScript's single-file transpiler (transpileModule) for a fast,
 * dependency-free parse. This catches syntax errors (unclosed strings, bad
 * tokens, malformed expressions) without needing a full type-check pass.
 *
 * Adds < 1s to pipeline runtime.
 */
export function validateSpec(content: string): ValidationResult {
  const result = ts.transpileModule(content, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
    reportDiagnostics: true,
  });

  const errors = (result.diagnostics ?? []).map(d => {
    const text =
      typeof d.messageText === 'string'
        ? d.messageText
        : (d.messageText as ts.DiagnosticMessageChain).messageText;
    return `[TS${d.code}] ${text}`;
  });

  return { valid: errors.length === 0, errors };
}

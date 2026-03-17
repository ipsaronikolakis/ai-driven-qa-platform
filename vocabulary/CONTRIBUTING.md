# Proposing a new vocabulary term

The vocabulary in `core.yaml` defines the canonical step phrasing for this platform.
Changes are evidence-based and go through code review — not added on request alone.

---

## When to propose a new term

Propose a term when **the same unrecognised step pattern appears in 5 or more scenarios**.

`npm run vocab:analyze` identifies these automatically and creates a draft proposal in
`vocabulary/proposals/`. You can also create one manually using the template below.

Do **not** propose terms for:
- One-off steps that only appear in a single scenario
- Domain-specific phrasing that belongs in a team extension file
- Steps that can be expressed with an existing term + a parameter

---

## How to propose

1. Copy `vocabulary/proposals/TEMPLATE.md` to `vocabulary/proposals/<step-name>.md`
2. Fill in all sections — especially **evidence** (how many scenarios, which files)
3. Open a PR. The PR description should include the output of `npm run vocab:analyze`
4. At least one reviewer must approve before the term is added to `core.yaml`
5. After merge, run `npm run lint:scenarios` to verify existing scenarios still pass

---

## Governance rules

| Rule | Reason |
|---|---|
| No auto-merge of vocabulary PRs | A bad term breaks all existing tests that used the old phrasing |
| Semver bump required | Patch = clarification only; Minor = new term; Major = renamed/removed term |
| `changelog:` section must be updated | Traceability — who added what and why |
| Team-local terms go in `teams/<team>/` | Core vocab is for universal actions only |

---

## Template

```markdown
## Proposed term: `<step-name>`

**Pattern:** `<pattern with {params}>`
**Keyword:** Given / When / Then
**Maps to action:** `<action type>`

**Evidence:**
- Appears in N scenarios across these files: …
- Current unrecognised phrasing: "…", "…", "…"

**Suggested canonical form:** `<canonical phrasing>`

**Parameters:**
- `{param}`: description

**Why this term and not an existing one:**
…
```

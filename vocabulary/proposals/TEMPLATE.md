# Vocabulary Proposal: {step-name}

**Status:** draft
**Proposed by:**
**Date:**

## Rationale

_Why does this step need to be in the canonical vocabulary? What workflow does it support?_

## Canonical Form

```
{step-name}
```

## Example Scenarios

```gherkin
Feature: Example feature

  Scenario: Example scenario
    Given ...
    When {step-name}
    Then ...
```

## maps_to

_Which action library function should this map to? If it doesn't exist yet, describe what it should do._

```yaml
- name: "{step-name}"
  maps_to: actionLibraryFunction
  description: "Short description of what this step does."
  params:
    param1: string
```

## Notes

_Any implementation notes, parameter types, edge cases, or links to related vocabulary entries._

---

> To propose a new term: copy this file to `vocabulary/proposals/{slug}.md`,
> fill in all sections, and open a PR. Require at least one reviewer before
> merging to `vocabulary/core.yaml`. Once merged, bump the patch version.

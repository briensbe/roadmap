---
name: code-metrics
description: Analyzes code structure, function/method sizes, and file metrics to identify refactoring candidates, bloated functions, and rule compliance (e.g. 1000 lines max per file).
license: MIT
compatibility: Node.js runtime available.
---

# Code Metrics Skill

This skill analyzes files to identify architectural debt, oversized functions, and high-complexity areas, directly supporting the project's refactoring directives (such as the 1000-line rule and deep module principles).

## Capabilities

1. **Function Size Breakdown**: Quickly inspect a TypeScript / JavaScript file and list all functions or methods sorted by line length.
2. **Refactoring Target Detection**: Pinpoints exactly which functions are consuming the bulk of a file to plan safe, targeted extractions.

## Tools / Scripts

- **`scripts/analyze-functions.js`**: Analyzes function lengths and line ranges in a given file.

### Usage

Run via terminal command:

```bash
node .agents/skills/code-metrics/scripts/analyze-functions.js <path-to-file>
```

Example:
```bash
node .agents/skills/code-metrics/scripts/analyze-functions.js src/components/plan-view/plan-projection.engine.ts
```

## When to Use

- When reviewing files exceeding or approaching the project limit of ~1000 lines (per project rules).
- Before refactoring or splitting a module, to identify the largest functions to extract.
- When an agent needs an overview of the internal structure and entrypoints of an unfamiliar service or engine.

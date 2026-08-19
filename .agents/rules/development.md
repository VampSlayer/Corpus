---
name: Corpus Development Guidelines
description: Instructions for modifying the Corpus MCP server codebase
trigger: always_on
---

# 🤖 Corpus Development Guidelines

When modifying this repository, follow these constraints and conventions:

1. **No Databases**: The entire corpus is a static JSON file (`corpus/manifest.json`) built by `scripts/build-corpus.ts`. Do not introduce SQLite, Postgres, or any other database.
2. **Pure Logic Testing**: Keep GitHub API network calls out of the unit-tested path. Test pure logic (`logic.ts`, `tools.ts`) directly.
3. **Test Runner**: Use the native Node.js test runner (`node:test`) and `node:assert/strict`. No external testing frameworks like Jest or Vitest.
4. **Build System**: Use `npx tsc` for compilation. The output is directed to `dist/`.
5. **No Spawn**: Use the MCP SDK's in-memory client/server transport for tool-level testing. Do not spawn child processes to test the MCP interface.
6. **Linting**: Code is linted using ESLint flat configuration and formatted with Prettier. Ensure `npm run build` and `npm run test` pass before committing.

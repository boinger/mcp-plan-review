# Plan: mcp-plan-review MCP Server

## Steps

- [x] Step 1: Project scaffolding (package.json, tsconfig.json, .gitignore, npm install)
- [x] Step 2: Config loader (src/config.ts)
- [x] Step 3: Reviewer system prompt (src/prompts.ts)
- [x] Step 4: Anthropic API wrapper (src/reviewer.ts)
- [x] Step 5: Server bootstrap + tool registration (src/index.ts)
- [x] Step 6: Tests (16/16 passing)
- [x] Step 7: README + registration

## Modified Files

- package.json, tsconfig.json, .gitignore
- src/index.ts, src/config.ts, src/prompts.ts, src/reviewer.ts
- src/test/config.test.ts, src/test/reviewer.test.ts, src/test/review-plan.test.ts
- README.md

## Key Decisions

- McpServer + registerTool() (high-level API)
- esmock for ESM mocking (not experimental mock.module())
- zod/v4 import path
- node:test + node:assert/strict

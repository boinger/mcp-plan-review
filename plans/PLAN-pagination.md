# Plan: Paginated Review Sessions → MCP Elicitation

## Status: COMPLETE (elicitation approach)

## Context

The single `review_plan` tool returned all feedback items at once. Claude's
helpfulness training caused it to batch/summarize/cherry-pick items instead of
presenting them one at a time for user triage.

### Approaches tried and abandoned

1. **Skill behavioral instructions** ("present one at a time", "STOP after each") — Claude ignored them completely, three iterations.
2. **Paginated session API** (review_plan + submit_decision + session state) — designed but replaced by elicitation before shipping.

### Final approach: MCP Elicitation

The server uses MCP elicitation (`server.elicitInput()`) to present each
feedback item directly to the user via interactive dialogs during the tool call.
Claude never sees individual items — it gets back only the final summary with
accepted/skipped lists.

## Changes made

- `src/index.ts` — single `review_plan` tool with elicitation loop inside handler
- `src/test/review-plan.test.ts` — updated tests for new response shape
- `skill/SKILL.md` — simplified for elicitation flow (skill manages outer loop, server handles triage)
- `README.md` — updated tool docs, added elicitation explanation
- Deleted: `src/sessions.ts`, `src/test/sessions.test.ts` (pagination artifacts)

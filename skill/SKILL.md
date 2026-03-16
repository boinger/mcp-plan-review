---
name: review-plan
description: Use after drafting an implementation plan to get independent architectural review with per-item accept/skip triage
---

# Plan Review Skill

Submit an implementation plan for independent architectural review, then triage
feedback items one at a time with accept/skip decisions.

The MCP server returns ONE feedback item at a time. You cannot see the next item
until you call `submit_decision` with the user's choice for the current one.

## Tools used

| Tool | Purpose |
|------|---------|
| `mcp__mcp-plan-review__review_plan` | Submit plan, get first feedback item |
| `mcp__mcp-plan-review__submit_decision` | Record user's accept/skip, get next item |

---

## Phase 1: Locate the plan

Check in this order:

1. **User specified a file path** → read that file to get the plan text.
2. **A plan was just generated in this conversation** (visible in context) → use it directly.
3. **No plan is evident** → ask the user: "Which plan should I review? Provide a file path or paste the plan text." Wait for their response before continuing.

You must have the **complete plan text** before proceeding.

## Phase 2: Submit for review

1. Verify `mcp__mcp-plan-review__review_plan` is available. If not, tell the user:
   > The mcp-plan-review MCP server doesn't appear to be registered. See ~/Projects/mcp-plan-review/README.md for setup instructions.
2. Call `mcp__mcp-plan-review__review_plan` with the plan text.
3. The response is JSON. Two shapes:
   - **No issues**: `{ done: true, total: 0 }` → announce "Reviewer found no issues. Plan is final." and **stop**.
   - **Has feedback**: `{ review_id, total, current_index: 0, item: {...} }` → proceed to Phase 3.
4. Track the current review round number (starts at 1).

## Phase 3: Triage feedback items

Announce: **"Review round N returned M item(s). Presenting each for your decision."**

Then present the item from the response:

```
[1/M] category: title
Description: <description>
Suggestion: <suggestion>

1. Accept
2. Skip
```

Present the item exactly as returned. Do not add commentary, opinion, or assessment. Do not rank, summarize, or group items. The user decides — not you.

When the user responds, call `mcp__mcp-plan-review__submit_decision` with:
- `review_id`: from the review_plan response
- `decision`: `"accept"` or `"skip"` based on what the user said

The response will be either:
- **Next item**: `{ review_id, current_index, total, item }` → present it in the same format, ask accept/skip, repeat.
- **Done**: `{ done: true, accepted: [...], skipped: [...] }` → announce: **"Accepted N of M items: [list]"** and proceed to Phase 4.

## Phase 4: Revise plan

- If zero items accepted → announce "No changes to the plan. Plan is final." and **stop**.
- Revise the plan incorporating **all** accepted feedback — not a subset you think is important, ALL of them:
  - **Plan came from a file** → rewrite that file with the revised plan.
  - **Plan came from conversation context** → output the complete revised plan in a fenced code block.
- After revision, ask: **"Re-review the revised plan, or done?"**

## Phase 5: Loop or finish

- **Done** → announce "Plan is final." and stop.
- **Re-review** → increment round counter → go to Phase 2 with the revised plan text. There is no round limit. The user decides when the plan is done.

## Error handling

- **MCP tool not registered**: Clear message with setup pointer (Phase 2).
- **MCP tool returns error**: Report the error verbatim. Do not skip review or fabricate feedback.
- **Invalid review_id from submit_decision**: The session may have expired (30 min TTL). Tell the user and offer to re-submit the plan.

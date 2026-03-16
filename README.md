# mcp-plan-review

MCP server that sends implementation plans to a separate Claude instance for independent architectural review. Returns feedback items one at a time via paginated sessions for human triage (accept/skip).

## Tools

| Name | Description |
|------|-------------|
| `review_plan` | Send a plan to an independent Claude reviewer. Returns a session ID and the first feedback item. |
| `submit_decision` | Record accept/skip for the current item. Returns the next item, or the final summary when all items are decided. |

### `review_plan`

**Input**: `{ plan: string }`

**Output** (has feedback):
```json
{ "review_id": "uuid", "total": 7, "current_index": 0, "item": { "category": "...", "title": "...", "description": "...", "suggestion": "..." } }
```

**Output** (no feedback):
```json
{ "review_id": "uuid", "total": 0, "done": true, "accepted": [], "skipped": [] }
```

### `submit_decision`

**Input**: `{ review_id: string, decision: "accept" | "skip" }`

**Output** (next item):
```json
{ "review_id": "uuid", "current_index": 1, "total": 7, "item": { ... } }
```

**Output** (all decided):
```json
{ "review_id": "uuid", "done": true, "accepted": ["title1", "title2"], "skipped": ["title3"] }
```

### Categories

`completeness`, `risk`, `edge_case`, `architecture`, `dependency`, `testing`, `error_handling`, `clarity`, `other`

### How triage works

`review_plan` sends the plan to an independent reviewer and returns only the first feedback item. Claude presents it to the user. The user says accept or skip. Claude calls `submit_decision` with the user's choice and gets the next item. This repeats until all items are triaged.

Claude only ever sees one item at a time — it cannot batch-apply, summarize, or cherry-pick feedback. Sessions expire after 30 minutes of inactivity.

## Setup

### Prerequisites

- Node.js 20+
- An Anthropic API key

### Build

```bash
cd ~/Projects/mcp-plan-review
npm install
npm run build
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for the reviewer |
| `REVIEW_MODEL` | Yes* | Model to use for reviews (e.g. `claude-sonnet-4-6`) |

\* Can also be set via config file.

### Config File (Optional)

`~/.config/mcp-plan-review/config.json`:

```json
{
  "model": "claude-sonnet-4-6",
  "systemPrompt": "Custom reviewer prompt...",
  "maxTokens": 4096
}
```

Config values override environment variables. All fields are optional.

### Register with Claude Code

```bash
claude mcp add mcp-plan-review --scope user \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e REVIEW_MODEL=claude-sonnet-4-6 \
  -- node ~/Projects/mcp-plan-review/build/index.js
```

## Skill Setup

The review-plan skill orchestrates the review workflow: locating the plan, calling the paginated tools, presenting each item for user triage, revising the plan, and optionally re-reviewing.

### Install

```bash
ln -s ~/Projects/mcp-plan-review/skill ~/.claude/skills/review-plan
```

### Usage

After drafting a plan, invoke the skill:

```
/review-plan
```

The skill also auto-triggers when Claude detects a plan review context.

### What it does

1. Locates the plan (file path, conversation context, or asks you)
2. Calls `review_plan` — gets first feedback item
3. Presents the item, asks accept or skip
4. Calls `submit_decision` with your choice — gets next item
5. Repeats until all items triaged
6. Revises the plan with only accepted feedback
7. Optionally re-reviews (up to 3 rounds)

## Development

```bash
npm run dev    # Watch mode
npm test       # Run tests
npm run build  # Build
```

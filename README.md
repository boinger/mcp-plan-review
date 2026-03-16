# mcp-plan-review

MCP server that sends implementation plans to a separate Claude instance for independent architectural review. Returns structured feedback items for human triage (accept/skip).

## Tool

| Name | Description |
|------|-------------|
| `review_plan` | Send a plan to an independent Claude reviewer. Returns JSON with categorized feedback items. |

### Input

| Parameter | Type | Description |
|-----------|------|-------------|
| `plan` | string | The full plan text to review |

### Output

JSON object with:
- `feedback`: Array of `{ category, title, description, suggestion }` items
- `summary`: Human-readable summary string

Categories: `completeness`, `risk`, `edge_case`, `architecture`, `dependency`, `testing`, `error_handling`, `clarity`, `other`

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
claude mcp add --scope user \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e REVIEW_MODEL=claude-sonnet-4-6 \
  mcp-plan-review -- node ~/Projects/mcp-plan-review/build/index.js
```

## Usage

In Claude Code, the tool is available as `review_plan`. The intended workflow:

1. Claude Code calls `review_plan(plan_text)` after drafting a plan
2. Server sends the plan to an independent Claude reviewer
3. Reviewer returns structured feedback items
4. Claude Code presents each item for user triage (accept/skip)
5. Accepted feedback is incorporated into the plan
6. If any feedback was accepted, repeat from step 1
7. Done when reviewer returns no issues or user skips all remaining items

## Development

```bash
npm run dev    # Watch mode
npm test       # Run tests
npm run build  # Build
```

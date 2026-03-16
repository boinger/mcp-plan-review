#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

import { loadConfig } from "./config.js";
import { reviewPlan } from "./reviewer.js";
import type { FeedbackItem } from "./reviewer.js";

const server = new McpServer({
  name: "mcp-plan-review",
  version: "1.0.0",
});

server.registerTool(
  "review_plan",
  {
    title: "Plan Reviewer",
    description:
      "Send an implementation plan to an independent Claude reviewer for architectural feedback. Returns structured feedback items that should be presented to the user for accept/skip triage.",
    inputSchema: {
      plan: z.string().describe("The full plan text to review."),
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  async ({ plan }) => {
    try {
      const config = loadConfig();
      const feedback: FeedbackItem[] = await reviewPlan(plan, config);

      const summary =
        feedback.length === 0
          ? "No issues found — plan looks solid."
          : `Found ${feedback.length} item(s) to review.`;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ feedback, summary }),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-plan-review server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

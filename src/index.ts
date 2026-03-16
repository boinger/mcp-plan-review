#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

import { loadConfig } from "./config.js";
import { reviewPlan } from "./reviewer.js";
import {
  createSession,
  getSession,
  recordDecision,
  deleteSession,
  sweepExpired,
} from "./sessions.js";

const server = new McpServer({
  name: "mcp-plan-review",
  version: "2.0.0",
});

server.registerTool(
  "review_plan",
  {
    title: "Plan Reviewer",
    description:
      "Send an implementation plan to an independent Claude reviewer. Returns a review session with the first feedback item. Use submit_decision to advance through items one at a time.",
    inputSchema: {
      plan: z.string().describe("The full plan text to review."),
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  async ({ plan }) => {
    try {
      sweepExpired();

      const config = loadConfig();
      const feedback = await reviewPlan(plan, config);
      const reviewId = createSession(feedback);

      let result: Record<string, unknown>;

      if (feedback.length === 0) {
        deleteSession(reviewId);
        result = {
          review_id: reviewId,
          total: 0,
          done: true,
          accepted: [],
          skipped: [],
        };
      } else {
        result = {
          review_id: reviewId,
          total: feedback.length,
          current_index: 0,
          item: feedback[0],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
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

server.registerTool(
  "submit_decision",
  {
    title: "Submit Feedback Decision",
    description:
      "Record the user's accept/skip decision for the current feedback item and get the next item. Must be called after review_plan, once per feedback item. Always ask the user before calling — do not decide on their behalf.",
    inputSchema: {
      review_id: z
        .string()
        .describe("The review session ID from review_plan."),
      decision: z
        .enum(["accept", "skip"])
        .describe("The user's decision for the current feedback item."),
    },
  },
  async ({ review_id, decision }) => {
    try {
      const session = getSession(review_id);
      if (!session) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: No review session found for id: ${review_id}. It may have expired or already completed.`,
            },
          ],
          isError: true,
        };
      }

      recordDecision(review_id, decision);

      let result: Record<string, unknown>;

      if (session.currentIndex >= session.feedback.length) {
        // All items decided — build summary and clean up
        const accepted: string[] = [];
        const skipped: string[] = [];
        for (let i = 0; i < session.feedback.length; i++) {
          const title = session.feedback[i].title;
          if (session.decisions[i] === "accept") {
            accepted.push(title);
          } else {
            skipped.push(title);
          }
        }
        deleteSession(review_id);
        result = {
          review_id,
          done: true,
          accepted,
          skipped,
        };
      } else {
        result = {
          review_id,
          current_index: session.currentIndex,
          total: session.feedback.length,
          item: session.feedback[session.currentIndex],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
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

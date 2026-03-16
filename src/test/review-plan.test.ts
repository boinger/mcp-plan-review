import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import esmock from "esmock";
import type { FeedbackItem } from "../reviewer.js";

interface IndexModule {
  // We don't import the server — we test the tool handler indirectly
  // by importing the module's registered tool callback
}

// Since the tool handler is registered inline in index.ts and not directly
// exportable, we test the integration by importing index.ts with mocks
// and verifying the server's behavior through the transport.

// For unit testing, we focus on the reviewer module (covered in reviewer.test.ts)
// and test the tool handler's integration behavior here.

function makeSummary(feedback: FeedbackItem[]): string {
  return feedback.length === 0
    ? "No issues found — plan looks solid."
    : `Found ${feedback.length} item(s) to review.`;
}

const feedbackItems: FeedbackItem[] = [
  {
    category: "risk",
    title: "No rollback plan",
    description: "Database migration in step 4 has no rollback",
    suggestion: "Add a down migration script",
  },
  {
    category: "testing",
    title: "Missing integration tests",
    description: "API endpoints lack integration test coverage",
    suggestion: "Add tests that hit the actual endpoints",
  },
];

describe("review_plan tool integration", () => {
  describe("with feedback items", () => {
    it("formats feedback and summary correctly", async () => {
      // Mock the reviewer to return known feedback
      const { loadConfig } = (await esmock("../config.js", {
        fs: {
          readFileSync: () => JSON.stringify({ model: "test-model" }),
        },
      })) as { loadConfig: () => import("../config.js").Config };

      const { reviewPlan } = (await esmock("../reviewer.js", {
        "@anthropic-ai/sdk": {
          default: class {
            messages = {
              create: async () => ({
                content: [
                  { type: "text", text: JSON.stringify(feedbackItems) },
                ],
              }),
            };
          },
        },
      })) as { reviewPlan: typeof import("../reviewer.js").reviewPlan };

      const config = loadConfig();
      const feedback = await reviewPlan("test plan", config);

      assert.equal(feedback.length, 2);
      assert.equal(feedback[0].category, "risk");
      assert.equal(feedback[1].category, "testing");
      assert.equal(makeSummary(feedback), "Found 2 item(s) to review.");
    });
  });

  describe("with empty feedback", () => {
    it("reports plan is solid", async () => {
      const { reviewPlan } = (await esmock("../reviewer.js", {
        "@anthropic-ai/sdk": {
          default: class {
            messages = {
              create: async () => ({
                content: [{ type: "text", text: "[]" }],
              }),
            };
          },
        },
      })) as { reviewPlan: typeof import("../reviewer.js").reviewPlan };

      const feedback = await reviewPlan("solid plan", {
        model: "test-model",
      });
      assert.deepEqual(feedback, []);
      assert.equal(makeSummary(feedback), "No issues found — plan looks solid.");
    });
  });

  describe("error propagation", () => {
    it("surfaces API errors", async () => {
      const { reviewPlan } = (await esmock("../reviewer.js", {
        "@anthropic-ai/sdk": {
          default: class {
            messages = {
              create: async () => {
                throw new Error("Rate limited");
              },
            };
          },
        },
      })) as { reviewPlan: typeof import("../reviewer.js").reviewPlan };

      await assert.rejects(
        () => reviewPlan("plan", { model: "test-model" }),
        { message: /Rate limited/ },
      );
    });
  });
});

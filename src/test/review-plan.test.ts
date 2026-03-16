import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import esmock from "esmock";
import type { FeedbackItem } from "../reviewer.js";
import { clearAllSessions } from "../sessions.js";

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

describe("review_plan tool (paginated)", () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe("reviewer integration", () => {
    it("returns parsed feedback items from reviewer", async () => {
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

      const feedback = await reviewPlan("test plan", {
        model: "test-model",
      });

      assert.equal(feedback.length, 2);
      assert.equal(feedback[0].category, "risk");
      assert.equal(feedback[0].title, "No rollback plan");
      assert.equal(feedback[1].category, "testing");
    });
  });

  describe("empty feedback", () => {
    it("returns empty array for clean plan", async () => {
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

describe("paginated session flow", () => {
  beforeEach(() => {
    clearAllSessions();
  });

  it("full accept/skip flow returns correct summary", async () => {
    const {
      createSession,
      getSession,
      recordDecision,
      deleteSession,
    } = await import("../sessions.js");

    const reviewId = createSession(feedbackItems);
    const session = getSession(reviewId)!;

    // First item visible
    assert.equal(session.currentIndex, 0);
    assert.equal(session.feedback[0].title, "No rollback plan");

    // User accepts first item
    recordDecision(reviewId, "accept");
    assert.equal(session.currentIndex, 1);
    assert.equal(session.feedback[1].title, "Missing integration tests");

    // User skips second item
    recordDecision(reviewId, "skip");
    assert.equal(session.currentIndex, 2);

    // Build summary (mirrors index.ts logic)
    const accepted: string[] = [];
    const skipped: string[] = [];
    for (let i = 0; i < session.feedback.length; i++) {
      if (session.decisions[i] === "accept") {
        accepted.push(session.feedback[i].title);
      } else {
        skipped.push(session.feedback[i].title);
      }
    }

    assert.deepEqual(accepted, ["No rollback plan"]);
    assert.deepEqual(skipped, ["Missing integration tests"]);

    // Cleanup
    deleteSession(reviewId);
    assert.equal(getSession(reviewId), undefined);
  });

  it("submit_decision on completed session throws", async () => {
    const { createSession, recordDecision } = await import("../sessions.js");

    const reviewId = createSession([feedbackItems[0]]);
    recordDecision(reviewId, "accept");

    assert.throws(
      () => recordDecision(reviewId, "skip"),
      /already been decided/,
    );
  });
});

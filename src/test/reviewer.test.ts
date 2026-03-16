import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import esmock from "esmock";
import type { FeedbackItem } from "../reviewer.js";
import type { Config } from "../config.js";

type ReviewPlanFn = (plan: string, config: Config) => Promise<FeedbackItem[]>;

function makeAnthropicMock(responseText: string) {
  return {
    default: class MockAnthropic {
      messages = {
        create: async () => ({
          content: [{ type: "text", text: responseText }],
        }),
      };
    },
  };
}

function makeFailingAnthropicMock(error: Error) {
  return {
    default: class MockAnthropic {
      messages = {
        create: async () => {
          throw error;
        },
      };
    },
  };
}

const validFeedback: FeedbackItem[] = [
  {
    category: "completeness",
    title: "Missing error handling",
    description: "Step 3 has no error path",
    suggestion: "Add try/catch around the API call",
  },
];

const configWithModel: Config = { model: "claude-sonnet-4-6" };

describe("reviewPlan", () => {
  describe("valid JSON response", () => {
    let reviewPlan: ReviewPlanFn;

    beforeEach(async () => {
      const mod = await esmock("../reviewer.js", {
        "@anthropic-ai/sdk": makeAnthropicMock(JSON.stringify(validFeedback)),
      });
      reviewPlan = mod.reviewPlan;
    });

    it("returns parsed feedback items", async () => {
      const result = await reviewPlan("my plan", configWithModel);
      assert.equal(result.length, 1);
      assert.equal(result[0].category, "completeness");
      assert.equal(result[0].title, "Missing error handling");
    });
  });

  describe("empty array response", () => {
    let reviewPlan: ReviewPlanFn;

    beforeEach(async () => {
      const mod = await esmock("../reviewer.js", {
        "@anthropic-ai/sdk": makeAnthropicMock("[]"),
      });
      reviewPlan = mod.reviewPlan;
    });

    it("returns empty array for clean plan", async () => {
      const result = await reviewPlan("solid plan", configWithModel);
      assert.deepEqual(result, []);
    });
  });

  describe("code fence extraction", () => {
    let reviewPlan: ReviewPlanFn;

    beforeEach(async () => {
      const fenced = "```json\n" + JSON.stringify(validFeedback) + "\n```";
      const mod = await esmock("../reviewer.js", {
        "@anthropic-ai/sdk": makeAnthropicMock(fenced),
      });
      reviewPlan = mod.reviewPlan;
    });

    it("strips markdown code fences before parsing", async () => {
      const result = await reviewPlan("my plan", configWithModel);
      assert.equal(result.length, 1);
      assert.equal(result[0].title, "Missing error handling");
    });
  });

  describe("parse failure", () => {
    let reviewPlan: ReviewPlanFn;

    beforeEach(async () => {
      const mod = await esmock("../reviewer.js", {
        "@anthropic-ai/sdk": makeAnthropicMock(
          "I think your plan is great!",
        ),
      });
      reviewPlan = mod.reviewPlan;
    });

    it("returns error feedback item with raw text", async () => {
      const result = await reviewPlan("my plan", configWithModel);
      assert.equal(result.length, 1);
      assert.equal(result[0].category, "other");
      assert.equal(result[0].title, "Could not parse reviewer response");
      assert.ok(result[0].suggestion.includes("great"));
    });
  });

  describe("non-array JSON", () => {
    let reviewPlan: ReviewPlanFn;

    beforeEach(async () => {
      const mod = await esmock("../reviewer.js", {
        "@anthropic-ai/sdk": makeAnthropicMock('{"not": "an array"}'),
      });
      reviewPlan = mod.reviewPlan;
    });

    it("returns error feedback for non-array response", async () => {
      const result = await reviewPlan("my plan", configWithModel);
      assert.equal(result.length, 1);
      assert.equal(result[0].title, "Unexpected response format");
    });
  });

  describe("missing model", () => {
    let reviewPlan: ReviewPlanFn;

    beforeEach(async () => {
      const mod = await esmock("../reviewer.js", {
        "@anthropic-ai/sdk": makeAnthropicMock("[]"),
      });
      reviewPlan = mod.reviewPlan;
      // Clear env var to ensure no fallback
      delete process.env.REVIEW_MODEL;
    });

    it("throws when no model configured", async () => {
      await assert.rejects(() => reviewPlan("plan", {}), {
        message: /No review model configured/,
      });
    });
  });

  describe("model from env var", () => {
    let reviewPlan: ReviewPlanFn;

    beforeEach(async () => {
      const mod = await esmock("../reviewer.js", {
        "@anthropic-ai/sdk": makeAnthropicMock("[]"),
      });
      reviewPlan = mod.reviewPlan;
      process.env.REVIEW_MODEL = "claude-haiku-4-5-20251001";
    });

    it("uses REVIEW_MODEL env var as fallback", async () => {
      const result = await reviewPlan("plan", {});
      assert.deepEqual(result, []);
      delete process.env.REVIEW_MODEL;
    });
  });

  describe("API errors", () => {
    let reviewPlan: ReviewPlanFn;

    beforeEach(async () => {
      const mod = await esmock("../reviewer.js", {
        "@anthropic-ai/sdk": makeFailingAnthropicMock(
          new Error("401 Unauthorized"),
        ),
      });
      reviewPlan = mod.reviewPlan;
    });

    it("propagates Anthropic SDK errors", async () => {
      await assert.rejects(() => reviewPlan("plan", configWithModel), {
        message: /401 Unauthorized/,
      });
    });
  });
});

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  getSession,
  recordDecision,
  deleteSession,
  sweepExpired,
  clearAllSessions,
} from "../sessions.js";
import type { FeedbackItem } from "../reviewer.js";

const sampleFeedback: FeedbackItem[] = [
  {
    category: "risk",
    title: "No rollback plan",
    description: "Migration has no rollback",
    suggestion: "Add a down migration",
  },
  {
    category: "testing",
    title: "Missing tests",
    description: "No integration tests",
    suggestion: "Add endpoint tests",
  },
  {
    category: "clarity",
    title: "Ambiguous step",
    description: "Step 3 is unclear",
    suggestion: "Clarify the expected output",
  },
];

describe("sessions", () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe("createSession", () => {
    it("returns a valid UUID", () => {
      const id = createSession(sampleFeedback);
      assert.match(
        id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("creates retrievable session", () => {
      const id = createSession(sampleFeedback);
      const session = getSession(id);
      assert.ok(session);
      assert.equal(session.feedback.length, 3);
      assert.equal(session.currentIndex, 0);
    });

    it("initializes all decisions as null", () => {
      const id = createSession(sampleFeedback);
      const session = getSession(id)!;
      assert.equal(session.decisions.length, 3);
      assert.ok(session.decisions.every((d) => d === null));
    });
  });

  describe("getSession", () => {
    it("returns undefined for nonexistent id", () => {
      assert.equal(getSession("nonexistent"), undefined);
    });
  });

  describe("recordDecision", () => {
    it("advances currentIndex", () => {
      const id = createSession(sampleFeedback);
      recordDecision(id, "accept");
      const session = getSession(id)!;
      assert.equal(session.currentIndex, 1);
    });

    it("records accept decision", () => {
      const id = createSession(sampleFeedback);
      recordDecision(id, "accept");
      const session = getSession(id)!;
      assert.equal(session.decisions[0], "accept");
    });

    it("records skip decision", () => {
      const id = createSession(sampleFeedback);
      recordDecision(id, "skip");
      const session = getSession(id)!;
      assert.equal(session.decisions[0], "skip");
    });

    it("tracks multiple decisions in order", () => {
      const id = createSession(sampleFeedback);
      recordDecision(id, "accept");
      recordDecision(id, "skip");
      recordDecision(id, "accept");
      const session = getSession(id)!;
      assert.deepEqual(session.decisions, ["accept", "skip", "accept"]);
      assert.equal(session.currentIndex, 3);
    });

    it("throws for nonexistent session", () => {
      assert.throws(
        () => recordDecision("nonexistent", "accept"),
        /No review session found/,
      );
    });

    it("throws when all items already decided", () => {
      const id = createSession([sampleFeedback[0]]);
      recordDecision(id, "accept");
      assert.throws(
        () => recordDecision(id, "accept"),
        /already been decided/,
      );
    });
  });

  describe("deleteSession", () => {
    it("removes session", () => {
      const id = createSession(sampleFeedback);
      deleteSession(id);
      assert.equal(getSession(id), undefined);
    });

    it("no-ops for nonexistent id", () => {
      assert.doesNotThrow(() => deleteSession("nonexistent"));
    });
  });

  describe("sweepExpired", () => {
    it("removes sessions older than TTL", () => {
      const id = createSession(sampleFeedback);
      const session = getSession(id)!;
      session.createdAt = Date.now() - 60 * 60 * 1000; // 1 hour ago
      sweepExpired();
      assert.equal(getSession(id), undefined);
    });

    it("keeps recent sessions", () => {
      const id = createSession(sampleFeedback);
      sweepExpired();
      assert.ok(getSession(id));
    });

    it("respects custom TTL", () => {
      const id = createSession(sampleFeedback);
      const session = getSession(id)!;
      session.createdAt = Date.now() - 5000; // 5 seconds ago
      sweepExpired(1000); // 1 second TTL
      assert.equal(getSession(id), undefined);
    });
  });
});

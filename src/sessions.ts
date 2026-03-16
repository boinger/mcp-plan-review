import { randomUUID } from "crypto";
import type { FeedbackItem } from "./reviewer.js";

export type Decision = "accept" | "skip";

export interface ReviewSession {
  feedback: FeedbackItem[];
  decisions: (Decision | null)[];
  currentIndex: number;
  createdAt: number;
}

const sessions = new Map<string, ReviewSession>();

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function createSession(feedback: FeedbackItem[]): string {
  const id = randomUUID();
  sessions.set(id, {
    feedback,
    decisions: new Array(feedback.length).fill(null),
    currentIndex: 0,
    createdAt: Date.now(),
  });
  return id;
}

export function getSession(reviewId: string): ReviewSession | undefined {
  return sessions.get(reviewId);
}

export function recordDecision(reviewId: string, decision: Decision): void {
  const session = sessions.get(reviewId);
  if (!session) {
    throw new Error(`No review session found for id: ${reviewId}`);
  }
  if (session.currentIndex >= session.feedback.length) {
    throw new Error("All feedback items have already been decided.");
  }
  session.decisions[session.currentIndex] = decision;
  session.currentIndex++;
}

export function deleteSession(reviewId: string): void {
  sessions.delete(reviewId);
}

export function sweepExpired(ttlMs: number = DEFAULT_TTL_MS): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > ttlMs) {
      sessions.delete(id);
    }
  }
}

export function clearAllSessions(): void {
  sessions.clear();
}

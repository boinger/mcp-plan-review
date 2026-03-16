import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_SYSTEM_PROMPT } from "./prompts.js";
import type { Config } from "./config.js";

export interface FeedbackItem {
  category: string;
  title: string;
  description: string;
  suggestion: string;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/**
 * Strip markdown code fences that Claude sometimes wraps around JSON output.
 * Handles ```json ... ``` and ``` ... ``` variants.
 */
function stripCodeFences(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return fenced ? fenced[1] : text;
}

export async function reviewPlan(
  planText: string,
  config: Config,
): Promise<FeedbackItem[]> {
  const model = config.model ?? process.env.REVIEW_MODEL;
  if (!model) {
    throw new Error(
      "No review model configured. Set REVIEW_MODEL env var or model in ~/.config/mcp-plan-review/config.json",
    );
  }

  const systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const maxTokens = config.maxTokens ?? 4096;

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Review this implementation plan:\n\n${planText}`,
      },
    ],
  });

  // Extract text from response content blocks
  const textParts = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text);
  const rawText = textParts.join("\n").trim();

  // Attempt JSON parse with code fence fallback
  try {
    const parsed = JSON.parse(stripCodeFences(rawText));
    if (!Array.isArray(parsed)) {
      return [
        {
          category: "other",
          title: "Unexpected response format",
          description:
            "The reviewer returned a non-array response. Raw output included below.",
          suggestion: rawText,
        },
      ];
    }
    return parsed as FeedbackItem[];
  } catch {
    // JSON parse failed — return raw text as a single feedback item
    return [
      {
        category: "other",
        title: "Could not parse reviewer response",
        description:
          "The reviewer did not return valid JSON. Raw output included below.",
        suggestion: rawText,
      },
    ];
  }
}

import axios from "axios";
import type { VisibilityResult } from "../types.js";
import { normalizeDomain } from "./crawler.js";

// ---------------------------------------------------------------------------
// AI visibility checker — uses Perplexity (primary) and OpenAI (fallback)
// Perplexity's sonar models do web search and return explicit citations,
// making it ideal for checking whether a domain is surfaced by AI.
// ---------------------------------------------------------------------------

interface PerplexityResponse {
  choices: Array<{
    message: { content: string };
  }>;
  citations?: string[];
}

interface OpenAISearchResponse {
  choices: Array<{
    message: {
      content: string;
      annotations?: Array<{
        type: string;
        url_citation?: { url: string; title?: string };
      }>;
    };
  }>;
}

async function checkViaPerplexity(
  query: string,
  targetDomain: string
): Promise<{ citations: string[]; responseText: string }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");

  const response = await axios.post<PerplexityResponse>(
    "https://api.perplexity.ai/chat/completions",
    {
      model: "sonar",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Answer the user's question concisely and accurately.",
        },
        { role: "user", content: query },
      ],
      max_tokens: 500,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const citations = response.data.citations ?? [];
  const responseText = response.data.choices[0]?.message?.content ?? "";
  return { citations, responseText };
}

async function checkViaOpenAI(
  query: string,
  targetDomain: string
): Promise<{ citations: string[]; responseText: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const response = await axios.post<OpenAISearchResponse>(
    "https://api.openai.com/v1/responses",
    {
      model: "gpt-4o-mini-search-preview",
      tools: [{ type: "web_search_preview" }],
      input: query,
      max_output_tokens: 500,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const message = response.data.choices[0]?.message;
  const responseText = message?.content ?? "";
  const citations: string[] = [];

  for (const annotation of message?.annotations ?? []) {
    if (annotation.type === "url_citation" && annotation.url_citation?.url) {
      citations.push(annotation.url_citation.url);
    }
  }

  return { citations, responseText };
}

function findCitationPosition(
  citations: string[],
  targetDomain: string
): number | null {
  for (let i = 0; i < citations.length; i++) {
    try {
      const citedDomain = normalizeDomain(citations[i]);
      if (
        citedDomain === targetDomain ||
        citedDomain.endsWith(`.${targetDomain}`) ||
        targetDomain.endsWith(`.${citedDomain}`)
      ) {
        return i + 1; // 1-based
      }
    } catch {
      // ignore bad URLs
    }
  }
  return null;
}

function extractCitationContext(
  responseText: string,
  targetDomain: string
): string | null {
  const idx = responseText.toLowerCase().indexOf(targetDomain.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - 100);
  const end = Math.min(responseText.length, idx + 200);
  return responseText.slice(start, end).trim();
}

export async function checkVisibility(
  query: string,
  targetUrl: string
): Promise<VisibilityResult> {
  const targetDomain = normalizeDomain(targetUrl);
  let citations: string[] = [];
  let responseText = "";
  let checkedVia: VisibilityResult["checkedVia"] = "mock";

  // Try Perplexity first, then OpenAI, then mock
  if (process.env.PERPLEXITY_API_KEY) {
    try {
      ({ citations, responseText } = await checkViaPerplexity(
        query,
        targetDomain
      ));
      checkedVia = "perplexity";
    } catch (err) {
      // fall through to OpenAI
    }
  }

  if (checkedVia === "mock" && process.env.OPENAI_API_KEY) {
    try {
      ({ citations, responseText } = await checkViaOpenAI(
        query,
        targetDomain
      ));
      checkedVia = "openai";
    } catch {
      // fall through to mock
    }
  }

  if (checkedVia === "mock") {
    // No API key available — return honest "unknown" state
    return {
      query,
      targetUrl,
      targetDomain,
      isVisible: false,
      citationPosition: null,
      citationContext: null,
      allCitations: [],
      aiResponseSnippet:
        "[Cannot check: no PERPLEXITY_API_KEY or OPENAI_API_KEY configured]",
      checkedVia: "mock",
      checkedAt: new Date().toISOString(),
    };
  }

  const citationPosition = findCitationPosition(citations, targetDomain);
  const isVisible = citationPosition !== null;
  const citationContext = isVisible
    ? extractCitationContext(responseText, targetDomain)
    : null;

  return {
    query,
    targetUrl,
    targetDomain,
    isVisible,
    citationPosition,
    citationContext,
    allCitations: citations,
    aiResponseSnippet: responseText.slice(0, 500),
    checkedVia,
    checkedAt: new Date().toISOString(),
  };
}

// Simple in-memory rate limiter for Perplexity (default 10 RPM)
const rpm = parseInt(process.env.PERPLEXITY_RPM ?? "10");
const windowMs = 60_000;
const callTimestamps: number[] = [];

export async function rateLimitedCheckVisibility(
  query: string,
  targetUrl: string
): Promise<VisibilityResult> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Prune old timestamps
  while (callTimestamps.length > 0 && callTimestamps[0] < windowStart) {
    callTimestamps.shift();
  }

  if (callTimestamps.length >= rpm) {
    const waitMs = callTimestamps[0]! + windowMs - now + 50;
    await new Promise((r) => setTimeout(r, waitMs));
  }

  callTimestamps.push(Date.now());
  return checkVisibility(query, targetUrl);
}

export function formatVisibilityResult(result: VisibilityResult): string {
  const icon = result.isVisible ? "✅" : "❌";
  const lines = [
    `${icon} **"${result.query}"**`,
    `   Visible: ${result.isVisible ? `Yes (position #${result.citationPosition})` : "No"}`,
    `   Checked via: ${result.checkedVia}`,
  ];
  if (result.citationContext) {
    lines.push(`   Context: "${result.citationContext}"`);
  }
  if (result.allCitations.length > 0) {
    lines.push(`   All citations: ${result.allCitations.slice(0, 5).join(", ")}`);
  }
  return lines.join("\n");
}

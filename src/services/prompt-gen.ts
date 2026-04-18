import type { CrawledPage } from "../types.js";

// ---------------------------------------------------------------------------
// Generates AEO test prompts based on website content.
// These mimic how real users phrase questions to AI assistants.
// ---------------------------------------------------------------------------

// High-intent question templates used by real AI users
const QUESTION_TEMPLATES = [
  "What is the best {topic}?",
  "How do I {topic}?",
  "What are the best tools for {topic}?",
  "How does {topic} work?",
  "What are the benefits of {topic}?",
  "What is {topic} and why does it matter?",
  "Best {topic} platforms in {year}",
  "How to get started with {topic}?",
  "What should I know about {topic}?",
  "Compare {topic} options",
  "Is {topic} worth it?",
  "Top {topic} strategies",
  "{topic} tips and best practices",
  "What problems does {topic} solve?",
  "Who uses {topic}?",
];

const YEAR = new Date().getFullYear().toString();

function extractTopics(pages: CrawledPage[]): string[] {
  const topics = new Set<string>();

  for (const page of pages.slice(0, 5)) {
    // H1 and H2 headings are the best topic signals
    for (const h of [...page.h1, ...page.h2].slice(0, 10)) {
      // Clean and shorten heading
      const cleaned = h
        .replace(/[^a-z0-9\s-]/gi, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (cleaned.length > 5 && cleaned.length < 60) {
        topics.add(cleaned);
      }
    }

    // FAQ questions are direct prompts
    for (const faq of page.faqItems.slice(0, 5)) {
      const q = faq.question.trim();
      if (q.length > 10 && q.length < 100) {
        topics.add(q.toLowerCase().replace(/\?$/, ""));
      }
    }

    // Title words
    if (page.title) {
      const titleWords = page.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (titleWords.length > 5) topics.add(titleWords);
    }
  }

  return [...topics].slice(0, 20);
}

function applyTemplate(template: string, topic: string): string {
  return template
    .replace("{topic}", topic)
    .replace("{year}", YEAR);
}

export function generateTestPrompts(
  pages: CrawledPage[],
  extraTopics: string[] = [],
  maxPrompts = 20
): string[] {
  const topics = [...extractTopics(pages), ...extraTopics];
  const prompts: string[] = [];

  // Use FAQ questions directly as prompts (highest quality)
  for (const page of pages.slice(0, 3)) {
    for (const faq of page.faqItems.slice(0, 3)) {
      const q = faq.question.trim();
      if (q.length > 10) prompts.push(q.endsWith("?") ? q : `${q}?`);
    }
  }

  // Generate from templates
  for (const topic of topics.slice(0, 8)) {
    const template =
      QUESTION_TEMPLATES[Math.floor(Math.random() * QUESTION_TEMPLATES.length)];
    prompts.push(applyTemplate(template, topic));
  }

  // Add brand-specific queries
  const domain = pages[0]
    ? new URL(pages[0].url).hostname.replace(/^www\./, "").replace(/\.[^.]+$/, "")
    : null;
  if (domain) {
    prompts.push(`What is ${domain}?`);
    prompts.push(`How does ${domain} work?`);
    prompts.push(`Is ${domain} legit?`);
  }

  // Deduplicate and cap
  const seen = new Set<string>();
  return prompts
    .filter((p) => {
      const key = p.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return p.length >= 10;
    })
    .slice(0, maxPrompts);
}

export function generateIndustryPrompts(industry: string): string[] {
  return QUESTION_TEMPLATES.map((t) =>
    applyTemplate(t, industry)
  );
}

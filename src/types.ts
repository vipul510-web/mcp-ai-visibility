// ---------------------------------------------------------------------------
// Shared types for AEO Visibility MCP
// ---------------------------------------------------------------------------

export interface AEOSignal {
  name: string;
  score: number;       // achieved score
  maxScore: number;    // maximum possible score
  passed: boolean;
  details: string;
  recommendation?: string;
}

export interface CrawledPageSummary {
  url: string;
  wordCount: number;
  schemaTypes: string[];
  hasAuthor: boolean;
  hasFAQ: boolean;
}

export interface AEOAnalysis {
  url: string;
  overallScore: number;   // 0–100
  grade: "A" | "B" | "C" | "D" | "F";
  signals: AEOSignal[];
  topRecommendations: string[];
  crawledPages: CrawledPageSummary[];
  analyzedAt: string;     // ISO timestamp
}

export interface CrawledPage {
  url: string;
  title: string;
  description: string;
  h1: string[];
  h2: string[];
  h3: string[];
  bodyText: string;       // cleaned text content
  wordCount: number;
  hasStructuredData: boolean;
  structuredDataTypes: string[];
  hasFAQ: boolean;
  faqItems: Array<{ question: string; answer: string }>;
  authorInfo: string | null;
  externalLinks: string[];
  internalLinks: string[];
  ogTags: Record<string, string>;
  canonical: string | null;
  statusCode: number;
  loadedAt: string;
}

export interface VisibilityResult {
  query: string;
  targetUrl: string;
  targetDomain: string;
  isVisible: boolean;
  citationPosition: number | null;   // 1-based index in citations list
  citationContext: string | null;    // snippet around the mention
  allCitations: string[];            // all URLs cited in the AI response
  aiResponseSnippet: string;        // first 500 chars of AI response
  checkedVia: "perplexity" | "openai" | "mock";
  checkedAt: string;
}

export interface PromptRanking {
  prompt: string;
  isVisible: boolean;
  citationPosition: number | null;
  aiResponseSnippet: string;
  allCitations: string[];
}

export interface VisibilityReport {
  url: string;
  domain: string;
  totalPromptsTested: number;
  visibleCount: number;
  visibilityRate: number;            // 0–1
  rankings: PromptRanking[];
  topPerformingPrompts: string[];
  missedOpportunityPrompts: string[];
  generatedAt: string;
}

export interface CompetitorComparison {
  query: string;
  results: Array<{
    url: string;
    domain: string;
    isVisible: boolean;
    citationPosition: number | null;
  }>;
}

export interface CompetitorReport {
  yourUrl: string;
  competitorUrls: string[];
  queries: string[];
  comparisons: CompetitorComparison[];
  yourVisibilityRate: number;
  summary: string;
  generatedAt: string;
}

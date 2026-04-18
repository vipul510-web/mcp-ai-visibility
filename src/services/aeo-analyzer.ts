import type { CrawledPage, AEOSignal, AEOAnalysis } from "../types.js";

// ---------------------------------------------------------------------------
// AEO scoring: 100-point rubric based on signals LLMs use to surface content
// ---------------------------------------------------------------------------

function scoreStructuredData(pages: CrawledPage[]): AEOSignal {
  const pagesWithSchema = pages.filter((p) => p.hasStructuredData).length;
  const highValueTypes = [
    "FAQPage",
    "Article",
    "BlogPosting",
    "HowTo",
    "QAPage",
    "Product",
    "Organization",
    "WebSite",
    "BreadcrumbList",
  ];

  const allTypes = pages.flatMap((p) => p.structuredDataTypes);
  const hasHighValue = allTypes.some((t) => highValueTypes.includes(t));
  const hasFAQSchema = allTypes.includes("FAQPage");
  const hasOrg = allTypes.includes("Organization");

  let score = 0;
  if (pagesWithSchema > 0) score += 8;
  if (hasHighValue) score += 7;
  if (hasFAQSchema) score += 3;
  if (hasOrg) score += 2;

  const details =
    pagesWithSchema === 0
      ? "No structured data (JSON-LD) found. AI assistants rely heavily on schema.org markup."
      : `Found schema types: ${[...new Set(allTypes)].join(", ")}`;

  return {
    name: "Structured Data (JSON-LD / schema.org)",
    score,
    maxScore: 20,
    passed: score >= 10,
    details,
    recommendation:
      score < 10
        ? "Add FAQPage, Article, and Organization JSON-LD schemas. FAQPage schema directly feeds AI answer boxes."
        : undefined,
  };
}

function scoreFAQContent(pages: CrawledPage[]): AEOSignal {
  const pagesWithFAQ = pages.filter((p) => p.hasFAQ).length;
  const totalFAQItems = pages.reduce((n, p) => n + p.faqItems.length, 0);

  let score = 0;
  if (pagesWithFAQ > 0) score += 7;
  if (totalFAQItems >= 5) score += 4;
  if (totalFAQItems >= 10) score += 4;

  return {
    name: "FAQ & Q&A Content",
    score,
    maxScore: 15,
    passed: score >= 8,
    details:
      totalFAQItems === 0
        ? "No FAQ content detected. AI models prefer to cite pages that directly answer questions."
        : `Found ${totalFAQItems} FAQ items across ${pagesWithFAQ} pages.`,
    recommendation:
      score < 8
        ? "Create dedicated FAQ pages answering common questions in your niche. Use natural question phrasing that matches how people prompt AI."
        : undefined,
  };
}

function scoreContentClarity(pages: CrawledPage[]): AEOSignal {
  const mainPages = pages.slice(0, 5);
  let score = 0;

  const avgWordCount =
    mainPages.reduce((n, p) => n + p.wordCount, 0) / (mainPages.length || 1);
  const hasGoodHeadings = mainPages.some(
    (p) => p.h2.length >= 3 && p.h1.length >= 1
  );
  const hasDescriptions = mainPages.filter((p) => p.description.length > 50)
    .length;

  if (avgWordCount >= 500) score += 4;
  if (avgWordCount >= 1000) score += 3;
  if (hasGoodHeadings) score += 4;
  if (hasDescriptions >= 2) score += 4;

  return {
    name: "Content Clarity & Structure",
    score,
    maxScore: 15,
    passed: score >= 9,
    details: `Avg word count: ${Math.round(avgWordCount)}. Heading structure: ${hasGoodHeadings ? "good" : "needs improvement"}. Meta descriptions: ${hasDescriptions}/${mainPages.length} pages.`,
    recommendation:
      score < 9
        ? "Write comprehensive, well-structured content (1000+ words for key pages). Use H2/H3 headings to break up topics. Add descriptive meta descriptions."
        : undefined,
  };
}

function scoreEEAT(pages: CrawledPage[]): AEOSignal {
  let score = 0;

  const hasAuthor = pages.some((p) => p.authorInfo !== null);
  const hasAboutPage = pages.some((p) =>
    /\/about/i.test(p.url)
  );
  const hasContactPage = pages.some((p) =>
    /\/contact/i.test(p.url)
  );
  const hasOrgSchema = pages.some((p) =>
    p.structuredDataTypes.includes("Organization")
  );
  const hasPersonSchema = pages.some((p) =>
    p.structuredDataTypes.includes("Person")
  );

  if (hasAuthor) score += 4;
  if (hasAboutPage) score += 3;
  if (hasContactPage) score += 2;
  if (hasOrgSchema || hasPersonSchema) score += 3;
  if (hasAboutPage && hasAuthor) score += 3;

  return {
    name: "E-E-A-T Signals (Expertise, Authority, Trust)",
    score,
    maxScore: 15,
    passed: score >= 8,
    details: [
      `Author info: ${hasAuthor ? "found" : "missing"}`,
      `About page: ${hasAboutPage ? "found" : "missing"}`,
      `Contact page: ${hasContactPage ? "found" : "missing"}`,
      `Organization schema: ${hasOrgSchema ? "yes" : "no"}`,
    ].join(". "),
    recommendation:
      score < 8
        ? "Add author bios with credentials, an About page explaining your expertise, and Organization JSON-LD schema. AI models heavily weight authoritativeness."
        : undefined,
  };
}

function scoreCitations(pages: CrawledPage[]): AEOSignal {
  const totalExternal = pages.reduce(
    (n, p) => n + p.externalLinks.length,
    0
  );
  const avgExternal = totalExternal / (pages.length || 1);
  const hasAuthoritativeSources = pages.some((p) =>
    p.externalLinks.some((l) =>
      /wikipedia|gov|edu|pubmed|scholar|nature|science/i.test(l)
    )
  );

  let score = 0;
  if (avgExternal >= 2) score += 3;
  if (avgExternal >= 5) score += 3;
  if (hasAuthoritativeSources) score += 4;

  return {
    name: "Citations & External References",
    score,
    maxScore: 10,
    passed: score >= 6,
    details: `Average ${avgExternal.toFixed(1)} external links per page. Authoritative sources: ${hasAuthoritativeSources ? "yes" : "no"}.`,
    recommendation:
      score < 6
        ? "Link to authoritative sources (research papers, gov sites, Wikipedia) to signal credibility to AI systems."
        : undefined,
  };
}

function scoreContentDepth(pages: CrawledPage[]): AEOSignal {
  const deepPages = pages.filter((p) => p.wordCount >= 800).length;
  const hasLongform = pages.some((p) => p.wordCount >= 2000);
  const topicCoverage = new Set(pages.flatMap((p) => p.h2)).size;

  let score = 0;
  if (deepPages >= 2) score += 3;
  if (deepPages >= 5) score += 2;
  if (hasLongform) score += 3;
  if (topicCoverage >= 10) score += 2;

  return {
    name: "Content Depth & Topic Coverage",
    score,
    maxScore: 10,
    passed: score >= 6,
    details: `${deepPages} pages with 800+ words. ${hasLongform ? "Has" : "No"} longform content (2000+ words). ~${topicCoverage} unique H2 topics covered.`,
    recommendation:
      score < 6
        ? "Create comprehensive, in-depth content that fully covers topics. AI models prefer citing authoritative, thorough sources."
        : undefined,
  };
}

function scoreMetaInformation(pages: CrawledPage[]): AEOSignal {
  const hasTitle = pages.filter((p) => p.title.length > 10).length;
  const hasDescription = pages.filter((p) => p.description.length > 50).length;
  const hasOGTags = pages.filter(
    (p) => Object.keys(p.ogTags).length >= 2
  ).length;
  const hasCanonical = pages.filter((p) => p.canonical !== null).length;

  const pct = pages.length ? 1 / pages.length : 0;
  let score = 0;
  if (hasTitle / pages.length >= 0.8) score += 3;
  if (hasDescription / pages.length >= 0.6) score += 3;
  if (hasOGTags / pages.length >= 0.5) score += 2;
  if (hasCanonical / pages.length >= 0.5) score += 2;

  return {
    name: "Meta Information & OG Tags",
    score,
    maxScore: 10,
    passed: score >= 6,
    details: `Title tags: ${hasTitle}/${pages.length}. Meta descriptions: ${hasDescription}/${pages.length}. OG tags: ${hasOGTags}/${pages.length}. Canonicals: ${hasCanonical}/${pages.length}.`,
    recommendation:
      score < 6
        ? "Add descriptive title tags and meta descriptions to all pages. These help AI understand page topics."
        : undefined,
  };
}

function scoreInternalLinking(pages: CrawledPage[]): AEOSignal {
  const avgInternal =
    pages.reduce((n, p) => n + p.internalLinks.length, 0) / (pages.length || 1);
  const hasDeepLinking = pages.some((p) => p.internalLinks.length >= 5);

  let score = 0;
  if (avgInternal >= 3) score += 2;
  if (avgInternal >= 8) score += 2;
  if (hasDeepLinking) score += 1;

  return {
    name: "Internal Linking Structure",
    score,
    maxScore: 5,
    passed: score >= 3,
    details: `Average ${avgInternal.toFixed(1)} internal links per page.`,
    recommendation:
      score < 3
        ? "Improve internal linking to help AI crawlers understand site structure and topic clusters."
        : undefined,
  };
}

function calculateGrade(score: number): AEOAnalysis["grade"] {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

export function analyzeAEO(pages: CrawledPage[], rootUrl: string): AEOAnalysis {
  const signals: AEOSignal[] = [
    scoreStructuredData(pages),
    scoreFAQContent(pages),
    scoreContentClarity(pages),
    scoreEEAT(pages),
    scoreCitations(pages),
    scoreContentDepth(pages),
    scoreMetaInformation(pages),
    scoreInternalLinking(pages),
  ];

  const overallScore = Math.round(
    signals.reduce((n, s) => n + s.score, 0)
  );

  const topRecommendations = signals
    .filter((s) => s.recommendation)
    .sort((a, b) => (b.maxScore - b.score) - (a.maxScore - a.score))
    .slice(0, 5)
    .map((s) => s.recommendation!);

  return {
    url: rootUrl,
    overallScore,
    grade: calculateGrade(overallScore),
    signals,
    topRecommendations,
    analyzedAt: new Date().toISOString(),
  };
}

export function formatAEOReport(analysis: AEOAnalysis): string {
  const lines: string[] = [
    `# AEO Analysis Report: ${analysis.url}`,
    `**Overall Score: ${analysis.overallScore}/100 (Grade: ${analysis.grade})**`,
    `Analyzed at: ${analysis.analyzedAt}`,
    "",
    "## Signal Breakdown",
    "",
  ];

  for (const signal of analysis.signals) {
    const bar = "█".repeat(Math.round((signal.score / signal.maxScore) * 10));
    const empty = "░".repeat(10 - bar.length);
    lines.push(
      `### ${signal.passed ? "✅" : "❌"} ${signal.name}: ${signal.score}/${signal.maxScore}`
    );
    lines.push(`\`${bar}${empty}\` ${signal.details}`);
    if (signal.recommendation) {
      lines.push(`> 💡 **Fix:** ${signal.recommendation}`);
    }
    lines.push("");
  }

  if (analysis.topRecommendations.length > 0) {
    lines.push("## Top Recommendations (by impact)");
    lines.push("");
    analysis.topRecommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
  }

  return lines.join("\n");
}

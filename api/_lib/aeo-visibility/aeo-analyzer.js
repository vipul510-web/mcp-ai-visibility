/**
 * AEO scoring (0–100) from crawled pages — ported from mcp-ai-visibility.
 */

function scoreStructuredData(pages) {
    const pagesWithSchema = pages.filter((p) => p.hasStructuredData).length;
    const highValueTypes = [
        'FAQPage',
        'Article',
        'BlogPosting',
        'HowTo',
        'QAPage',
        'Product',
        'Organization',
        'WebSite',
        'BreadcrumbList',
    ];

    const allTypes = pages.flatMap((p) => p.structuredDataTypes);
    const hasHighValue = allTypes.some((t) => highValueTypes.includes(t));
    const hasFAQSchema = allTypes.includes('FAQPage');
    const hasOrg = allTypes.includes('Organization');

    let score = 0;
    if (pagesWithSchema > 0) score += 8;
    if (hasHighValue) score += 7;
    if (hasFAQSchema) score += 3;
    if (hasOrg) score += 2;

    const details =
        pagesWithSchema === 0
            ? 'No structured data (JSON-LD) found. AI assistants rely heavily on schema.org markup.'
            : `Found schema types: ${[...new Set(allTypes)].join(', ')}`;

    return {
        name: 'Structured Data (JSON-LD / schema.org)',
        score,
        maxScore: 20,
        passed: score >= 10,
        details,
        recommendation:
            score < 10
                ? 'Add FAQPage, Article, and Organization JSON-LD schemas. FAQPage schema directly feeds AI answer boxes.'
                : undefined,
    };
}

function scoreFAQContent(pages) {
    const pagesWithFAQ = pages.filter((p) => p.hasFAQ).length;
    const totalFAQItems = pages.reduce((n, p) => n + p.faqItems.length, 0);

    let score = 0;
    if (pagesWithFAQ > 0) score += 7;
    if (totalFAQItems >= 5) score += 4;
    if (totalFAQItems >= 10) score += 4;

    return {
        name: 'FAQ & Q&A Content',
        score,
        maxScore: 15,
        passed: score >= 8,
        details:
            totalFAQItems === 0
                ? 'No FAQ content detected. AI models prefer to cite pages that directly answer questions.'
                : `Found ${totalFAQItems} FAQ items across ${pagesWithFAQ} pages.`,
        recommendation:
            score < 8
                ? 'Create dedicated FAQ pages answering common questions in your niche. Use natural question phrasing that matches how people prompt AI.'
                : undefined,
    };
}

function scoreContentClarity(pages) {
    const mainPages = pages.slice(0, 5);
    let score = 0;

    const avgWordCount =
        mainPages.reduce((n, p) => n + p.wordCount, 0) / (mainPages.length || 1);
    const hasGoodHeadings = mainPages.some((p) => p.h2.length >= 3 && p.h1.length >= 1);
    const hasDescriptions = mainPages.filter((p) => p.description.length > 50).length;

    if (avgWordCount >= 500) score += 4;
    if (avgWordCount >= 1000) score += 3;
    if (hasGoodHeadings) score += 4;
    if (hasDescriptions >= 2) score += 4;

    return {
        name: 'Content Clarity & Structure',
        score,
        maxScore: 15,
        passed: score >= 9,
        details: `Avg word count: ${Math.round(avgWordCount)}. Heading structure: ${hasGoodHeadings ? 'good' : 'needs improvement'}. Meta descriptions: ${hasDescriptions}/${mainPages.length} pages.`,
        recommendation:
            score < 9
                ? 'Write comprehensive, well-structured content (1000+ words for key pages). Use H2/H3 headings to break up topics. Add descriptive meta descriptions.'
                : undefined,
    };
}

function getAllKnownUrls(pages) {
    return [
        ...pages.map((p) => p.url),
        ...pages.flatMap((p) => p.internalLinks),
        ...(pages[0]?.sitemapUrls ?? []),
    ];
}

function pageStatus(pages, regex) {
    if (pages.some((p) => regex.test(p.url))) return 'crawled ✓';
    if (pages.some((p) => p.internalLinks.some((l) => regex.test(l)))) return 'linked from site ✓';
    if ((pages[0]?.sitemapUrls ?? []).some((u) => regex.test(u))) return 'in sitemap ✓';
    return 'not found';
}

function scoreEEAT(pages) {
    let score = 0;

    const allKnownUrls = getAllKnownUrls(pages);

    const hasAuthor = pages.some((p) => p.authorInfo !== null);
    const hasAboutPage = allKnownUrls.some((u) => /\/about/i.test(u));
    const hasContactPage = allKnownUrls.some((u) => /\/contact/i.test(u));
    const hasOrgSchema = pages.some(
        (p) => p.structuredDataTypes.includes('Organization') || p.structuredDataTypes.includes('LocalBusiness'),
    );
    const hasPersonSchema = pages.some((p) => p.structuredDataTypes.includes('Person'));

    if (hasAuthor) score += 4;
    if (hasAboutPage) score += 3;
    if (hasContactPage) score += 2;
    if (hasOrgSchema || hasPersonSchema) score += 3;
    if (hasAboutPage && hasAuthor) score += 3;

    return {
        name: 'E-E-A-T Signals (Expertise, Authority, Trust)',
        score,
        maxScore: 15,
        passed: score >= 8,
        details: [
            `Author info: ${hasAuthor ? 'found ✓' : 'missing'}`,
            `About page: ${pageStatus(pages, /\/about/i)}`,
            `Contact page: ${pageStatus(pages, /\/contact/i)}`,
            `Organization/LocalBusiness schema: ${hasOrgSchema ? 'yes ✓' : 'no'}`,
        ].join('. '),
        recommendation:
            score < 8
                ? 'Add author bios with credentials, an About page explaining your expertise, and Organization JSON-LD schema. AI models heavily weight authoritativeness.'
                : undefined,
    };
}

function detectSPA(pages) {
    if (!pages.length) return null;
    const main = pages[0];
    const wordCount = main.wordCount ?? 0;
    const linkCount = main.internalLinks?.length ?? 0;
    const hasSitemap = (main.sitemapUrls?.length ?? 0) > 0;

    // Empty or near-empty initial render + few/no anchor tags = client-rendered.
    if (wordCount < 100 && linkCount < 3) {
        return {
            isSpa: true,
            wordCount,
            linkCount,
            hasSitemap,
        };
    }
    return { isSpa: false, wordCount, linkCount, hasSitemap };
}

function scoreCitations(pages) {
    const totalExternal = pages.reduce((n, p) => n + p.externalLinks.length, 0);
    const avgExternal = totalExternal / (pages.length || 1);
    const hasAuthoritativeSources = pages.some((p) =>
        p.externalLinks.some((l) => /wikipedia|gov|edu|pubmed|scholar|nature|science/i.test(l)),
    );

    let score = 0;
    if (avgExternal >= 2) score += 3;
    if (avgExternal >= 5) score += 3;
    if (hasAuthoritativeSources) score += 4;

    return {
        name: 'Citations & External References',
        score,
        maxScore: 10,
        passed: score >= 6,
        details: `Average ${avgExternal.toFixed(1)} external links per page. Authoritative sources: ${hasAuthoritativeSources ? 'yes' : 'no'}.`,
        recommendation:
            score < 6
                ? 'Link to authoritative sources (research papers, gov sites, Wikipedia) to signal credibility to AI systems.'
                : undefined,
    };
}

function scoreContentDepth(pages) {
    const deepPages = pages.filter((p) => p.wordCount >= 800).length;
    const hasLongform = pages.some((p) => p.wordCount >= 2000);
    const topicCoverage = new Set(pages.flatMap((p) => p.h2)).size;

    let score = 0;
    if (deepPages >= 2) score += 3;
    if (deepPages >= 5) score += 2;
    if (hasLongform) score += 3;
    if (topicCoverage >= 10) score += 2;

    return {
        name: 'Content Depth & Topic Coverage',
        score,
        maxScore: 10,
        passed: score >= 6,
        details: `${deepPages} pages with 800+ words. ${hasLongform ? 'Has' : 'No'} longform content (2000+ words). ~${topicCoverage} unique H2 topics covered.`,
        recommendation:
            score < 6
                ? 'Create comprehensive, in-depth content that fully covers topics. AI models prefer citing authoritative, thorough sources.'
                : undefined,
    };
}

function scoreMetaInformation(pages) {
    const hasTitle = pages.filter((p) => p.title.length > 10).length;
    const hasDescription = pages.filter((p) => p.description.length > 50).length;
    const hasOGTags = pages.filter((p) => Object.keys(p.ogTags).length >= 2).length;
    const hasCanonical = pages.filter((p) => p.canonical !== null).length;

    let score = 0;
    if (hasTitle / pages.length >= 0.8) score += 3;
    if (hasDescription / pages.length >= 0.6) score += 3;
    if (hasOGTags / pages.length >= 0.5) score += 2;
    if (hasCanonical / pages.length >= 0.5) score += 2;

    return {
        name: 'Meta Information & OG Tags',
        score,
        maxScore: 10,
        passed: score >= 6,
        details: `Title tags: ${hasTitle}/${pages.length}. Meta descriptions: ${hasDescription}/${pages.length}. OG tags: ${hasOGTags}/${pages.length}. Canonicals: ${hasCanonical}/${pages.length}.`,
        recommendation:
            score < 6
                ? 'Add descriptive title tags and meta descriptions to all pages. These help AI understand page topics.'
                : undefined,
    };
}

function scoreInternalLinking(pages) {
    const avgInternal =
        pages.reduce((n, p) => n + p.internalLinks.length, 0) / (pages.length || 1);
    const hasDeepLinking = pages.some((p) => p.internalLinks.length >= 5);

    let score = 0;
    if (avgInternal >= 3) score += 2;
    if (avgInternal >= 8) score += 2;
    if (hasDeepLinking) score += 1;

    return {
        name: 'Internal Linking Structure',
        score,
        maxScore: 5,
        passed: score >= 3,
        details: `Average ${avgInternal.toFixed(1)} internal links per page.`,
        recommendation:
            score < 3
                ? 'Improve internal linking to help AI crawlers understand site structure and topic clusters.'
                : undefined,
    };
}

function calculateGrade(score) {
    if (score >= 80) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 35) return 'D';
    return 'F';
}

export function analyzeAEO(pages, rootUrl) {
    const signals = [
        scoreStructuredData(pages),
        scoreFAQContent(pages),
        scoreContentClarity(pages),
        scoreEEAT(pages),
        scoreCitations(pages),
        scoreContentDepth(pages),
        scoreMetaInformation(pages),
        scoreInternalLinking(pages),
    ];

    const overallScore = Math.round(signals.reduce((n, s) => n + s.score, 0));

    const topRecommendations = signals
        .filter((s) => s.recommendation)
        .sort((a, b) => (b.maxScore - b.score) - (a.maxScore - a.score))
        .slice(0, 5)
        .map((s) => s.recommendation);

    const spaDetection = detectSPA(pages);
    const sitemapUrls = pages[0]?.sitemapUrls ?? [];

    return {
        url: rootUrl,
        overallScore,
        grade: calculateGrade(overallScore),
        signals,
        topRecommendations,
        crawledPages: pages.map((p) => ({
            url: p.url,
            wordCount: p.wordCount,
            schemaTypes: p.structuredDataTypes,
            hasAuthor: p.authorInfo !== null,
            hasFAQ: p.faqItems.length > 0,
        })),
        sitemapUrls: sitemapUrls.slice(0, 25),
        sitemapCount: sitemapUrls.length,
        spaDetection,
        analyzedAt: new Date().toISOString(),
    };
}

export function formatAEOReport(analysis) {
    const lines = [
        `# AEO Analysis Report: ${analysis.url}`,
        `**Overall Score: ${analysis.overallScore}/100 (Grade: ${analysis.grade})**`,
        `Analyzed at: ${analysis.analyzedAt}`,
        '',
    ];

    if (analysis.spaDetection?.isSpa) {
        lines.push('## ⚠️ Client-side rendered site detected');
        lines.push('');
        lines.push(
            `The homepage returned only **${analysis.spaDetection.wordCount} words** of body text and ` +
            `**${analysis.spaDetection.linkCount} internal links** in its initial HTML. ` +
            `This site appears to use JavaScript rendering (React/Vue/Next.js SPA). ` +
            `Our crawler reads the raw HTML — it does not execute JavaScript, and **neither do most AI crawlers** ` +
            `(ChatGPT browsing, Perplexity, Anthropic, GoogleBot for AI Overviews often work from the same raw HTML).`,
        );
        lines.push('');
        if (analysis.spaDetection.hasSitemap) {
            lines.push(
                `✅ **Good news:** your sitemap was found (${analysis.sitemapCount} URLs). ` +
                `We used those URLs for existence checks (About / Contact / etc.) below — so those signals are accurate.`,
            );
        } else {
            lines.push(
                `❌ **No sitemap found** at \`/sitemap.xml\`. AI crawlers and our analyzer cannot discover your pages. ` +
                `**Top priority fix:** add a sitemap.xml and pre-render at least your key landing pages (Next.js \`getStaticProps\`, ISR, or full SSR).`,
            );
        }
        lines.push('');
        lines.push('**Recommendations specifically for SPA sites:**');
        lines.push('- Pre-render or SSR all marketing/landing pages (about, contact, pricing, blog, key features).');
        lines.push('- Ensure raw HTML contains the page\'s main heading, body copy, and `<a href>` navigation links.');
        lines.push('- Add Organization, WebSite, and FAQPage JSON-LD inline in HTML, not injected via JS.');
        lines.push('- Test your pages in [view-source:](view-source:) — if the body looks empty, AI crawlers see the same.');
        lines.push('');
    }

    if (analysis.crawledPages?.length) {
        lines.push(`## Pages crawled (${analysis.crawledPages.length})`);
        lines.push('');
        for (const p of analysis.crawledPages) {
            const badges = [];
            if (p.schemaTypes.length) badges.push(`schema: ${p.schemaTypes.join(', ')}`);
            if (p.hasAuthor) badges.push('author ✓');
            if (p.hasFAQ) badges.push('FAQ ✓');
            lines.push(`- \`${p.url}\` — ${p.wordCount} words${badges.length ? ' | ' + badges.join(' | ') : ''}`);
        }
        lines.push('');
    }

    if (analysis.sitemapCount > 0) {
        lines.push(`## URLs discovered from sitemap (${analysis.sitemapCount})`);
        lines.push('');
        for (const u of analysis.sitemapUrls) {
            lines.push(`- \`${u}\``);
        }
        if (analysis.sitemapCount > analysis.sitemapUrls.length) {
            lines.push(`- … and ${analysis.sitemapCount - analysis.sitemapUrls.length} more`);
        }
        lines.push('');
        lines.push('> **Note for Claude:** Existence checks (About / Contact / etc.) below use BOTH crawled pages AND these sitemap URLs. If a signal is still flagged as missing, the page genuinely is not in the sitemap or is named non-conventionally.');
        lines.push('');
    } else if (analysis.crawledPages?.length) {
        lines.push('> **Note for Claude:** Recommendations below are based only on the crawled pages and any internal links found. If a signal seems wrong, the user can re-run with a higher `max_pages` value, or check if their site has a `/sitemap.xml`.');
        lines.push('');
    }

    lines.push('## Signal Breakdown', '');

    for (const signal of analysis.signals) {
        const bar = '█'.repeat(Math.round((signal.score / signal.maxScore) * 10));
        const empty = '░'.repeat(10 - bar.length);
        lines.push(`### ${signal.passed ? '✅' : '❌'} ${signal.name}: ${signal.score}/${signal.maxScore}`);
        lines.push(`\`${bar}${empty}\` ${signal.details}`);
        if (signal.recommendation) {
            lines.push(`> **Fix:** ${signal.recommendation}`);
        }
        lines.push('');
    }

    if (analysis.topRecommendations.length > 0) {
        lines.push('## Top Recommendations (by impact)');
        lines.push('');
        analysis.topRecommendations.forEach((rec, i) => {
            lines.push(`${i + 1}. ${rec}`);
        });
    }

    return lines.join('\n');
}

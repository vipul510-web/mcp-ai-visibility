/**
 * Generate test prompts for AI visibility — always from the BUYER's perspective.
 *
 * Core principle: prompts must reflect how a potential customer with a PROBLEM
 * searches for a solution, not how someone who already knows the brand searches.
 * Brand-name prompts ("acme pricing", "is acme legit?") are search-monitoring
 * queries — useless for discovery visibility testing.
 */

// Category A — Discovery: buyer knows the category, is choosing a solution.
const DISCOVERY_TEMPLATES = [
    'best {topic} {year}',
    'best {topic} for {audience}',
    'top {topic} tools {year}',
    '{topic} tool for {audience}',
    '{topic} software {year}',
    '{topic} alternatives',
    '{topic} vs {competitor}',
    '{topic} for small business',
    '{topic} in {geo}',
];

// Category B — Problem-first: buyer knows the pain, not yet the category.
const PROBLEM_TEMPLATES = [
    'how to {topic}',
    'how do I {topic}',
    'how to check {topic}',
    'how to improve {topic}',
    'best way to {topic}',
    '{topic} guide {year}',
    '{topic} tutorial',
    'is {topic} important',
    '{topic} tips for {audience}',
];

const YEAR = new Date().getFullYear().toString();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripLeadingPhrases(s) {
    return s
        .replace(/^(what is|what are|why|how|how to|do i need to|is|compare|best)\s+/i, '')
        .replace(/\s*\?$/, '')
        .trim();
}

// Reject topics that are clearly brand/marketing noise rather than category terms.
const NOISE_PATTERNS = [
    /what should i know about/i,
    /^what should i know/i,
    /^what problems does/i,
    /^who uses/i,
    /^welcome to/i,
    /^introducing/i,
    /^supercharge/i,
    /^unlock/i,
    /^transform/i,
    /^revolutionize/i,
    /^powered by/i,
    /^get started/i,
    /^sign up/i,
    /^try .+ free/i,
    /^your .+ solution/i,
    /^the .+ platform/i,
    /^all.in.one/i,
];

function normalizeTopic(raw) {
    const cleaned = String(raw || '')
        .replace(/[^a-z0-9\s\-+]/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    if (!cleaned) return '';
    const stripped = stripLeadingPhrases(cleaned);
    if (NOISE_PATTERNS.some((re) => re.test(cleaned))) return '';
    if (stripped.length < 4 || stripped.length > 60) return '';
    return stripped;
}

function applyTemplate(template, ctx) {
    return template
        .replace('{topic}', ctx.topic)
        .replace('{year}', YEAR)
        .replace('{audience}', ctx.audience || 'businesses')
        .replace('{geo}', ctx.geo || 'my area')
        .replace('{competitor}', ctx.competitor || 'competitors');
}

// Turn an offering noun into verb/action form for problem templates.
// e.g. "AI visibility audit" → "check AI visibility", "rank on AI search"
function offeringToAction(offering) {
    const o = offering.toLowerCase().trim();
    // If it's already a verb phrase (starts with how-to words), use as-is.
    if (/^(check|audit|track|monitor|improve|build|generate|connect|analyze|measure)/.test(o)) return o;
    // Otherwise prefix with "check" or "improve" depending on the category.
    if (/visib|ranking|rank|citat|appear/.test(o)) return `check ${o}`;
    if (/audit|score|analysis|analyze/.test(o)) return `audit ${o}`;
    if (/connect|integrat|sync|access/.test(o)) return `connect ${o}`;
    if (/generat|creat|build|write/.test(o)) return `${o}`;
    return `improve ${o}`;
}

// Extract service-category topics from crawled pages.
// Skips marketing headline noise; prefers FAQ questions.
function extractTopicsFromPages(pages) {
    const topics = new Set();

    for (const page of pages.slice(0, 5)) {
        // FAQ questions are gold — real user language.
        for (const faq of page.faqItems.slice(0, 6)) {
            const q = faq.question.trim();
            const t = normalizeTopic(q);
            if (t && t.length >= 6) topics.add(t);
        }

        // H2/H3 only — H1 is almost always the marketing headline.
        // Filter to headings that look like service/feature descriptions.
        for (const h of [...page.h2, ...page.h3].slice(0, 12)) {
            const t = normalizeTopic(h);
            // Only keep if it looks like a service category (2+ words, no noise)
            if (t && t.split(' ').length >= 2) topics.add(t);
        }
    }

    return [...topics].slice(0, 15);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function generateRealisticPrompts(
    pages,
    {
        industry = '',
        offerings = [],
        audience = '',
        geo = '',
        competitors = [],
        seed_prompts = [],
        extraTopics = [],
    } = {},
    maxPrompts = 20,
) {
    const prompts = [];
    const seen = new Set();

    function add(p) {
        const key = p.toLowerCase().trim();
        if (!key || key.length < 8 || seen.has(key)) return;
        seen.add(key);
        prompts.push(p.trim());
    }

    // 1. Seed prompts from Claude's research — highest quality, use first.
    if (Array.isArray(seed_prompts)) {
        for (const p of seed_prompts) {
            if (typeof p === 'string') add(p);
        }
    }

    // 2. FAQ questions from the site — real user language.
    for (const page of pages.slice(0, 3)) {
        for (const faq of page.faqItems.slice(0, 4)) {
            const q = faq.question.trim();
            if (q.length > 10) add(q.endsWith('?') ? q : `${q}?`);
        }
    }

    // 3. Build a topic list from offerings, then site content, then industry.
    const offeringTopics = (Array.isArray(offerings) ? offerings : [])
        .map((o) => normalizeTopic(o))
        .filter(Boolean);

    const pageTopics = extractTopicsFromPages(pages);

    const extraNormalized = (Array.isArray(extraTopics) ? extraTopics : [])
        .map((t) => normalizeTopic(t))
        .filter(Boolean);

    const allTopics = [
        ...new Set([
            ...offeringTopics,
            ...extraNormalized,
            ...(industry ? [normalizeTopic(industry)] : []),
            ...pageTopics,
        ]),
    ].filter(Boolean);

    const competitor = Array.isArray(competitors) && competitors.length
        ? String(competitors[0]).trim()
        : '';

    // 4. Discovery templates — buyer choosing between solutions.
    for (const topic of allTopics.slice(0, 8)) {
        for (const t of DISCOVERY_TEMPLATES) {
            if (t.includes('{competitor}') && !competitor) continue;
            if (t.includes('{geo}') && !geo) continue;
            if (t.includes('{audience}') && !audience) continue;
            add(applyTemplate(t, { topic, audience, geo, competitor }));
            if (prompts.length >= maxPrompts * 4) break;
        }
    }

    // 5. Problem templates — buyer knows the pain, is searching for how to fix it.
    //    Use offerings converted to action phrases for the most relevant results.
    const actionTopics = [
        ...(Array.isArray(offerings) ? offerings : []).map(offeringToAction).filter(Boolean),
        ...allTopics.slice(0, 5),
    ];
    for (const topic of actionTopics.slice(0, 6)) {
        for (const t of PROBLEM_TEMPLATES) {
            if (t.includes('{audience}') && !audience) continue;
            if (t.includes('{geo}') && !geo) continue;
            add(applyTemplate(t, { topic, audience, geo, competitor }));
            if (prompts.length >= maxPrompts * 4) break;
        }
    }

    return prompts.slice(0, maxPrompts);
}

// Back-compat aliases.
export function generateTestPrompts(pages, extraTopics = [], maxPrompts = 20) {
    return generateRealisticPrompts(pages, { extraTopics }, maxPrompts);
}

export function generateIndustryPrompts(industry) {
    const t = normalizeTopic(industry);
    if (!t) return [];
    return DISCOVERY_TEMPLATES
        .filter((x) => !x.includes('{geo}') && !x.includes('{competitor}') && !x.includes('{audience}'))
        .map((tpl) => applyTemplate(tpl, { topic: t }));
}

import { verifyAccessToken, publicBase } from '../../mcp-auth.js';
import { getUserOAuthClient, assertWebmastersReadonlyScope } from '../../google.js';
import {
    listGa4Properties,
    listGscSites,
    runGa4Report,
    runGscQuery,
    fetchGa4Snapshot,
    fetchGscSnapshot,
    compareGa4Periods,
    findCtrOpportunities,
    findRankingOpportunities,
} from '../../google-data.js';
const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'sellonllm-analytics', version: '0.3.0' };
const INSTRUCTIONS = `You are connected to a user's Google Analytics 4 and Google Search Console data via SellOnLLM.

General workflow:
1. Start by calling list_ga4_properties and list_search_console_sites so you know which property/site ID to use.
2. If list_search_console_sites returns [] (empty array), the Google account has no verified Search Console properties, or the user signed in with a different Google account than the one that owns GSC. Do not assume the MCP connector is broken—ask which domain and Google account should be used, and suggest verifying the property in Google Search Console.
3. For broad SEO questions, use get_seo_snapshot(propertyId, siteUrl) for a ready-made 28-day summary.
4. For more specific questions, use query_ga4 / query_search_console with targeted dimensions and metrics.
5. Prefer the curated tools (find_ctr_opportunities, find_ranking_opportunities, get_traffic_deltas) when they match the user's intent.

For AI visibility / AEO tools (Perplexity, crawl scorecards), use the separate SellOnLLM connector documented at /ai-visibility-mcp-claude.html — this analytics connector is GA+GSC only.

When you make recommendations, always cite the specific query, page, CTR, or position you're basing them on.
When Claude supports artifacts, prefer a dashboard-style artifact with KPI cards, tables, trend sections, and a concise action plan.
If artifact rendering is unavailable, fall back to markdown tables and bullets.`;

function asPercent(value) {
    return value == null ? null : Number((value * 100).toFixed(1));
}

function sum(rows, key) {
    return (rows || []).reduce((acc, row) => acc + (Number(row?.[key]) || 0), 0);
}

function average(rows, key) {
    if (!rows?.length) return null;
    return Number((sum(rows, key) / rows.length).toFixed(2));
}

function buildEnvelope({ markdown, summary, presentation, raw }) {
    return {
        markdown,
        summary,
        presentation: {
            kind: 'dashboard',
            ...presentation,
        },
        raw,
    };
}

function markdownTable(columns, rows) {
    if (!rows?.length) return '';
    const header = `| ${columns.join(' | ')} |`;
    const divider = `|${columns.map(() => '---').join('|')}|`;
    const body = rows.map((row) => `| ${columns.map((col) => row[col] ?? '').join(' | ')} |`);
    return [header, divider, ...body].join('\n');
}

function summarizeSeoSnapshot(data, args) {
    const gaTraffic = data.ga?.traffic || [];
    const gscQueries = data.gsc?.topQueries || [];
    const gscPages = data.gsc?.topPages || [];
    const totalSessions = sum(gaTraffic, 'sessions');
    const totalUsers = sum(gaTraffic, 'totalUsers');
    const totalConversions = sum(gaTraffic, 'conversions');
    const totalClicks = sum(gscQueries, 'clicks');
    const totalImpressions = sum(gscQueries, 'impressions');
    const avgCtr = totalImpressions ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : null;
    const avgPosition = average(gscQueries, 'position');
    const markdownParts = [
        '# SEO Snapshot',
        '',
        `**GA4 property:** ${args.propertyId || 'not provided'}  |  **GSC site:** ${args.siteUrl || 'not provided'}`,
        '',
        '## KPI Summary',
        `- Sessions: ${totalSessions || 0}`,
        `- Users: ${totalUsers || 0}`,
        `- Conversions: ${totalConversions || 0}`,
        `- Clicks: ${totalClicks || 0}`,
        `- Impressions: ${totalImpressions || 0}`,
        `- Avg CTR: ${avgCtr ?? 'n/a'}%`,
        `- Avg position: ${avgPosition ?? 'n/a'}`,
        '',
    ];
    if (data.ga?.topPages?.length) {
        markdownParts.push('## Top GA Pages', '', markdownTable(
            ['pagePath', 'sessions', 'totalUsers', 'engagementRate'],
            data.ga.topPages.slice(0, 10).map((row) => ({
                pagePath: row.pagePath,
                sessions: row.sessions,
                totalUsers: row.totalUsers,
                engagementRate: row.engagementRate,
            })),
        ), '');
    }
    if (gscQueries.length) {
        markdownParts.push('## Top GSC Queries', '', markdownTable(
            ['query', 'clicks', 'impressions', 'ctr', 'position'],
            gscQueries.slice(0, 10).map((row) => ({
                query: row.query,
                clicks: row.clicks,
                impressions: row.impressions,
                ctr: row.ctr,
                position: row.position,
            })),
        ), '');
    }
    if (data.errors && Object.keys(data.errors).length) {
        markdownParts.push('## Errors', ...Object.entries(data.errors).map(([key, value]) => `- ${key}: ${value}`), '');
    }
    return buildEnvelope({
        markdown: markdownParts.join('\n'),
        summary: {
            title: 'SEO Snapshot',
            subtitle: args.siteUrl || args.propertyId || 'GA4 + Search Console',
            totalSessions,
            totalUsers,
            totalConversions,
            totalClicks,
            totalImpressions,
            avgCtr,
            avgPosition,
        },
        presentation: {
            title: 'SEO Snapshot',
            subtitle: args.siteUrl || args.propertyId || 'GA4 + Search Console',
            kpis: [
                { key: 'sessions', label: 'Sessions', value: totalSessions || 0, format: 'integer' },
                { key: 'users', label: 'Users', value: totalUsers || 0, format: 'integer' },
                { key: 'conversions', label: 'Conversions', value: totalConversions || 0, format: 'integer' },
                { key: 'clicks', label: 'Clicks', value: totalClicks || 0, format: 'integer' },
                { key: 'impressions', label: 'Impressions', value: totalImpressions || 0, format: 'integer' },
                { key: 'avgCtr', label: 'Avg CTR', value: avgCtr, format: 'percent' },
                { key: 'avgPosition', label: 'Avg Position', value: avgPosition, format: 'decimal' },
            ],
            tables: [
                { key: 'gaTopPages', title: 'Top GA Pages', columns: ['pagePath', 'sessions', 'totalUsers', 'engagementRate'], rows: data.ga?.topPages || [] },
                { key: 'gscTopQueries', title: 'Top GSC Queries', columns: ['query', 'clicks', 'impressions', 'ctr', 'position'], rows: gscQueries },
                { key: 'gscTopPages', title: 'Top GSC Pages', columns: ['page', 'clicks', 'impressions', 'ctr', 'position'], rows: gscPages },
            ],
            series: [
                { key: 'traffic', title: 'Traffic Trend', xKey: 'date', metrics: ['sessions', 'totalUsers', 'engagedSessions', 'conversions'], rows: gaTraffic },
            ],
            sections: data.errors && Object.keys(data.errors).length
                ? [{ key: 'errors', title: 'Errors', items: Object.entries(data.errors).map(([key, text]) => ({ key, text })) }]
                : [],
        },
        raw: data,
    });
}

function summarizeGaQuery(data, args) {
    const dimensions = args.dimensions || [];
    const metrics = args.metrics || [];
    const title = dimensions.length ? `GA4 report by ${dimensions.join(', ')}` : 'GA4 report';
    const topMetric = metrics[0];
    const topValue = topMetric ? sum(data, topMetric) : null;
    return buildEnvelope({
        markdown: [
            `# ${title}`,
            '',
            `Rows returned: ${data.length}`,
            topMetric ? `Primary metric total (${topMetric}): ${topValue}` : '',
            '',
            markdownTable([...dimensions, ...metrics], data.slice(0, 25)),
        ].filter(Boolean).join('\n'),
        summary: {
            title,
            subtitle: args.propertyId,
            rowCount: data.length,
            dimensions,
            metrics,
            primaryMetric: topMetric || null,
            primaryMetricTotal: topValue,
        },
        presentation: {
            title,
            subtitle: args.propertyId,
            kpis: [
                { key: 'rowCount', label: 'Rows', value: data.length, format: 'integer' },
                ...(topMetric ? [{ key: 'primaryMetricTotal', label: topMetric, value: topValue, format: 'number' }] : []),
            ],
            tables: [
                { key: 'rows', title: title, columns: [...dimensions, ...metrics], rows: data },
            ],
            series: dimensions.includes('date')
                ? [{ key: 'timeSeries', title, xKey: 'date', metrics, rows: data }]
                : [],
        },
        raw: data,
    });
}

function summarizeGscQuery(data, args) {
    const dimensions = args.dimensions || ['query'];
    const totalClicks = sum(data, 'clicks');
    const totalImpressions = sum(data, 'impressions');
    const avgCtr = totalImpressions ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : null;
    const avgPosition = average(data, 'position');
    return buildEnvelope({
        markdown: [
            `# Search Console report by ${dimensions.join(', ')}`,
            '',
            `Rows returned: ${data.length}`,
            `Total clicks: ${totalClicks || 0}`,
            `Total impressions: ${totalImpressions || 0}`,
            `Average CTR: ${avgCtr ?? 'n/a'}%`,
            `Average position: ${avgPosition ?? 'n/a'}`,
            '',
            markdownTable([...dimensions, 'clicks', 'impressions', 'ctr', 'position'], data.slice(0, 25)),
        ].join('\n'),
        summary: {
            title: 'Search Console Query',
            subtitle: args.siteUrl,
            rowCount: data.length,
            dimensions,
            totalClicks,
            totalImpressions,
            avgCtr,
            avgPosition,
        },
        presentation: {
            title: 'Search Console Query',
            subtitle: args.siteUrl,
            kpis: [
                { key: 'rowCount', label: 'Rows', value: data.length, format: 'integer' },
                { key: 'totalClicks', label: 'Clicks', value: totalClicks || 0, format: 'integer' },
                { key: 'totalImpressions', label: 'Impressions', value: totalImpressions || 0, format: 'integer' },
                { key: 'avgCtr', label: 'Avg CTR', value: avgCtr, format: 'percent' },
                { key: 'avgPosition', label: 'Avg Position', value: avgPosition, format: 'decimal' },
            ],
            tables: [
                { key: 'rows', title: 'Search Console Rows', columns: [...dimensions, 'clicks', 'impressions', 'ctr', 'position'], rows: data },
            ],
            series: dimensions.includes('date')
                ? [{ key: 'gscTimeSeries', title: 'Search Console Time Series', xKey: 'date', metrics: ['clicks', 'impressions', 'ctr', 'position'], rows: data }]
                : [],
        },
        raw: data,
    });
}

function summarizeCtrOpportunities(data, args) {
    return buildEnvelope({
        markdown: [
            '# CTR Opportunities',
            '',
            `Rows returned: ${data.length}`,
            '',
            markdownTable(['query', 'page', 'clicks', 'impressions', 'ctr', 'position', 'expectedCtrAtPos', 'gap'], data.slice(0, 25)),
        ].join('\n'),
        summary: {
            title: 'CTR Opportunities',
            subtitle: args.siteUrl,
            rowCount: data.length,
            maxOpportunityGap: data[0]?.gap ?? null,
        },
        presentation: {
            title: 'CTR Opportunities',
            subtitle: args.siteUrl,
            kpis: [
                { key: 'rowCount', label: 'Opportunities', value: data.length, format: 'integer' },
                { key: 'maxGap', label: 'Top CTR Gap', value: data[0]?.gap ?? null, format: 'decimal' },
            ],
            tables: [
                { key: 'opportunities', title: 'CTR Opportunity Table', columns: ['query', 'page', 'clicks', 'impressions', 'ctr', 'position', 'expectedCtrAtPos', 'gap'], rows: data },
            ],
        },
        raw: data,
    });
}

function summarizeRankingOpportunities(data, args) {
    return buildEnvelope({
        markdown: [
            '# Ranking Opportunities',
            '',
            `Rows returned: ${data.length}`,
            '',
            markdownTable(['query', 'page', 'clicks', 'impressions', 'ctr', 'position'], data.slice(0, 25)),
        ].join('\n'),
        summary: {
            title: 'Ranking Opportunities',
            subtitle: args.siteUrl,
            rowCount: data.length,
            bestAveragePosition: data[0]?.position ?? null,
        },
        presentation: {
            title: 'Ranking Opportunities',
            subtitle: args.siteUrl,
            kpis: [
                { key: 'rowCount', label: 'Near-Miss Rankings', value: data.length, format: 'integer' },
                { key: 'bestAveragePosition', label: 'Best Position', value: data[0]?.position ?? null, format: 'decimal' },
            ],
            tables: [
                { key: 'opportunities', title: 'Ranking Opportunity Table', columns: ['query', 'page', 'clicks', 'impressions', 'ctr', 'position'], rows: data },
            ],
        },
        raw: data,
    });
}

function summarizeTrafficDeltas(data, args) {
    const gainers = (data.pages || []).filter((row) => (row.sessionsDelta || 0) > 0);
    const decliners = (data.pages || []).filter((row) => (row.sessionsDelta || 0) < 0);
    return buildEnvelope({
        markdown: [
            '# Traffic Deltas',
            '',
            `Current period: ${data.periods.current.startDate} to ${data.periods.current.endDate}`,
            `Previous period: ${data.periods.previous.startDate} to ${data.periods.previous.endDate}`,
            `Rows returned: ${data.pages.length}`,
            '',
            markdownTable(['pagePath', 'sessionsCurrent', 'sessionsPrevious', 'sessionsDelta', 'sessionsPctChange'], data.pages.slice(0, 25)),
        ].join('\n'),
        summary: {
            title: 'Traffic Deltas',
            subtitle: args.propertyId,
            rowCount: data.pages.length,
            gainers: gainers.length,
            decliners: decliners.length,
        },
        presentation: {
            title: 'Traffic Deltas',
            subtitle: args.propertyId,
            kpis: [
                { key: 'gainers', label: 'Gainers', value: gainers.length, format: 'integer' },
                { key: 'decliners', label: 'Decliners', value: decliners.length, format: 'integer' },
                { key: 'days', label: 'Days Compared', value: args.days ?? 28, format: 'integer' },
            ],
            tables: [
                { key: 'pages', title: 'Page Delta Table', columns: ['pagePath', 'sessionsCurrent', 'sessionsPrevious', 'sessionsDelta', 'sessionsPctChange'], rows: data.pages },
            ],
            sections: [
                { key: 'periods', title: 'Periods', items: [data.periods] },
            ],
        },
        raw: data,
    });
}

function shapeAnalyticsToolResult(name, data, args) {
    switch (name) {
        case 'get_seo_snapshot':
            return summarizeSeoSnapshot(data, args);
        case 'query_ga4':
            return summarizeGaQuery(data, args);
        case 'query_search_console':
            return summarizeGscQuery(data, args);
        case 'find_ctr_opportunities':
            return summarizeCtrOpportunities(data, args);
        case 'find_ranking_opportunities':
            return summarizeRankingOpportunities(data, args);
        case 'get_traffic_deltas':
            return summarizeTrafficDeltas(data, args);
        default:
            return data;
    }
}

/* ===================== Tool catalogue ===================== */

const TOOLS = [
    {
        name: 'list_ga4_properties',
        description: "List all Google Analytics 4 properties the signed-in user can access. Use this first to get a propertyId for other GA4 tools.",
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async ({ auth }) => listGa4Properties(auth),
    },
    {
        name: 'list_search_console_sites',
        description: "List all Google Search Console sites the signed-in user can access. Use this first to get a siteUrl for other GSC tools. Returns [] if this Google account has no verified GSC properties (not necessarily an error).",
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async ({ auth, userId }) => {
            await assertWebmastersReadonlyScope(userId);
            return listGscSites(auth);
        },
    },
    {
        name: 'get_seo_snapshot',
        description: 'Fetch a 28-day SEO snapshot combining GA4 + Search Console: daily traffic, top pages, channels, countries, top queries, search pages, and device split. Perfect for an opening overview.',
        inputSchema: {
            type: 'object',
            properties: {
                propertyId: { type: 'string', description: 'GA4 propertyId (optional but recommended)' },
                siteUrl: { type: 'string', description: 'Search Console siteUrl, e.g. "sc-domain:example.com" or "https://example.com/" (optional but recommended)' },
            },
        },
        handler: async ({ auth, args }) => {
            const out = {};
            const errs = {};
            if (args.propertyId) { try { out.ga = await fetchGa4Snapshot(auth, args.propertyId); } catch (e) { errs.ga = e.message; } }
            if (args.siteUrl) { try { out.gsc = await fetchGscSnapshot(auth, args.siteUrl); } catch (e) { errs.gsc = e.message; } }
            if (Object.keys(errs).length) out.errors = errs;
            return out;
        },
    },
    {
        name: 'query_ga4',
        description: 'Run a flexible Google Analytics 4 report. Pass dimensions, metrics, optional date range, and an optional limit. Returns rows of data.',
        inputSchema: {
            type: 'object',
            required: ['propertyId', 'metrics'],
            properties: {
                propertyId: { type: 'string', description: 'GA4 propertyId (numeric, without "properties/" prefix)' },
                dimensions: { type: 'array', items: { type: 'string' }, description: 'e.g. ["date"], ["pagePath"], ["sessionSource","sessionMedium"]' },
                metrics: { type: 'array', items: { type: 'string' }, description: 'e.g. ["sessions","totalUsers","engagementRate","conversions"]' },
                dateRange: {
                    type: 'object',
                    properties: {
                        startDate: { type: 'string', description: 'YYYY-MM-DD or relative like "28daysAgo"' },
                        endDate: { type: 'string', description: 'YYYY-MM-DD or relative like "yesterday"' },
                    },
                },
                orderBy: { type: 'string', description: 'Metric name to order by, descending. e.g. "sessions"' },
                limit: { type: 'integer', minimum: 1, maximum: 250, default: 25 },
            },
        },
        handler: async ({ auth, args }) => {
            const orderBys = args.orderBy ? [{ metric: { metricName: args.orderBy }, desc: true }] : undefined;
            return runGa4Report(auth, {
                propertyId: args.propertyId,
                dimensions: args.dimensions || [],
                metrics: args.metrics,
                dateRange: args.dateRange,
                orderBys,
                limit: args.limit || 25,
            });
        },
    },
    {
        name: 'query_search_console',
        description: 'Run a flexible Google Search Console search analytics query. Returns rows with clicks, impressions, ctr (as a percentage), and average position.',
        inputSchema: {
            type: 'object',
            required: ['siteUrl'],
            properties: {
                siteUrl: { type: 'string', description: 'e.g. "sc-domain:example.com" or "https://example.com/"' },
                dimensions: { type: 'array', items: { type: 'string', enum: ['query', 'page', 'country', 'device', 'searchAppearance', 'date'] }, default: ['query'] },
                dateRange: {
                    type: 'object',
                    properties: {
                        startDate: { type: 'string', description: 'YYYY-MM-DD' },
                        endDate: { type: 'string', description: 'YYYY-MM-DD' },
                    },
                },
                searchType: { type: 'string', enum: ['web', 'image', 'video', 'news', 'discover'], default: 'web' },
                rowLimit: { type: 'integer', minimum: 1, maximum: 1000, default: 50 },
            },
        },
        handler: async ({ auth, args }) => runGscQuery(auth, {
            siteUrl: args.siteUrl,
            dimensions: args.dimensions || ['query'],
            dateRange: args.dateRange,
            rowLimit: args.rowLimit || 50,
            searchType: args.searchType || 'web',
        }),
    },
    {
        name: 'find_ctr_opportunities',
        description: 'Find Search Console query/page pairs where impressions are high but CTR is below what we\'d expect for their average position. Returns a prioritised list (best opportunities first).',
        inputSchema: {
            type: 'object',
            required: ['siteUrl'],
            properties: {
                siteUrl: { type: 'string' },
                minImpressions: { type: 'integer', default: 200 },
                maxPosition: { type: 'number', default: 15 },
                limit: { type: 'integer', default: 25 },
            },
        },
        handler: async ({ auth, args }) => findCtrOpportunities(auth, args.siteUrl, {
            minImpressions: args.minImpressions ?? 200,
            maxPosition: args.maxPosition ?? 15,
            limit: args.limit ?? 25,
        }),
    },
    {
        name: 'find_ranking_opportunities',
        description: 'Find pages ranking in positions 4–15 that could realistically reach the top 3 with on-page improvements. Sorted by impressions.',
        inputSchema: {
            type: 'object',
            required: ['siteUrl'],
            properties: {
                siteUrl: { type: 'string' },
                minPos: { type: 'number', default: 4 },
                maxPos: { type: 'number', default: 15 },
                minImpressions: { type: 'integer', default: 100 },
                limit: { type: 'integer', default: 25 },
            },
        },
        handler: async ({ auth, args }) => findRankingOpportunities(auth, args.siteUrl, {
            minPos: args.minPos ?? 4,
            maxPos: args.maxPos ?? 15,
            minImpressions: args.minImpressions ?? 100,
            limit: args.limit ?? 25,
        }),
    },
    {
        name: 'get_traffic_deltas',
        description: 'Compare the last N days (default 28) with the previous N days per pagePath. Great for spotting movers and decliners.',
        inputSchema: {
            type: 'object',
            required: ['propertyId'],
            properties: {
                propertyId: { type: 'string' },
                days: { type: 'integer', minimum: 7, maximum: 90, default: 28 },
            },
        },
        handler: async ({ auth, args }) => compareGa4Periods(auth, args.propertyId, args.days ?? 28),
    },
];

/* ===================== Prompt catalogue ===================== */

const PROMPTS = [
    {
        name: 'ctr_audit',
        description: 'Audit Search Console for queries with high impressions but low CTR and suggest title/meta rewrites.',
        template: () => 'Using the SellOnLLM analytics tools, run find_ctr_opportunities for my Search Console site. Render the result as a dashboard-style artifact when supported by Claude with KPI cards, a CTR opportunity table, and concise rewrite recommendations. For each of the top 10 results, give me a rewritten page title and meta description that better matches the query intent. If artifacts are unavailable, fall back to markdown tables and bullets.',
    },
    {
        name: 'content_gaps',
        description: 'Suggest new content pieces based on top queries and pages.',
        template: () => 'Using query_search_console and query_ga4, look at my top queries and top pages over the last 28 days. Render the result as a dashboard-style artifact when supported by Claude with KPI cards, top-query tables, and a concise content-gap section. Suggest 5 brand-new content pieces I should publish to capture adjacent search intent. If artifacts are unavailable, fall back to markdown tables and bullets.',
    },
    {
        name: 'rank_booster',
        description: 'Find pages in positions 4–15 and give on-page optimisation steps.',
        template: () => 'Using find_ranking_opportunities, find my pages ranking in positions 4–15. Render the result as a dashboard-style artifact when supported by Claude with KPI cards, a ranking opportunity table, and prioritized fixes. For the top 10, give me specific on-page changes (H1, intro, internal linking, schema) to push them into the top 3. If artifacts are unavailable, fall back to markdown tables and bullets.',
    },
    {
        name: 'monthly_review',
        description: 'A full monthly SEO review.',
        template: () => 'Give me a complete monthly SEO health review using the SellOnLLM tools:\n1. get_seo_snapshot for my primary GA4 property + Search Console site.\n2. get_traffic_deltas to surface biggest movers and decliners.\n3. find_ctr_opportunities to list the top 5 CTR opportunities.\n4. find_ranking_opportunities to list the top 5 near-miss rankings.\n\nRender the result as a dashboard-style artifact when supported by Claude with KPI cards, trend sections, opportunity tables, and a prioritised 5-item action list for next month. If artifacts are unavailable, fall back to markdown tables and bullets.',
    },
];

/* ===================== HTTP handler ===================== */

export default async function handler(req, res) {
    const base = publicBase();
    const resourceUrl = `${base}/api/mcp`.replace(/\/+$/, '');
    const resourceMetadataUrl = `${base}/.well-known/oauth-protected-resource?resource=${encodeURIComponent(resourceUrl)}`;

    const method = String(req.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, HEAD, OPTIONS, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version');
        return res.status(204).end();
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    // GET /api/mcp -> return a tiny "you've reached it" helper (useful for humans pasting the URL).
    // We still return 401 with WWW-Authenticate when there is no bearer, so MCP clients can discover us.
    const authz = req.headers.authorization || '';
    const bearer = authz.startsWith('Bearer ') ? authz.slice(7).trim() : null;
    const payload = bearer ? verifyAccessToken(bearer) : null;

    if (!payload) {
        res.setHeader('WWW-Authenticate', `Bearer realm="MCP", resource_metadata="${resourceMetadataUrl}"`);
        if (method === 'GET') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(401).send(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:32px;max-width:640px;margin:0 auto;color:#0f172a">
<h2>SellOnLLM — GA4 + Search Console MCP</h2>
<p>This URL is the <strong>Google Analytics + Search Console</strong> MCP endpoint. To use it, add it as a custom connector in Claude.ai (or another MCP client).</p>
<p><strong>Server URL:</strong> <code>${resourceUrl}</code></p>
<p>For <strong>AI visibility / AEO</strong> (Perplexity citation tools), use the separate connector: <a href="${base}/ai-visibility-mcp-claude.html">${base}/api/mcp-ai-visibility</a></p>
</body></html>`);
        }
        return res.status(401).json({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32001, message: 'Unauthorized. See WWW-Authenticate header.' },
        });
    }

    if (method === 'HEAD') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        return res.end();
    }
    if (method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.write('id: 0\ndata:\n\n');
        return res.end();
    }

    if (method !== 'POST') {
        res.setHeader('Allow', 'POST, GET, HEAD, DELETE, OPTIONS');
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    // Body can arrive as object (Vercel default) or string.
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    if (!body) return res.status(400).json({ error: 'invalid_body' });

    const userId = payload.sub;

    // Support JSON-RPC batch.
    if (Array.isArray(body)) {
        const results = await Promise.all(body.map(msg => handleRpc(msg, userId)));
        const filtered = results.filter(r => r != null);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (!filtered.length) return res.status(202).end();
        return res.status(200).json(filtered);
    }

    const result = await handleRpc(body, userId);
    if (result == null) {
        // Notification (no response)
        return res.status(202).end();
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(result);
}

async function handleRpc(msg, userId) {
    const { id = null, method, params } = msg || {};
    const isNotification = id === null || id === undefined;

    try {
        if (method === 'initialize') {
            return ok(id, {
                protocolVersion: PROTOCOL_VERSION,
                capabilities: {
                    tools: { listChanged: false },
                    prompts: { listChanged: false },
                },
                serverInfo: SERVER_INFO,
                instructions: INSTRUCTIONS,
            });
        }

        if (method === 'notifications/initialized' || method === 'notifications/cancelled' || method === 'notifications/roots/list_changed') {
            return null; // notifications have no response
        }

        if (method === 'ping') {
            return ok(id, {});
        }

        if (method === 'tools/list') {
            return ok(id, {
                tools: TOOLS.map(t => ({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.inputSchema,
                })),
            });
        }

        if (method === 'tools/call') {
            const { name, arguments: args } = params || {};
            const tool = TOOLS.find(t => t.name === name);
            if (!tool) return err(id, -32601, `Unknown tool: ${name}`);
            try {
                const auth = await getUserOAuthClient(userId);
                const data = await tool.handler({ auth, args: args || {}, userId });
                const shaped = shapeAnalyticsToolResult(name, data, args || {});
                const text = typeof shaped?.markdown === 'string'
                    ? shaped.markdown
                    : JSON.stringify(shaped, null, 2);
                return ok(id, {
                    content: [{ type: 'text', text: text }],
                    structuredContent: shaped,
                    isError: false,
                });
            } catch (toolErr) {
                console.error(`tool ${name} failed:`, toolErr);
                const detail = toolErr?.response?.data?.error?.message || toolErr.message;
                return ok(id, {
                    content: [{ type: 'text', text: `Tool "${name}" failed: ${detail}` }],
                    isError: true,
                });
            }
        }

        if (method === 'prompts/list') {
            return ok(id, {
                prompts: PROMPTS.map(p => ({
                    name: p.name,
                    description: p.description,
                    arguments: [],
                })),
            });
        }

        if (method === 'prompts/get') {
            const name = params?.name;
            const p = PROMPTS.find(x => x.name === name);
            if (!p) return err(id, -32601, `Unknown prompt: ${name}`);
            return ok(id, {
                description: p.description,
                messages: [
                    { role: 'user', content: { type: 'text', text: p.template() } },
                ],
            });
        }

        if (method === 'resources/list') return ok(id, { resources: [] });
        if (method === 'resources/templates/list') return ok(id, { resourceTemplates: [] });

        if (isNotification) return null;
        return err(id, -32601, `Method not found: ${method}`);
    } catch (e) {
        console.error('rpc error:', e);
        if (isNotification) return null;
        return err(id, -32603, e.message || 'Internal error');
    }
}

function ok(id, result) {
    return { jsonrpc: '2.0', id, result };
}
function err(id, code, message, data) {
    return { jsonrpc: '2.0', id, error: { code, message, data } };
}

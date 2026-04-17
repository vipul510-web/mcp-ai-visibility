import { verifyAccessToken, publicBase } from '../_lib/mcp-auth.js';
import { getUserOAuthClient } from '../_lib/google.js';
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
} from '../_lib/google-data.js';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'sellonllm-analytics', version: '0.1.0' };
const INSTRUCTIONS = `You are connected to a user's Google Analytics 4 and Google Search Console data via SellOnLLM.

General workflow:
1. Start by calling list_ga4_properties and list_search_console_sites so you know which property/site ID to use.
2. For broad SEO questions, use get_seo_snapshot(propertyId, siteUrl) for a ready-made 28-day summary.
3. For more specific questions, use query_ga4 / query_search_console with targeted dimensions and metrics.
4. Prefer the curated tools (find_ctr_opportunities, find_ranking_opportunities, get_traffic_deltas) when they match the user's intent.

When you make recommendations, always cite the specific query, page, CTR, or position you're basing them on.`;

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
        description: "List all Google Search Console sites the signed-in user can access. Use this first to get a siteUrl for other GSC tools.",
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async ({ auth }) => listGscSites(auth),
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
        template: () => 'Using the SellOnLLM analytics tools, run find_ctr_opportunities for my Search Console site. For each of the top 10 results, give me a rewritten page title and meta description that better matches the query intent. Explain the reasoning in one short sentence each.',
    },
    {
        name: 'content_gaps',
        description: 'Suggest new content pieces based on top queries and pages.',
        template: () => 'Using query_search_console and query_ga4, look at my top queries and top pages over the last 28 days. Suggest 5 brand-new content pieces I should publish to capture adjacent search intent. For each: target primary keyword, a one-line outline, and 3 internal links to existing pages.',
    },
    {
        name: 'rank_booster',
        description: 'Find pages in positions 4–15 and give on-page optimisation steps.',
        template: () => 'Using find_ranking_opportunities, find my pages ranking in positions 4–15. For the top 10, give me specific on-page changes (H1, intro, internal linking, schema) to push them into the top 3. Be concrete and actionable.',
    },
    {
        name: 'monthly_review',
        description: 'A full monthly SEO review.',
        template: () => 'Give me a complete monthly SEO health review using the SellOnLLM tools:\n1. get_seo_snapshot for my primary GA4 property + Search Console site.\n2. get_traffic_deltas to surface biggest movers and decliners.\n3. find_ctr_opportunities to list the top 5 CTR opportunities.\n4. find_ranking_opportunities to list the top 5 near-miss rankings.\n\nThen wrap with an executive summary and a prioritised 5-item action list for next month.',
    },
];

/* ===================== HTTP handler ===================== */

export default async function handler(req, res) {
    const base = publicBase();

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE');
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
        res.setHeader('WWW-Authenticate',
            `Bearer realm="MCP", resource_metadata="${base}/.well-known/oauth-protected-resource"`);
        if (req.method === 'GET') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(401).send(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:32px;max-width:640px;margin:0 auto;color:#0f172a">
<h2>SellOnLLM MCP endpoint</h2>
<p>This URL is the MCP server endpoint. To use it, add it as a custom connector in Claude.ai (or another MCP client).</p>
<p><strong>Server URL:</strong> <code>${base}/api/mcp</code></p>
<p>Claude will discover authorisation automatically.</p>
</body></html>`);
        }
        return res.status(401).json({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32001, message: 'Unauthorized. See WWW-Authenticate header.' },
        });
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
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
                const json = JSON.stringify(data, null, 2);
                return ok(id, {
                    content: [{ type: 'text', text: json }],
                    structuredContent: data,
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

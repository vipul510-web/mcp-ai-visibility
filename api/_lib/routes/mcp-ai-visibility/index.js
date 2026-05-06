/**
 * SellOnLLM AI Visibility MCP — separate JSON-RPC endpoint from GA+GSC analytics MCP.
 * Connector URL: POST /api/mcp-ai-visibility
 */
import { verifyAccessToken, publicBase } from '../../mcp-auth.js';
import {
    handleAnalyzeWebsiteAeo,
    handleCheckAiVisibility,
    handleDiscoverRankingPrompts,
    handleGetVisibilityReport,
    handleCompareCompetitorVisibility,
} from '../../aeo-visibility/handlers.js';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'sellonllm-ai-visibility', version: '1.0.0' };
const INSTRUCTIONS = `You are connected to SellOnLLM's **AI visibility / AEO** MCP (separate from Google Analytics + Search Console).

Tools:
- analyze_website_aeo — crawl public pages and score AEO readiness (schema, FAQ, depth, trust signals).
- check_ai_visibility — Perplexity Sonar citation check for one user query vs one URL.
- discover_ranking_prompts — generate prompts from the site, test visibility (rate-limited).
- get_visibility_report — combined report (custom and/or auto prompts).
- compare_competitor_visibility — compare your site vs competitors on the same prompts.

Perplexity: the user must save their own Perplexity API key on SellOnLLM (see resource documentation URL). Optional server PERPLEXITY_API_KEY is a fallback only.

Always cite tool output when making recommendations.
When Claude supports artifacts, prefer a dashboard-style artifact with KPI cards, clear sections, tables, and concise recommendations.
If artifact rendering is unavailable, fall back to markdown tables and bullets.`;

const TOOLS = [
    {
        name: 'analyze_website_aeo',
        description:
            'Crawl a public website (up to 10 pages) and score it for AEO (Answer Engine Optimization): structured data, FAQ content, clarity, E-E-A-T, citations, depth, meta tags, internal links. Returns a markdown report with scores and fixes.',
        inputSchema: {
            type: 'object',
            required: ['url'],
            properties: {
                url: { type: 'string', description: 'https://example.com' },
                max_pages: { type: 'integer', minimum: 1, maximum: 10, default: 5, description: 'Pages to crawl (hosted cap 10)' },
            },
            additionalProperties: false,
        },
        handler: async ({ args, userId }) => handleAnalyzeWebsiteAeo(args || {}, userId),
    },
    {
        name: 'check_ai_visibility',
        description:
            'Check whether a target URL/domain appears in Perplexity citations for a specific user query. Uses the user\'s Perplexity API key saved on sellonllm.com or optional server PERPLEXITY_API_KEY.',
        inputSchema: {
            type: 'object',
            required: ['url', 'query'],
            properties: {
                url: { type: 'string', description: 'Site under test, e.g. https://example.com' },
                query: { type: 'string', description: 'Natural-language question users might ask an AI (min 5 chars)' },
            },
            additionalProperties: false,
        },
        handler: async ({ args, userId }) => handleCheckAiVisibility(args || {}, userId),
    },
    {
        name: 'discover_ranking_prompts',
        description:
            'Crawl the site, generate realistic buyer-intent prompts (services, pricing, alternatives, comparisons) and optional seeds, then check each with Perplexity (rate-limited). Returns where you are cited vs missed opportunities.',
        inputSchema: {
            type: 'object',
            required: ['url'],
            properties: {
                url: { type: 'string' },
                industry: { type: 'string', description: 'Optional niche hint (e.g. SaaS, ecommerce)' },
                offerings: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional. List of your core services/products (e.g. \"background removal\", \"AI photo editor\") to generate more realistic prompts.',
                },
                audience: {
                    type: 'string',
                    description: 'Optional. Target buyer/persona (e.g. \"small business owners\", \"marketers\", \"developers\"). Used in prompt templates.',
                },
                geo: {
                    type: 'string',
                    description: 'Optional. Location hint (e.g. \"Austin\", \"UK\", \"near me\"). Used in local-intent templates.',
                },
                competitors: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional. Competitor brands/domains for comparison prompts (e.g. \"remove.bg\", \"canva\").',
                },
                seed_prompts: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional. Exact prompts you care about; these are tested first (subject to caps).',
                },
                max_prompts: { type: 'integer', minimum: 3, maximum: 8, default: 6, description: 'Hosted cap 8' },
            },
            additionalProperties: false,
        },
        handler: async ({ args, userId }) => handleDiscoverRankingPrompts(args || {}, userId),
    },
    {
        name: 'get_visibility_report',
        description:
            'AI visibility report: optional custom queries plus auto-generated prompts from the site (hosted cap 6 queries). Summarizes visibility rate and opportunities.',
        inputSchema: {
            type: 'object',
            required: ['url'],
            properties: {
                url: { type: 'string' },
                queries: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional; if empty with auto_generate, prompts are generated from the site',
                },
                auto_generate: { type: 'boolean', default: true, description: 'Merge auto prompts from crawl when true' },
            },
            additionalProperties: false,
        },
        handler: async ({ args, userId }) => handleGetVisibilityReport(args || {}, userId),
    },
    {
        name: 'compare_competitor_visibility',
        description:
            'Compare your site vs competitors on the same AI-search prompts (Perplexity citations). Hosted caps: max 3 queries, max 2 competitor URLs per call.',
        inputSchema: {
            type: 'object',
            required: ['your_url', 'competitor_urls', 'queries'],
            properties: {
                your_url: { type: 'string' },
                competitor_urls: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
                queries: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 },
            },
            additionalProperties: false,
        },
        handler: async ({ args, userId }) => handleCompareCompetitorVisibility(args || {}, userId),
    },
];

const PROMPTS = [
    {
        name: 'aeo_site_audit',
        description: 'Crawl a URL and return the AEO scorecard (schema, FAQ, depth, trust signals).',
        template: () => 'Use analyze_website_aeo on my primary marketing domain (I will paste the URL next). Render the result as a dashboard-style artifact when supported by Claude with KPI cards, a signal breakdown section, a pages-crawled table, and the top 5 fixes in priority order. If artifacts are unavailable, fall back to markdown tables and bullets.',
    },
    {
        name: 'ai_visibility_pulse',
        description: 'Quick AI visibility check for 2–3 prompts vs my domain.',
        template: () => 'I will give you my site URL and 2–3 customer questions we care about. Use check_ai_visibility for each question and render a compact dashboard artifact when supported: KPI cards for visible/not visible, a table of prompts vs citation position, and concise recommendations. If artifacts are unavailable, fall back to markdown tables and bullets.',
    },
    {
        name: 'research_first_visibility',
        description: 'Research-first workflow: infer offerings, audience, and competitors, then run realistic AI visibility prompts.',
        template: () => `Do this in three phases:\n\nPhase 1 — Research (if browsing is available):\n- Look up my company using the URL I provide next.\n- Infer: what we sell (offerings), target audience/persona, geographic focus, and 2–5 close competitors.\n- Identify 8–12 realistic buyer-intent prompts people would type into ChatGPT/Claude/Perplexity (pricing, alternatives, reviews, vs competitor, best-for-persona, local intent).\n\nPhase 2 — MCP testing:\n- Use discover_ranking_prompts on my URL with:\n  - offerings (3–6 items)\n  - audience (1 short phrase)\n  - geo (if relevant)\n  - competitors (2–5)\n  - seed_prompts (your best 6–8 buyer-intent prompts)\n  - max_prompts 8\n- Then run check_ai_visibility on the top 3 most important prompts.\n\nPhase 3 — Output:\n- Render a dashboard-style artifact when supported by Claude.\n- Use KPI cards for AEO score / visibility rate / prompts tested / wins.\n- Include a detailed table: prompt | visible? | who is cited instead | 1 specific fix.\n- End with a prioritized 14-day action plan (impact × effort).\n- If artifacts are unavailable, fall back to markdown tables and bullets.\n\nI will paste the website URL next.`,
    },
];

export default async function handler(req, res) {
    const base = publicBase();
    const resourceUrl = `${base}/api/mcp-ai-visibility`.replace(/\/+$/, '');
    const resourceMetadataUrl = `${base}/.well-known/oauth-protected-resource?resource=${encodeURIComponent(resourceUrl)}`;

    const method = String(req.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, HEAD, OPTIONS, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version');
        return res.status(204).end();
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    const authz = req.headers.authorization || '';
    const bearer = authz.startsWith('Bearer ') ? authz.slice(7).trim() : null;
    const payload = bearer ? verifyAccessToken(bearer) : null;

    if (!payload) {
        res.setHeader('WWW-Authenticate', `Bearer realm="MCP", resource_metadata="${resourceMetadataUrl}"`);
        if (method === 'GET') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(401).send(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:32px;max-width:640px;margin:0 auto;color:#0f172a">
<h2>SellOnLLM — AI Visibility MCP</h2>
<p>This URL is the <strong>AI visibility / AEO</strong> MCP endpoint (not the GA+GSC connector). Add it as a <strong>second</strong> custom connector in Claude if you also use analytics.</p>
<p><strong>Server URL:</strong> <code>${resourceUrl}</code></p>
<p><a href="${base}/ai-visibility-mcp-claude.html">Setup &amp; Perplexity API key</a> · <a href="https://github.com/vipul510-web/mcp-ai-visibility" target="_blank" rel="noopener noreferrer">GitHub</a></p>
</body></html>`);
        }
        return res.status(401).json({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32001, message: 'Unauthorized. See WWW-Authenticate header.' },
        });
    }

    // Streamable HTTP (MCP): any authenticated GET/HEAD on the MCP path should offer the SSE
    // listen channel. Some clients (e.g. Smithery) omit text/event-stream in Accept — still return SSE.
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

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    if (!body) return res.status(400).json({ error: 'invalid_body' });

    const userId = payload.sub;

    if (Array.isArray(body)) {
        const results = await Promise.all(body.map(msg => handleRpc(msg, userId)));
        const filtered = results.filter(r => r != null);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (!filtered.length) return res.status(202).end();
        return res.status(200).json(filtered);
    }

    const result = await handleRpc(body, userId);
    if (result == null) {
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
            return null;
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
                const data = await tool.handler({ args: args || {}, userId });
                if (typeof data === 'string') {
                    return ok(id, {
                        content: [{ type: 'text', text: data }],
                        isError: false,
                    });
                }
                const text = typeof data?.markdown === 'string'
                    ? data.markdown
                    : JSON.stringify(data, null, 2);
                return ok(id, {
                    content: [{ type: 'text', text: text }],
                    structuredContent: data,
                    isError: false,
                });
            } catch (toolErr) {
                console.error(`[ai-visibility mcp] tool ${name} failed:`, toolErr);
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
        console.error('[ai-visibility mcp] rpc error:', e);
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

/** Smithery / registry: static metadata when automatic scanning is skipped. */
export function buildAiVisibilityServerCard() {
    return {
        serverInfo: SERVER_INFO,
        authentication: { required: true, schemes: ['oauth2'] },
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
        prompts: PROMPTS.map((p) => ({ name: p.name, description: p.description, arguments: [] })),
        resources: [],
    };
}

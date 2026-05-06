/**
 * Static MCP server card for registries (e.g. Smithery) when OAuth + Streamable HTTP
 * scanning is fragile. See https://smithery.ai/docs/build/publish#static-server-card-manual-metadata
 *
 * Describes the AI visibility / AEO connector (https://www.sellonllm.com/api/mcp-ai-visibility).
 */
import { buildAiVisibilityServerCard } from '../mcp-ai-visibility/index.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET, OPTIONS');
        return res.status(405).json({ error: 'method_not_allowed' });
    }
    const body = buildAiVisibilityServerCard();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(body);
}

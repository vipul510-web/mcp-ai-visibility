import { requireUser } from '../auth.js';
import { getSql, ensureSchema } from '../db.js';
import { decrypt } from '../crypto.js';
import { getUserOAuthClient } from '../google.js';
import { google } from 'googleapis';

const DEFAULT_DATE_RANGE = { startDate: '28daysAgo', endDate: 'yesterday' };

async function loadUserKey(userId) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
        SELECT provider, encrypted_key
        FROM user_secrets WHERE user_id = ${userId}
        ORDER BY updated_at DESC LIMIT 1
    `;
    if (!rows.length) return null;
    return { provider: rows[0].provider, apiKey: decrypt(rows[0].encrypted_key) };
}

async function fetchGa4Snapshot(auth, propertyId) {
    const data = google.analyticsdata({ version: 'v1beta', auth });
    const property = `properties/${propertyId}`;
    const [traffic, topPages, sources, countries] = await Promise.all([
        data.properties.runReport({
            property,
            requestBody: {
                dateRanges: [DEFAULT_DATE_RANGE],
                dimensions: [{ name: 'date' }],
                metrics: [
                    { name: 'sessions' },
                    { name: 'totalUsers' },
                    { name: 'engagedSessions' },
                    { name: 'conversions' },
                ],
                orderBys: [{ dimension: { dimensionName: 'date' } }],
                limit: 60,
            },
        }),
        data.properties.runReport({
            property,
            requestBody: {
                dateRanges: [DEFAULT_DATE_RANGE],
                dimensions: [{ name: 'pagePath' }],
                metrics: [
                    { name: 'sessions' },
                    { name: 'totalUsers' },
                    { name: 'engagementRate' },
                    { name: 'averageSessionDuration' },
                    { name: 'bounceRate' },
                ],
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                limit: 20,
            },
        }),
        data.properties.runReport({
            property,
            requestBody: {
                dateRanges: [DEFAULT_DATE_RANGE],
                dimensions: [
                    { name: 'sessionDefaultChannelGroup' },
                    { name: 'sessionSource' },
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'totalUsers' },
                    { name: 'conversions' },
                ],
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                limit: 15,
            },
        }),
        data.properties.runReport({
            property,
            requestBody: {
                dateRanges: [DEFAULT_DATE_RANGE],
                dimensions: [{ name: 'country' }],
                metrics: [{ name: 'sessions' }, { name: 'conversions' }],
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                limit: 10,
            },
        }),
    ]);
    return {
        traffic: reportToRows(traffic.data),
        topPages: reportToRows(topPages.data),
        sources: reportToRows(sources.data),
        countries: reportToRows(countries.data),
    };
}

function reportToRows(report) {
    const dims = (report.dimensionHeaders || []).map(h => h.name);
    const mets = (report.metricHeaders || []).map(h => h.name);
    return (report.rows || []).map(r => {
        const row = {};
        (r.dimensionValues || []).forEach((v, i) => { row[dims[i]] = v.value; });
        (r.metricValues || []).forEach((v, i) => {
            const n = Number(v.value);
            row[mets[i]] = Number.isFinite(n) ? n : v.value;
        });
        return row;
    });
}

async function fetchGscSnapshot(auth, siteUrl) {
    const wm = google.webmasters({ version: 'v3', auth });
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 28);
    const fmt = d => d.toISOString().slice(0, 10);
    const body = {
        startDate: fmt(start),
        endDate: fmt(end),
        rowLimit: 25,
    };
    const [queries, pages, countries, devices] = await Promise.all([
        wm.searchanalytics.query({ siteUrl, requestBody: { ...body, dimensions: ['query'] } }),
        wm.searchanalytics.query({ siteUrl, requestBody: { ...body, dimensions: ['page'] } }),
        wm.searchanalytics.query({ siteUrl, requestBody: { ...body, dimensions: ['country'], rowLimit: 10 } }),
        wm.searchanalytics.query({ siteUrl, requestBody: { ...body, dimensions: ['device'], rowLimit: 5 } }),
    ]);
    const mapRows = r => (r.data.rows || []).map(row => ({
        keys: row.keys,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Number((row.ctr * 100).toFixed(2)),
        position: Number(row.position?.toFixed(2)),
    }));
    return {
        topQueries: mapRows(queries),
        topPages: mapRows(pages),
        countries: mapRows(countries),
        devices: mapRows(devices),
    };
}

function buildSystemPrompt(snapshot) {
    return `You are an expert SEO consultant analyzing a site's Google Analytics 4 and Google Search Console data. Your job: answer the user's question with concrete, prioritized, actionable SEO recommendations.

Ground every recommendation in the data below. Be specific: cite exact pages, queries, CTR numbers, positions, and trends. Use short paragraphs and numbered or bulleted lists. When you recommend an action, state the expected impact and how to measure it.

If the data is insufficient to answer confidently, say so and tell the user what additional data to pull.

=== DATA WINDOW: last 28 days ===

=== Google Analytics 4 ===
Daily traffic (sessions/users/engaged/conversions):
${JSON.stringify(snapshot.ga?.traffic || [], null, 2)}

Top pages by sessions:
${JSON.stringify(snapshot.ga?.topPages || [], null, 2)}

Top channels & sources:
${JSON.stringify(snapshot.ga?.sources || [], null, 2)}

Top countries:
${JSON.stringify(snapshot.ga?.countries || [], null, 2)}

=== Google Search Console ===
Top queries (clicks, impressions, ctr%, avg position):
${JSON.stringify(snapshot.gsc?.topQueries || [], null, 2)}

Top pages in search:
${JSON.stringify(snapshot.gsc?.topPages || [], null, 2)}

Countries:
${JSON.stringify(snapshot.gsc?.countries || [], null, 2)}

Devices:
${JSON.stringify(snapshot.gsc?.devices || [], null, 2)}

Format your response in clean Markdown. Start with a 1-2 sentence executive summary, then the prioritized recommendations. Keep it under 800 words.`;
}

async function callAnthropic(apiKey, system, user) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            system,
            messages: [{ role: 'user', content: user }],
        }),
    });
    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Anthropic API error ${resp.status}: ${txt}`);
    }
    const data = await resp.json();
    return data.content?.map(c => c.text).join('\n') || '';
}

async function callOpenAI(apiKey, system, user) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
        }),
    });
    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`OpenAI API error ${resp.status}: ${txt}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
}

export default async function handler(req, res) {
    const session = requireUser(req, res);
    if (!session) return;
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const { question, propertyId, siteUrl } = req.body || {};
        if (!question || !String(question).trim()) {
            return res.status(400).json({ error: 'question is required' });
        }
        if (!propertyId && !siteUrl) {
            return res.status(400).json({ error: 'Select at least one GA4 property or GSC site' });
        }

        const userKey = await loadUserKey(session.uid);
        if (!userKey) {
            return res.status(400).json({ error: 'No LLM API key saved. Add your Anthropic or OpenAI key first.' });
        }

        const auth = await getUserOAuthClient(session.uid);
        const snapshot = {};
        const errors = {};
        if (propertyId) {
            try { snapshot.ga = await fetchGa4Snapshot(auth, propertyId); }
            catch (e) { errors.ga = e?.response?.data?.error?.message || e.message; }
        }
        if (siteUrl) {
            try { snapshot.gsc = await fetchGscSnapshot(auth, siteUrl); }
            catch (e) { errors.gsc = e?.response?.data?.error?.message || e.message; }
        }
        if (!snapshot.ga && !snapshot.gsc) {
            return res.status(502).json({ error: 'Could not load any data from Google', details: errors });
        }

        const system = buildSystemPrompt(snapshot);
        const answer = userKey.provider === 'anthropic'
            ? await callAnthropic(userKey.apiKey, system, String(question))
            : await callOpenAI(userKey.apiKey, system, String(question));

        return res.status(200).json({
            answer,
            provider: userKey.provider,
            dataErrors: Object.keys(errors).length ? errors : undefined,
        });
    } catch (err) {
        console.error('chat error:', err);
        return res.status(500).json({ error: err.message });
    }
}

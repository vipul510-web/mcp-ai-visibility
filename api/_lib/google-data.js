import { google } from 'googleapis';

const DEFAULT_RANGE = { startDate: '28daysAgo', endDate: 'yesterday' };

/* ===================== Helpers ===================== */

export function reportToRows(report) {
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

function dateDaysAgo(n) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}

/* ===================== GA4 ===================== */

export async function listGa4Properties(auth) {
    const admin = google.analyticsadmin({ version: 'v1beta', auth });
    const resp = await admin.accountSummaries.list({ pageSize: 200 });
    const summaries = resp.data.accountSummaries || [];
    const out = [];
    for (const s of summaries) {
        for (const p of (s.propertySummaries || [])) {
            out.push({
                account: s.displayName,
                propertyId: (p.property || '').replace('properties/', ''),
                property: p.property,
                displayName: p.displayName,
            });
        }
    }
    return out;
}

/**
 * Run a GA4 report.
 * dateRange: { startDate, endDate } each as YYYY-MM-DD or relative ('28daysAgo', 'yesterday').
 */
export async function runGa4Report(auth, {
    propertyId,
    dimensions = [],
    metrics = [],
    dateRange = DEFAULT_RANGE,
    orderBys,
    limit = 25,
    dimensionFilter,
}) {
    const data = google.analyticsdata({ version: 'v1beta', auth });
    const resp = await data.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
            dateRanges: [dateRange],
            dimensions: dimensions.map(n => ({ name: n })),
            metrics: metrics.map(n => ({ name: n })),
            orderBys,
            limit,
            dimensionFilter,
        },
    });
    return reportToRows(resp.data);
}

export async function fetchGa4Snapshot(auth, propertyId) {
    const [traffic, topPages, sources, countries] = await Promise.all([
        runGa4Report(auth, {
            propertyId,
            dimensions: ['date'],
            metrics: ['sessions', 'totalUsers', 'engagedSessions', 'conversions'],
            orderBys: [{ dimension: { dimensionName: 'date' } }],
            limit: 60,
        }),
        runGa4Report(auth, {
            propertyId,
            dimensions: ['pagePath'],
            metrics: ['sessions', 'totalUsers', 'engagementRate', 'averageSessionDuration', 'bounceRate'],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 20,
        }),
        runGa4Report(auth, {
            propertyId,
            dimensions: ['sessionDefaultChannelGroup', 'sessionSource'],
            metrics: ['sessions', 'totalUsers', 'conversions'],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 15,
        }),
        runGa4Report(auth, {
            propertyId,
            dimensions: ['country'],
            metrics: ['sessions', 'conversions'],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 10,
        }),
    ]);
    return { traffic, topPages, sources, countries };
}

export async function compareGa4Periods(auth, propertyId, days = 28) {
    const end = dateDaysAgo(1);
    const startCurr = dateDaysAgo(days);
    const endPrev = dateDaysAgo(days + 1);
    const startPrev = dateDaysAgo(days * 2);
    const [curr, prev] = await Promise.all([
        runGa4Report(auth, {
            propertyId,
            dimensions: ['pagePath'],
            metrics: ['sessions', 'totalUsers'],
            dateRange: { startDate: startCurr, endDate: end },
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 100,
        }),
        runGa4Report(auth, {
            propertyId,
            dimensions: ['pagePath'],
            metrics: ['sessions', 'totalUsers'],
            dateRange: { startDate: startPrev, endDate: endPrev },
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 100,
        }),
    ]);
    const prevMap = new Map(prev.map(r => [r.pagePath, r]));
    const merged = curr.map(r => {
        const p = prevMap.get(r.pagePath) || { sessions: 0, totalUsers: 0 };
        const delta = r.sessions - p.sessions;
        const pct = p.sessions > 0 ? (delta / p.sessions) * 100 : null;
        return {
            pagePath: r.pagePath,
            sessionsCurrent: r.sessions,
            sessionsPrevious: p.sessions,
            sessionsDelta: delta,
            sessionsPctChange: pct == null ? null : Number(pct.toFixed(1)),
        };
    });
    return {
        periods: { current: { startDate: startCurr, endDate: end }, previous: { startDate: startPrev, endDate: endPrev } },
        pages: merged,
    };
}

/* ===================== Search Console ===================== */

export async function listGscSites(auth) {
    const wm = google.webmasters({ version: 'v3', auth });
    const resp = await wm.sites.list({});
    return (resp.data.siteEntry || []).map(s => ({
        siteUrl: s.siteUrl,
        permissionLevel: s.permissionLevel,
    }));
}

export async function runGscQuery(auth, {
    siteUrl,
    dimensions = ['query'],
    dateRange,
    rowLimit = 25,
    searchType = 'web',
    dimensionFilterGroups,
}) {
    const wm = google.webmasters({ version: 'v3', auth });
    const end = dateRange?.endDate || dateDaysAgo(1);
    const start = dateRange?.startDate || dateDaysAgo(29);
    const resp = await wm.searchanalytics.query({
        siteUrl,
        requestBody: {
            startDate: start,
            endDate: end,
            dimensions,
            rowLimit,
            type: searchType,
            dimensionFilterGroups,
        },
    });
    return (resp.data.rows || []).map(r => ({
        keys: r.keys,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Number((r.ctr * 100).toFixed(2)),
        position: Number((r.position || 0).toFixed(2)),
    }));
}

export async function fetchGscSnapshot(auth, siteUrl) {
    const end = dateDaysAgo(1);
    const start = dateDaysAgo(29);
    const dr = { startDate: start, endDate: end };
    const [topQueries, topPages, countries, devices] = await Promise.all([
        runGscQuery(auth, { siteUrl, dimensions: ['query'], dateRange: dr, rowLimit: 25 }),
        runGscQuery(auth, { siteUrl, dimensions: ['page'], dateRange: dr, rowLimit: 25 }),
        runGscQuery(auth, { siteUrl, dimensions: ['country'], dateRange: dr, rowLimit: 10 }),
        runGscQuery(auth, { siteUrl, dimensions: ['device'], dateRange: dr, rowLimit: 5 }),
    ]);
    return { topQueries, topPages, countries, devices };
}

export async function findCtrOpportunities(auth, siteUrl, { minImpressions = 200, maxPosition = 15, limit = 25 } = {}) {
    const rows = await runGscQuery(auth, {
        siteUrl,
        dimensions: ['query', 'page'],
        rowLimit: 1000,
    });
    const filtered = rows
        .filter(r => r.impressions >= minImpressions && r.position <= maxPosition)
        .map(r => ({ ...r, expectedCtrAtPos: expectedCtrByPos(r.position), gap: Number((expectedCtrByPos(r.position) - r.ctr).toFixed(2)) }))
        .filter(r => r.gap > 0)
        .sort((a, b) => (b.impressions * b.gap) - (a.impressions * a.gap))
        .slice(0, limit);
    return filtered;
}

export async function findRankingOpportunities(auth, siteUrl, { minPos = 4, maxPos = 15, minImpressions = 100, limit = 25 } = {}) {
    const rows = await runGscQuery(auth, {
        siteUrl,
        dimensions: ['query', 'page'],
        rowLimit: 1000,
    });
    return rows
        .filter(r => r.position >= minPos && r.position <= maxPos && r.impressions >= minImpressions)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, limit);
}

// Rough industry averages; used only to prioritise opportunities.
function expectedCtrByPos(pos) {
    const p = Math.round(pos);
    const table = { 1: 30, 2: 15, 3: 10, 4: 7, 5: 5, 6: 4, 7: 3, 8: 2.5, 9: 2, 10: 1.8 };
    if (p <= 10) return table[p] ?? 1.5;
    if (p <= 20) return 1;
    return 0.5;
}

// Vercel Serverless Function to generate LLM.txt files
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Validate URL
        const baseUrl = new URL(url);
        const domain = baseUrl.hostname;
        
        // Fetch website data
        const siteData = await analyzeWebsite(baseUrl.toString());
        
        // Generate LLM.txt content
        const llmTxt = generateLLMTxt(siteData, domain, baseUrl.toString());
        
        res.status(200).json({ llmTxt });
        
    } catch (error) {
        console.error('LLM.txt generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate LLM.txt file',
            message: error.message 
        });
    }
}

async function analyzeWebsite(baseUrl) {
    const data = {
        domain: new URL(baseUrl).hostname,
        homepage: baseUrl,
        title: '',
        description: '',
        sitemap: null,
        robotsTxt: null,
        mainPages: [],
        blogPosts: [],
        contact: null,
        email: null
    };

    try {
        // Fetch homepage
        const homepageResponse = await fetch(baseUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LLMTxtGenerator/1.0)'
            },
            timeout: 10000
        });

        if (homepageResponse.ok) {
            const html = await homepageResponse.text();
            const $ = cheerio.load(html);
            
            // Extract title and description
            data.title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
            data.description = $('meta[name="description"]').attr('content') || 
                             $('meta[property="og:description"]').attr('content') || '';
            
            // Extract organization info from JSON-LD
            $('script[type="application/ld+json"]').each((i, el) => {
                try {
                    const json = JSON.parse($(el).html());
                    if (json['@type'] === 'Organization') {
                        if (json.name) data.title = data.title || json.name;
                        if (json.email) data.email = json.email;
                        if (json.url) data.homepage = json.url;
                    }
                } catch (e) {
                    // Invalid JSON, skip
                }
            });
            
            // Find main navigation links
            $('nav a, header a, .nav a, .menu a').each((i, el) => {
                const href = $(el).attr('href');
                if (href) {
                    try {
                        const fullUrl = new URL(href, baseUrl).toString();
                        if (fullUrl.startsWith(baseUrl) && !data.mainPages.includes(fullUrl)) {
                            const text = $(el).text().trim();
                            if (text && text.length < 50) {
                                data.mainPages.push({ url: fullUrl, title: text });
                            }
                        }
                    } catch (e) {
                        // Invalid URL, skip
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error fetching homepage:', error);
    }

    // Try to find sitemap
    try {
        const sitemapUrl = new URL('/sitemap.xml', baseUrl).toString();
        const sitemapResponse = await fetch(sitemapUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LLMTxtGenerator/1.0)' },
            timeout: 5000
        });
        
        if (sitemapResponse.ok) {
            data.sitemap = sitemapUrl;
            const sitemapXml = await sitemapResponse.text();
            const $ = cheerio.load(sitemapXml, { xmlMode: true });
            
            // Extract URLs from sitemap
            $('url loc').each((i, el) => {
                const url = $(el).text().trim();
                if (url && url.startsWith(baseUrl)) {
                    // Try to identify blog posts
                    if (url.includes('/blog/') || url.includes('/post/') || url.includes('/article/')) {
                        data.blogPosts.push(url);
                    } else if (!data.mainPages.find(p => p.url === url)) {
                        // Extract title if available
                        const titleEl = $(el).siblings('title');
                        const title = titleEl.length ? titleEl.text().trim() : '';
                        data.mainPages.push({ url, title });
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error fetching sitemap:', error);
    }

    // Try to find robots.txt
    try {
        const robotsUrl = new URL('/robots.txt', baseUrl).toString();
        const robotsResponse = await fetch(robotsUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LLMTxtGenerator/1.0)' },
            timeout: 5000
        });
        
        if (robotsResponse.ok) {
            data.robotsTxt = robotsUrl;
        }
    } catch (error) {
        // robots.txt not found, that's okay
    }

    // Limit main pages to top 10
    data.mainPages = data.mainPages.slice(0, 10);
    data.blogPosts = data.blogPosts.slice(0, 10);

    return data;
}

function generateLLMTxt(siteData, domain, baseUrl) {
    const lines = [];
    
    // Header
    lines.push(`# llm.txt for ${domain}`);
    lines.push(`# This file helps AI language models understand and discover content on our site`);
    lines.push(`# Format: https://llmtext.wtf/`);
    lines.push('');
    
    // Contact & Organization Information
    lines.push(`# Contact & Organization Information`);
    if (siteData.title) {
        lines.push(`Company: ${siteData.title}`);
    }
    if (siteData.description) {
        lines.push(`Description: ${siteData.description}`);
    }
    lines.push(`Website: ${baseUrl}`);
    if (siteData.email) {
        lines.push(`Email: ${siteData.email}`);
    }
    lines.push('');
    
    // Sitemap Location
    if (siteData.sitemap) {
        lines.push(`# Sitemap Location`);
        lines.push(`Sitemap: ${siteData.sitemap}`);
        lines.push('');
    }
    
    // Key Content Paths
    lines.push(`# Key Content Paths`);
    lines.push(`# Main Pages`);
    lines.push(`- ${baseUrl} (Homepage)`);
    
    // Add main pages
    siteData.mainPages.forEach(page => {
        const title = page.title ? ` (${page.title})` : '';
        lines.push(`- ${page.url}${title}`);
    });
    
    // Add blog posts if found
    if (siteData.blogPosts.length > 0) {
        lines.push('');
        lines.push(`# Blog Posts`);
        siteData.blogPosts.forEach(post => {
            lines.push(`- ${post}`);
        });
    }
    
    lines.push('');
    lines.push(`# Last Updated`);
    lines.push(`Last Updated: ${new Date().toISOString().split('T')[0]}`);
    
    return lines.join('\n');
}


// Vercel Serverless Function to analyze a page for LLM readiness
// Used by Chrome extension for competitor comparison
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    // Handle OPTIONS request FIRST (before any other logic) to avoid redirect issues
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        return res.status(200).end();
    }

    // Enable CORS for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Validate URL
        const urlObj = new URL(url);
        
        // Fetch and analyze the page
        const checks = await analyzePage(url);
        
        res.status(200).json({ 
            checks,
            url 
        });
        
    } catch (error) {
        console.error('Page analysis error:', error);
        res.status(500).json({ 
            error: 'Failed to analyze page',
            message: error.message 
        });
    }
}

async function analyzePage(url) {
    const urlObj = new URL(url);
    const checks = {};
    
    try {
        // Fetch the page
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SellOnLLM/1.0; +https://sellonllm.com)'
            },
            signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // 1. SSL Enabled
        checks.ssl_enabled = {
            pass: url.startsWith('https://'),
            details: url.startsWith('https://') ? 'Site uses HTTPS.' : 'Site does not use HTTPS.',
            recommendation: url.startsWith('https://') 
                ? 'Great! Your site uses HTTPS which is essential for security and LLM trust.'
                : 'Enable HTTPS/SSL for your website.'
        };
        
        // 2. Meta Title
        const title = $('head title').text().trim();
        const titlePass = title.length > 0 && title.length <= 60;
        checks.meta_titles_present = {
            pass: titlePass,
            details: title 
                ? `Meta title found: "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}"`
                : 'No meta title found.',
            value: { title },
            recommendation: titlePass
                ? 'Your meta title is well-optimized for search engines and LLMs.'
                : title.length > 60
                    ? 'Shorten your meta title to 50-60 characters for optimal display.'
                    : 'Add a descriptive meta title tag in your <head> section.'
        };
        
        // 3. Meta Description
        const metaDesc = $('head meta[name="description"]').attr('content') || '';
        const descPass = metaDesc.length >= 120 && metaDesc.length <= 160;
        checks.meta_descriptions_present = {
            pass: descPass,
            details: metaDesc 
                ? `Meta description found: "${metaDesc.substring(0, 80)}..."`
                : 'No meta description found.',
            value: { description: metaDesc },
            recommendation: descPass
                ? 'Your meta description is well-optimized for search engines and LLMs.'
                : metaDesc.length > 160
                    ? 'Shorten your meta description to 120-160 characters.'
                    : 'Add a meta description tag in your <head> section.'
        };
        
        // 4. Structured Data
        const jsonLdScripts = $('script[type="application/ld+json"]');
        let hasData = false;
        const types = [];
        
        jsonLdScripts.each((i, el) => {
            try {
                const data = JSON.parse($(el).html());
                const items = Array.isArray(data) ? data : [data];
                items.forEach(item => {
                    if (item['@type']) {
                        hasData = true;
                        types.push(item['@type']);
                    }
                });
            } catch (e) {
                // Ignore parse errors
            }
        });
        
        const essentialTypes = ['Organization', 'WebSite', 'WebPage', 'Article', 'Product'];
        const foundEssential = essentialTypes.some(type => 
            types.some(found => found.toLowerCase().includes(type.toLowerCase()))
        );
        
        checks.structured_data_basic = {
            pass: hasData && foundEssential,
            details: hasData 
                ? `Found structured data: ${[...new Set(types)].join(', ')}`
                : 'No structured data found.',
            value: { types: [...new Set(types)] },
            recommendation: hasData && foundEssential
                ? 'Your page has proper structured data for LLM understanding.'
                : 'Add structured data (JSON-LD) to help LLMs understand your page content.'
        };
        
        // 5. Open Graph Tags
        const ogTitle = $('meta[property="og:title"]').length;
        const ogDesc = $('meta[property="og:description"]').length;
        const ogImage = $('meta[property="og:image"]').length;
        const ogUrl = $('meta[property="og:url"]').length;
        const ogCount = ogTitle + ogDesc + ogImage + ogUrl;
        
        checks.open_graph_tags = {
            pass: ogCount >= 3,
            details: `Open Graph tags present (${ogCount}/4 required tags).`,
            value: { hasTitle: !!ogTitle, hasDescription: !!ogDesc, hasImage: !!ogImage, hasUrl: !!ogUrl },
            recommendation: ogCount >= 3
                ? 'Your page has proper Open Graph tags for social sharing and LLM understanding.'
                : 'Add Open Graph meta tags (og:title, og:description, og:image, og:url).'
        };
        
        // 6. Twitter Cards
        const twCard = $('meta[name="twitter:card"]').length;
        const twTitle = $('meta[name="twitter:title"]').length;
        const twDesc = $('meta[name="twitter:description"]').length;
        const twImage = $('meta[name="twitter:image"]').length;
        const twCount = twCard + twTitle + twDesc + twImage;
        
        checks.twitter_cards = {
            pass: twCount >= 3,
            details: `Twitter Card tags present (${twCount}/4 recommended tags).`,
            value: { hasCard: !!twCard, hasTitle: !!twTitle, hasDescription: !!twDesc, hasImage: !!twImage },
            recommendation: twCount >= 3
                ? 'Your page has proper Twitter Card tags for social sharing.'
                : 'Add Twitter Card meta tags (twitter:card, twitter:title, twitter:description, twitter:image).'
        };
        
        // 7. Content Quality
        const mainContent = $('main, article, [role="main"]').first().length 
            ? $('main, article, [role="main"]').first() 
            : $('body');
        
        // Remove scripts, styles, nav, footer
        mainContent.find('script, style, nav, footer, header, aside').remove();
        
        const text = mainContent.text() || '';
        const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
        const h1 = mainContent.find('h1').length;
        const h2 = mainContent.find('h2').length;
        const paragraphs = mainContent.find('p').length;
        
        let score = 0;
        if (wordCount >= 500) score += 30;
        else if (wordCount >= 300) score += 25;
        else if (wordCount >= 150) score += 15;
        else score += 5;
        
        if (h1 > 0 && h2 > 0) score += 25;
        else if (h1 > 0) score += 15;
        else score += 5;
        
        if (paragraphs >= 5) score += 20;
        else if (paragraphs >= 3) score += 15;
        else score += 5;
        
        const finalScore = Math.min(100, score);
        
        checks.content_quality = {
            pass: finalScore >= 60,
            details: `Content quality (${finalScore}%): ${wordCount} words, ${h1} H1, ${h2} H2, ${paragraphs} paragraphs.`,
            value: { wordCount, headingCount: { h1, h2 }, paragraphs, score: finalScore },
            recommendation: finalScore >= 60
                ? 'Your content is well-structured for LLM understanding.'
                : 'Improve content quality: aim for 300+ words, proper H1→H2 structure, and multiple paragraphs.'
        };
        
        // 8. FAQ Section
        const faqKeywords = ['faq', 'frequently asked', 'questions'];
        const faqHeadings = mainContent.find('h1, h2, h3, h4, h5, h6').filter((i, el) => {
            const text = $(el).text().toLowerCase();
            return faqKeywords.some(keyword => text.includes(keyword));
        }).length;
        
        let hasFaqSchema = false;
        jsonLdScripts.each((i, el) => {
            try {
                const data = JSON.parse($(el).html());
                const items = Array.isArray(data) ? data : [data];
                if (items.some(item => item['@type'] === 'FAQPage' || item['@type'] === 'Question')) {
                    hasFaqSchema = true;
                }
            } catch (e) {
                // Ignore
            }
        });
        
        checks.faq_section = {
            pass: faqHeadings > 0 || hasFaqSchema,
            details: hasFaqSchema 
                ? 'FAQ schema markup found.'
                : faqHeadings > 0 
                    ? `FAQ section detected (${faqHeadings} FAQ-related heading(s)).`
                    : 'No FAQ section detected.',
            value: { hasHeadings: faqHeadings > 0, hasSchema: hasFaqSchema },
            recommendation: faqHeadings > 0 || hasFaqSchema
                ? 'Great! FAQ sections help LLMs understand common questions about your content.'
                : 'Add an FAQ section with common questions and answers.'
        };
        
        // 9. LLM.txt File
        try {
            const llmTxtUrl = `${urlObj.origin}/llm.txt`;
            const llmResponse = await fetch(llmTxtUrl, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000)
            });
            checks.llm_txt_exists = {
                pass: llmResponse.ok,
                details: llmResponse.ok 
                    ? `LLM.txt file found at ${urlObj.origin}/llm.txt`
                    : 'No LLM.txt file found.',
                value: { url: llmTxtUrl, exists: llmResponse.ok },
                recommendation: llmResponse.ok
                    ? 'Excellent! Your LLM.txt file helps AI platforms understand your content structure.'
                    : 'Create an LLM.txt file at your site root (/llm.txt) to help AI platforms understand your content.'
            };
        } catch (e) {
            checks.llm_txt_exists = {
                pass: false,
                details: 'Unable to check for LLM.txt file.',
                value: { error: e.message }
            };
        }
        
        // 10. Robots.txt
        try {
            const robotsUrl = `${urlObj.origin}/robots.txt`;
            const robotsResponse = await fetch(robotsUrl, {
                signal: AbortSignal.timeout(5000)
            });
            
            if (robotsResponse.ok) {
                const robotsText = (await robotsResponse.text()).toLowerCase();
                const aiBots = ['gptbot', 'claude-web', 'perplexitybot'];
                const blocksAI = aiBots.some(bot => 
                    robotsText.includes(`user-agent: ${bot}`) && robotsText.includes('disallow: /')
                );
                
                checks.robots_txt_proper = {
                    pass: !blocksAI,
                    details: blocksAI 
                        ? 'Robots.txt may block AI crawlers.'
                        : 'Robots.txt allows AI crawlers.',
                    value: { exists: true, blocksAI },
                    recommendation: !blocksAI
                        ? 'Your robots.txt properly allows AI crawlers to access your content.'
                        : 'Update your robots.txt to explicitly allow AI crawlers: GPTBot, Claude-Web, PerplexityBot.'
                };
            } else {
                checks.robots_txt_proper = {
                    pass: true,
                    details: 'No robots.txt found (allows all crawlers by default).',
                    value: { exists: false }
                };
            }
        } catch (e) {
            checks.robots_txt_proper = {
                pass: true,
                details: 'Unable to check robots.txt.',
                value: { error: e.message }
            };
        }
        
        // 11. Sitemap
        try {
            const sitemapUrl = `${urlObj.origin}/sitemap.xml`;
            const sitemapResponse = await fetch(sitemapUrl, {
                signal: AbortSignal.timeout(5000)
            });
            
            checks.sitemap_exists = {
                pass: sitemapResponse.ok,
                details: sitemapResponse.ok 
                    ? `XML sitemap found at ${sitemapUrl}`
                    : 'No XML sitemap found.',
                value: { exists: sitemapResponse.ok, url: sitemapUrl },
                recommendation: sitemapResponse.ok
                    ? 'Excellent! Your sitemap helps AI platforms discover all your pages efficiently.'
                    : 'Create an XML sitemap and reference it in your robots.txt.'
            };
        } catch (e) {
            checks.sitemap_exists = {
                pass: false,
                details: 'Unable to check for sitemap.',
                value: { error: e.message }
            };
        }
        
        // 12. Image Optimization
        const images = $('img');
        let hasAlt = 0;
        images.each((i, el) => {
            if ($(el).attr('alt') && $(el).attr('alt').trim()) {
                hasAlt++;
            }
        });
        
        const totalImages = images.length;
        const altPercentage = totalImages > 0 ? Math.round((hasAlt / totalImages) * 100) : 100;
        
        checks.image_optimization = {
            pass: totalImages === 0 || altPercentage >= 80,
            details: totalImages === 0 
                ? 'No images found on this page.'
                : `${hasAlt}/${totalImages} images have alt text (${altPercentage}%).`,
            value: { totalImages, hasAlt, altPercentage },
            recommendation: totalImages === 0 || altPercentage >= 80
                ? 'Most images have alt text. Keep adding descriptive alt text to all images.'
                : `Add alt text to images. Alt text helps LLMs understand image content.`
        };
        
        // 13. Canonical URL
        const canonical = $('link[rel="canonical"]').attr('href');
        if (canonical) {
            try {
                const canonicalUrlObj = new URL(canonical, url);
                const isSelfReferencing = canonicalUrlObj.origin === urlObj.origin &&
                                         canonicalUrlObj.pathname === urlObj.pathname;
                checks.canonical_url = {
                    pass: isSelfReferencing,
                    details: isSelfReferencing 
                        ? `Canonical URL is self-referencing: ${canonical}`
                        : `Canonical URL points to different page: ${canonical}`,
                    value: { canonicalUrl: canonical, isSelfReferencing },
                    recommendation: isSelfReferencing
                        ? 'Your canonical URL is properly configured to avoid duplicate content issues.'
                        : 'Ensure your canonical URL points to the current page (self-referencing).'
                };
            } catch (e) {
                checks.canonical_url = {
                    pass: false,
                    details: `Canonical URL found but may be invalid: ${canonical}`,
                    value: { canonicalUrl: canonical }
                };
            }
        } else {
            checks.canonical_url = {
                pass: false,
                details: 'No canonical URL tag found.',
                value: { exists: false },
                recommendation: 'Add a canonical URL tag to prevent duplicate content issues.'
            };
        }
        
        // 14. Mobile Friendly
        const viewport = $('meta[name="viewport"]').attr('content') || '';
        const hasProperViewport = viewport.includes('width=device-width') || viewport.includes('initial-scale=1');
        
        checks.mobile_friendly = {
            pass: hasProperViewport,
            details: hasProperViewport 
                ? 'Mobile-friendly viewport meta tag found.'
                : 'No viewport meta tag found.',
            value: { hasViewport: !!viewport, viewportContent: viewport },
            recommendation: hasProperViewport
                ? 'Your page is mobile-friendly with proper viewport settings.'
                : 'Add a viewport meta tag: <meta name="viewport" content="width=device-width, initial-scale=1">.'
        };
        
    } catch (error) {
        console.error('Error analyzing page:', error);
        // Return partial results if available
        if (Object.keys(checks).length === 0) {
            throw error;
        }
    }
    
    return checks;
}


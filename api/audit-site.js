import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url, maxPages = 50 } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        new URL(url);
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    try {
        // Get site URLs from sitemap
        const siteUrls = await getSiteUrls(url, maxPages);
        
        // Audit each page
        const pageResults = await auditPages(siteUrls);
        
        // Aggregate results
        const summary = aggregateResults(pageResults);
        
        res.status(200).json({
            summary,
            pages: pageResults,
            totalPages: siteUrls.length,
            auditedPages: pageResults.length
        });

    } catch (error) {
        console.error('Site audit error:', error);
        res.status(500).json({ error: `Site audit failed: ${error.message}` });
    }
}

async function getSiteUrls(baseUrl, maxPages) {
    const urls = new Set([baseUrl]);
    
    try {
        // Try to get sitemap
        const sitemapUrls = await getSitemapUrls(baseUrl);
        sitemapUrls.forEach(url => urls.add(url));
        
        // If we don't have enough URLs, try to find internal links
        if (urls.size < maxPages) {
            const internalLinks = await getInternalLinks(baseUrl, baseUrl);
            internalLinks.forEach(link => urls.add(link));
        }
        
        // Convert to array and limit
        return Array.from(urls).slice(0, maxPages);
        
    } catch (error) {
        console.error('Error getting site URLs:', error);
        return [baseUrl]; // Fallback to just the base URL
    }
}

async function getSitemapUrls(baseUrl) {
    const urls = [];
    
    try {
        // Try common sitemap locations
        const sitemapPaths = ['/sitemap.xml', '/sitemap_index.xml', '/sitemaps.xml'];
        
        for (const path of sitemapPaths) {
            try {
                const sitemapUrl = new URL(path, baseUrl).href;
                const response = await fetch(sitemapUrl, { timeout: 10000 });
                
                if (response.ok) {
                    const sitemapContent = await response.text();
                    const sitemapUrls = parseSitemap(sitemapContent, baseUrl);
                    urls.push(...sitemapUrls);
                    break; // Use first valid sitemap
                }
            } catch (e) {
                // Continue to next sitemap path
            }
        }
    } catch (error) {
        console.error('Sitemap parsing error:', error);
    }
    
    return urls;
}

function parseSitemap(content, baseUrl) {
    const urls = [];
    
    try {
        // Parse XML sitemap
        const $ = cheerio.load(content, { xmlMode: true });
        
        // Handle sitemap index
        $('sitemap loc').each((i, el) => {
            const sitemapUrl = $(el).text().trim();
            if (sitemapUrl) {
                urls.push(sitemapUrl);
            }
        });
        
        // Handle regular sitemap
        $('url loc').each((i, el) => {
            const url = $(el).text().trim();
            if (url) {
                urls.push(url);
            }
        });
        
    } catch (error) {
        console.error('XML parsing error:', error);
    }
    
    return urls;
}

async function getInternalLinks(baseUrl, currentUrl) {
    const links = [];
    
    try {
        const response = await fetch(currentUrl, { timeout: 10000 });
        if (!response.ok) return links;
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        $('a[href]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            
            try {
                const absoluteUrl = new URL(href, baseUrl).href;
                const currentDomain = new URL(baseUrl).hostname;
                const linkDomain = new URL(absoluteUrl).hostname;
                
                // Only internal links
                if (linkDomain === currentDomain && !absoluteUrl.includes('#')) {
                    links.push(absoluteUrl);
                }
            } catch (e) {
                // Skip invalid URLs
            }
        });
        
    } catch (error) {
        console.error('Internal links error:', error);
    }
    
    return links;
}

async function auditPages(urls) {
    const results = [];
    
    // First, do site-level checks (LLM.txt, robots.txt, sitemap) on the base URL
    const baseUrl = urls[0]; // First URL is typically the base
    const siteLevelChecks = await performSiteLevelChecks(baseUrl);
    
    // Process pages in batches to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const batchPromises = batch.map(url => auditPage(url, siteLevelChecks));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches
        if (i + batchSize < urls.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return results;
}

// Perform site-level checks (LLM.txt, robots.txt, sitemap)
async function performSiteLevelChecks(baseUrl) {
    const checks = {};
    
    // Check LLM.txt
    try {
        const llmResponse = await fetch(`${baseUrl}/llm.txt`, { timeout: 5000 });
        checks.llm_txt_exists = {
            pass: llmResponse.ok,
            details: llmResponse.ok ? 'LLM.txt file found' : 'No LLM.txt file found'
        };
    } catch (error) {
        checks.llm_txt_exists = {
            pass: false,
            details: 'No LLM.txt file found'
        };
    }
    
    // Check robots.txt
    try {
        const robotsResponse = await fetch(`${baseUrl}/robots.txt`, { timeout: 5000 });
        if (robotsResponse.ok) {
            const robotsText = await robotsResponse.text();
            const blocksAI = robotsText.toLowerCase().includes('gptbot') || 
                           robotsText.toLowerCase().includes('claude-web') ||
                           robotsText.toLowerCase().includes('perplexity');
            checks.robots_txt_proper = {
                pass: !blocksAI,
                details: blocksAI ? 'Robots.txt may block AI crawlers' : 'Robots.txt allows AI crawlers'
            };
        } else {
            checks.robots_txt_proper = {
                pass: true,
                details: 'No robots.txt found (allows all crawlers)'
            };
        }
    } catch (error) {
        checks.robots_txt_proper = {
            pass: true,
            details: 'No robots.txt found (allows all crawlers)'
        };
    }
    
    // Check sitemap
    try {
        const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`, { timeout: 5000 });
        checks.sitemap_exists = {
            pass: sitemapResponse.ok,
            details: sitemapResponse.ok ? 'XML sitemap found' : 'No XML sitemap found'
        };
    } catch (error) {
        checks.sitemap_exists = {
            pass: false,
            details: 'No XML sitemap found'
        };
    }
    
    return checks;
}

async function auditPage(url, siteLevelChecks = {}) {
    const result = {
        url,
        status: 'error',
        checks: {},
        error: null
    };
    
    try {
        const response = await fetch(url, { 
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LLMAuditBot/1.0)'
            }
        });
        
        if (!response.ok) {
            result.error = `HTTP ${response.status}`;
            return result;
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        result.status = 'success';
        
        // Combine site-level checks (same for all pages) with page-level checks
        result.checks = {
            ...siteLevelChecks, // LLM.txt, robots.txt, sitemap (same for all pages)
            ...(await performPageChecks($, url)) // Page-specific checks
        };
        
    } catch (error) {
        result.error = error.message;
    }
    
    return result;
}

async function performPageChecks($, url) {
    const checks = {};
    
    // 1. SSL Enabled
    checks.ssl_enabled = {
        pass: url.startsWith('https://'),
        details: url.startsWith('https://') ? 'Site uses HTTPS.' : 'Site does not use HTTPS.'
    };
    
    // 2. Meta Title
    const title = $('head title').text().trim();
    checks.meta_titles_present = {
        pass: !!title && title.length > 0,
        details: title ? `Meta title found: "${title.substring(0, 100)}..."` : 'No meta title found.',
        value: title,
        hasTitle: !!title && title.length > 0
    };
    
    // 3. Meta Description
    const metaDescription = $('head meta[name="description"]').attr('content');
    checks.meta_descriptions_present = {
        pass: !!metaDescription && metaDescription.length > 0,
        details: metaDescription ? `Meta description found: "${metaDescription.substring(0, 200)}..."` : 'No meta description found.',
        value: metaDescription,
        hasDescription: !!metaDescription && metaDescription.length > 0
    };
    
    // 4. Content Quality Analysis
    const contentQualityResult = await analyzeContentQuality($, url);
    checks.content_quality = {
        pass: contentQualityResult.overallScore >= 60,
        details: contentQualityResult.summary,
        value: contentQualityResult,
        percentage: contentQualityResult.overallScore
    };
    
    // 5. Enhanced Structured Data Analysis
    const structuredDataResult = analyzeStructuredData($);
    checks.structured_data_basic = {
        pass: structuredDataResult.hasData,
        details: structuredDataResult.details,
        value: structuredDataResult
    };
    
    // 6. Enhanced Mobile Friendliness
    const mobileResult = analyzeMobileFriendliness($);
    checks.mobile_friendly = {
        pass: mobileResult.isMobileFriendly,
        details: mobileResult.details,
        value: mobileResult
    };
    
    // 7. Open Graph Tags
    const ogResult = analyzeOpenGraph($);
    checks.open_graph_tags = {
        pass: ogResult.hasRequiredTags,
        details: ogResult.details,
        value: ogResult
    };
    
    // 7. Twitter Cards
    const twitterResult = analyzeTwitterCards($);
    checks.twitter_cards = {
        pass: twitterResult.hasRequiredTags,
        details: twitterResult.details,
        value: twitterResult
    };
    
    // 8. Image Optimization
    const imageResult = analyzeImages($);
    checks.image_optimization = {
        pass: imageResult.isOptimized,
        details: imageResult.details,
        value: imageResult
    };
    
    return checks;
}

function analyzeStructuredData($) {
    const jsonLdScripts = $('script[type="application/ld+json"]');
    const microdataItems = $('[itemscope]');
    const rdfaItems = $('[typeof]');
    
    console.log('Structured data analysis:', {
        jsonLdCount: jsonLdScripts.length,
        microdataCount: microdataItems.length,
        rdfaCount: rdfaItems.length
    });
    
    const result = {
        hasData: false,
        types: [],
        details: 'No structured data found.',
        jsonLd: [],
        microdata: microdataItems.length,
        rdfa: rdfaItems.length,
        missing: [],
        recommendations: []
    };
    
    // Essential schema types for LLM visibility
    const essentialTypes = ['Organization', 'WebSite', 'WebPage', 'Article', 'Product', 'LocalBusiness'];
    const foundTypes = [];
    
    if (jsonLdScripts.length > 0) {
        result.hasData = true;
        
        jsonLdScripts.each((i, script) => {
            try {
                const content = $(script).html();
                console.log('Parsing JSON-LD script:', content.substring(0, 200) + '...');
                const data = JSON.parse(content);
                
                // Handle arrays and single objects
                const items = Array.isArray(data) ? data : [data];
                
                items.forEach(item => {
                    if (item['@type']) {
                        const type = item['@type'];
                        console.log('Found schema type:', type);
                        result.types.push(type);
                        foundTypes.push(type);
                        
                        // Validate schema structure
                        const validation = validateSchemaStructure(type, item);
                        
                        result.jsonLd.push({
                            type: type,
                            name: item.name || item.headline || 'Unknown',
                            url: item.url || item.mainEntityOfPage || null,
                            hasName: !!(item.name || item.headline),
                            hasDescription: !!item.description,
                            hasUrl: !!(item.url || item.mainEntityOfPage),
                            validation: validation
                        });
                    }
                });
                
            } catch (e) {
                console.error('JSON-LD parsing error:', e);
                console.error('Failed content:', $(script).html().substring(0, 500));
            }
        });
        
        const uniqueTypes = [...new Set(result.types)];
        const missingEssential = essentialTypes.filter(type => 
            !foundTypes.some(found => found.toLowerCase().includes(type.toLowerCase()))
        );
        
        if (missingEssential.length > 0) {
            result.missing = missingEssential;
            result.recommendations.push(`Missing essential schema types: ${missingEssential.join(', ')}`);
        }
        
        // Check for missing properties
        const hasOrganization = foundTypes.some(t => t.toLowerCase().includes('organization'));
        const hasWebsite = foundTypes.some(t => t.toLowerCase().includes('website'));
        
        if (!hasOrganization) {
            result.recommendations.push('Add Organization schema with name, description, and contact info');
        }
        if (!hasWebsite) {
            result.recommendations.push('Add WebSite schema with searchAction for better AI discovery');
        }
        
        // Create detailed breakdown
        const typeCounts = {};
        result.types.forEach(type => {
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        
        const foundDetails = Object.entries(typeCounts)
            .map(([type, count]) => `${type} (${count} item${count > 1 ? 's' : ''})`)
            .join(', ');
        
        result.details = `Found: ${foundDetails}`;
        result.typeCounts = typeCounts;
        
    } else if (result.microdata > 0 || result.rdfa > 0) {
        result.hasData = true;
        
        // Try to extract types from microdata
        if (result.microdata > 0) {
            microdataItems.each((i, item) => {
                const itemType = $(item).attr('itemtype');
                if (itemType) {
                    const type = itemType.split('/').pop();
                    result.types.push(type);
                    foundTypes.push(type);
                    console.log('Found microdata type:', type);
                }
            });
        }
        
        // Try to extract types from RDFa
        if (result.rdfa > 0) {
            rdfaItems.each((i, item) => {
                const itemType = $(item).attr('typeof');
                if (itemType) {
                    const type = itemType.split(':').pop();
                    result.types.push(type);
                    foundTypes.push(type);
                    console.log('Found RDFa type:', type);
                }
            });
        }
        
        const uniqueTypes = [...new Set(result.types)];
        const missingEssential = essentialTypes.filter(type => 
            !foundTypes.some(found => found.toLowerCase().includes(type.toLowerCase()))
        );
        
        if (missingEssential.length > 0) {
            result.missing = missingEssential;
        }
        
        result.details = `Found microdata (${result.microdata}) or RDFa (${result.rdfa}) structured data${uniqueTypes.length > 0 ? `: ${uniqueTypes.join(', ')}` : ''}`;
        result.recommendations.push('Consider upgrading to JSON-LD format for better AI compatibility');
    } else {
        // No structured data found
        result.missing = essentialTypes;
        result.recommendations = [
            'Add Organization schema with business information',
            'Add WebSite schema for better AI discovery',
            'Add WebPage schema for each page',
            'Consider Article schema for blog posts',
            'Add Product schema for e-commerce items'
        ];
    }
    
    return result;
}

// Comprehensive content quality analysis for LLM visibility
async function analyzeContentQuality($, url) {
    const result = {
        overallScore: 0,
        summary: '',
        checks: {},
        recommendations: [],
        pageSpecific: {
            url: url,
            wordCount: 0,
            hasFaqSection: false,
            headingCount: { h1: 0, h2: 0, h3: 0, h4: 0 },
            internalLinks: 0,
            imagesWithAlt: 0,
            totalImages: 0,
            avgSentenceLength: 0
        }
    };
    
    // 1. Content Length Analysis
    const mainContent = $('main, article, .content, #content, .post-content, .entry-content').first();
    const bodyText = mainContent.length > 0 ? mainContent.text() : $('body').text();
    const wordCount = bodyText.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    // Store page-specific data
    result.pageSpecific.wordCount = wordCount;
    
    // Content length criteria: 500+ words is excellent, 300+ is good, 150+ is fair
    let contentLengthScore, contentLengthStatus, contentLengthRecommendation;
    
    if (wordCount >= 500) {
        contentLengthScore = 100;
        contentLengthStatus = 'excellent';
        contentLengthRecommendation = null;
    } else if (wordCount >= 300) {
        contentLengthScore = 80;
        contentLengthStatus = 'good';
        contentLengthRecommendation = null;
    } else if (wordCount >= 150) {
        contentLengthScore = 60;
        contentLengthStatus = 'fair';
        contentLengthRecommendation = 'Add more content (300+ words recommended for better AI visibility)';
    } else {
        contentLengthScore = 30;
        contentLengthStatus = 'poor';
        contentLengthRecommendation = 'Content too short - add substantial content (300+ words minimum)';
    }
    
    result.checks.contentLength = {
        wordCount: wordCount,
        score: contentLengthScore,
        status: contentLengthStatus,
        recommendation: contentLengthRecommendation
    };
    
    // 2. FAQ Section Detection - Enhanced
    const faqKeywords = ['faq', 'frequently asked', 'questions', 'answers', 'q&a', 'q and a'];
    
    // Look for FAQ-specific patterns
    let hasFaqSection = false;
    let faqScore = 0;
    
    // Method 1: Check for FAQ headings
    const faqHeadings = $('h1, h2, h3, h4, h5, h6').filter((i, el) => {
        const text = $(el).text().toLowerCase();
        return faqKeywords.some(keyword => text.includes(keyword));
    });
    
    if (faqHeadings.length > 0) {
        hasFaqSection = true;
        faqScore += 40;
    }
    
    // Method 2: Check for FAQ-specific HTML patterns
    const faqPatterns = [
        // Common FAQ class/ID patterns
        $('.faq, #faq, .faqs, #faqs, .frequently-asked-questions, .questions-answers'),
        // Q&A patterns
        $('.q-a, .qna, .questions, .answers'),
        // Accordion patterns (common for FAQs)
        $('[data-faq], [data-accordion], .accordion-item, .faq-item')
    ];
    
    faqPatterns.forEach(pattern => {
        if (pattern.length > 0) {
            hasFaqSection = true;
            faqScore += 30;
        }
    });
    
    // Method 3: Look for Q&A structure patterns
    const questionElements = $('dt, .question, .faq-question, [data-question]');
    const answerElements = $('dd, .answer, .faq-answer, [data-answer]');
    
    if (questionElements.length >= 3 && answerElements.length >= 3) {
        hasFaqSection = true;
        faqScore += 50;
    }
    
    // Method 4: Look for FAQ content in specific sections
    const contentSections = $('section, .content, .main-content, article');
    contentSections.each((i, section) => {
        const sectionText = $(section).text().toLowerCase();
        const hasFaqKeywords = faqKeywords.some(keyword => sectionText.includes(keyword));
        const hasQuestionMarks = (sectionText.match(/\?/g) || []).length >= 3;
        const hasMultipleQuestions = (sectionText.match(/what|how|why|when|where|which|who/gi) || []).length >= 5;
        
        if (hasFaqKeywords && (hasQuestionMarks || hasMultipleQuestions)) {
            hasFaqSection = true;
            faqScore += 20;
        }
    });
    
    // Method 5: Check for FAQ schema markup
    const faqSchema = $('script[type="application/ld+json"]').filter((i, script) => {
        try {
            const data = JSON.parse($(script).html());
            const items = Array.isArray(data) ? data : [data];
            return items.some(item => item['@type'] === 'FAQPage' || item['@type'] === 'Question');
        } catch (e) {
            return false;
        }
    });
    
    if (faqSchema.length > 0) {
        hasFaqSection = true;
        faqScore += 60; // Highest score for structured data
    }
    
    // Store page-specific data
    result.pageSpecific.hasFaqSection = hasFaqSection;
    
    // Calculate FAQ score based on detection methods
    const finalFaqScore = Math.min(100, faqScore);
    const faqStatus = finalFaqScore >= 80 ? 'excellent' : 
                     finalFaqScore >= 60 ? 'good' : 
                     finalFaqScore >= 40 ? 'fair' : 'poor';
    
    result.checks.hasFaqSection = {
        hasFaq: hasFaqSection,
        score: finalFaqScore,
        status: faqStatus,
        detectionMethods: {
            hasHeadings: faqHeadings.length > 0,
            hasHtmlPatterns: faqPatterns.some(pattern => pattern.length > 0),
            hasQaStructure: questionElements.length >= 3 && answerElements.length >= 3,
            hasContentPatterns: faqScore >= 20,
            hasSchema: faqSchema.length > 0
        },
        recommendation: finalFaqScore < 60 ? 'Improve FAQ section - add structured Q&A content with proper headings and schema markup' : null
    };
    
    // 3. Heading Structure Analysis
    const headings = {
        h1: $('h1').length,
        h2: $('h2').length,
        h3: $('h3').length,
        h4: $('h4').length
    };
    
    // Store page-specific data
    result.pageSpecific.headingCount = headings;
    
    const headingScore = Math.min(100, (headings.h1 * 30) + (headings.h2 * 20) + (headings.h3 * 10) + (headings.h4 * 5));
    const hasProperStructure = headings.h1 > 0 && headings.h2 > 0;
    
    result.checks.headingStructure = {
        headings: headings,
        score: headingScore,
        status: hasProperStructure ? 'good' : 'needs_improvement',
        recommendation: !hasProperStructure ? 'Improve heading hierarchy (H1 → H2 → H3 structure)' : null
    };
    
    // 4. Content Freshness Analysis
    const lastModified = $('meta[http-equiv="last-modified"]').attr('content') || 
                        $('meta[name="last-modified"]').attr('content');
    const publishDate = $('meta[property="article:published_time"]').attr('content') ||
                       $('time[datetime]').attr('datetime');
    
    let freshnessScore = 50; // Default neutral score
    let freshnessStatus = 'unknown';
    let freshnessRecommendation = 'Consider adding publish/update dates';
    
    if (lastModified || publishDate) {
        const dateStr = lastModified || publishDate;
        const date = new Date(dateStr);
        const daysSinceUpdate = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceUpdate < 30) {
            freshnessScore = 100;
            freshnessStatus = 'excellent';
            freshnessRecommendation = null;
        } else if (daysSinceUpdate < 90) {
            freshnessScore = 80;
            freshnessStatus = 'good';
            freshnessRecommendation = 'Consider updating content more frequently';
        } else if (daysSinceUpdate < 365) {
            freshnessScore = 60;
            freshnessStatus = 'fair';
            freshnessRecommendation = 'Content is getting stale - consider updating';
        } else {
            freshnessScore = 30;
            freshnessStatus = 'poor';
            freshnessRecommendation = 'Content is very old - needs significant updates';
        }
    }
    
    result.checks.contentFreshness = {
        score: freshnessScore,
        status: freshnessStatus,
        hasDates: !!(lastModified || publishDate),
        recommendation: freshnessRecommendation
    };
    
    // 5. Internal Linking Analysis
    const internalLinks = $('a[href^="/"], a[href*="' + new URL(url).hostname + '"]').length;
    const linkScore = Math.min(100, internalLinks * 5); // 5 points per internal link, max 100
    
    // Store page-specific data
    result.pageSpecific.internalLinks = internalLinks;
    
    result.checks.internalLinking = {
        linkCount: internalLinks,
        score: linkScore,
        status: internalLinks >= 5 ? 'good' : internalLinks >= 2 ? 'fair' : 'needs_improvement',
        recommendation: internalLinks < 5 ? 'Add more internal links to improve site navigation and AI understanding' : null
    };
    
    // 6. Image Alt Tags Analysis
    const images = $('img').length;
    const imagesWithAlt = $('img[alt]').length;
    const altTagScore = images > 0 ? (imagesWithAlt / images) * 100 : 100;
    
    // Store page-specific data
    result.pageSpecific.imagesWithAlt = imagesWithAlt;
    result.pageSpecific.totalImages = images;
    
    result.checks.imageOptimization = {
        totalImages: images,
        imagesWithAlt: imagesWithAlt,
        score: altTagScore,
        status: altTagScore >= 80 ? 'good' : altTagScore >= 50 ? 'fair' : 'needs_improvement',
        recommendation: altTagScore < 80 ? 'Add alt tags to images for better AI understanding' : null
    };
    
    // 7. Content Readability Analysis
    const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.length > 0 ? 
        sentences.reduce((sum, sentence) => sum + sentence.split(/\s+/).length, 0) / sentences.length : 0;
    
    const readabilityScore = avgSentenceLength > 0 ? 
        Math.min(100, Math.max(0, 100 - (avgSentenceLength - 15) * 5)) : 50;
    
    // Store page-specific data
    result.pageSpecific.avgSentenceLength = Math.round(avgSentenceLength);
    
    // Store additional page-specific scores for detailed breakdown
    result.pageSpecific.contentLengthScore = contentLengthScore;
    result.pageSpecific.faqScore = finalFaqScore;
    result.pageSpecific.headingScore = headingScore;
    result.pageSpecific.freshnessScore = freshnessScore;
    result.pageSpecific.linkingScore = linkScore;
    result.pageSpecific.imageScore = altTagScore;
    result.pageSpecific.readabilityScore = Math.round(readabilityScore);
    
    result.checks.readability = {
        avgSentenceLength: Math.round(avgSentenceLength),
        score: Math.round(readabilityScore),
        status: avgSentenceLength <= 20 ? 'good' : avgSentenceLength <= 25 ? 'fair' : 'needs_improvement',
        recommendation: avgSentenceLength > 20 ? 'Use shorter sentences for better readability' : null
    };
    
    // Calculate overall score
    const scores = [
        result.checks.contentLength.score,
        result.checks.hasFaqSection.score,
        result.checks.headingStructure.score,
        result.checks.contentFreshness.score,
        result.checks.internalLinking.score,
        result.checks.imageOptimization.score,
        result.checks.readability.score
    ];
    
    result.overallScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    
    // Generate summary and recommendations
    const failedChecks = Object.values(result.checks).filter(check => check.score < 70);
    const recommendations = Object.values(result.checks)
        .map(check => check.recommendation)
        .filter(rec => rec !== null);
    
    if (result.overallScore >= 80) {
        result.summary = 'Excellent content quality for AI visibility';
    } else if (result.overallScore >= 60) {
        result.summary = 'Good content quality with room for improvement';
    } else {
        result.summary = 'Content needs significant improvement for AI visibility';
    }
    
    result.recommendations = recommendations;
    result.failedChecks = failedChecks.length;
    
    return result;
}

// Comprehensive schema.org validation
function validateSchemaStructure(type, item) {
    const validation = {
        isValid: true,
        score: 0,
        maxScore: 0,
        missing: [],
        warnings: [],
        recommendations: []
    };
    
    // Define required and recommended properties for each schema type
    const schemaRequirements = {
        'Organization': {
            required: ['name'],
            recommended: ['description', 'url', 'logo', 'contactPoint', 'address', 'sameAs']
        },
        'WebSite': {
            required: ['name', 'url'],
            recommended: ['description', 'potentialAction', 'sameAs']
        },
        'WebPage': {
            required: ['@type', 'name'],
            recommended: ['description', 'url', 'datePublished', 'dateModified', 'author', 'publisher']
        },
        'Article': {
            required: ['@type', 'headline'],
            recommended: ['description', 'author', 'datePublished', 'dateModified', 'publisher', 'image']
        },
        'Product': {
            required: ['@type', 'name'],
            recommended: ['description', 'image', 'brand', 'offers', 'aggregateRating', 'review']
        },
        'LocalBusiness': {
            required: ['@type', 'name'],
            recommended: ['description', 'address', 'telephone', 'url', 'openingHours', 'priceRange']
        },
        'Person': {
            required: ['@type', 'name'],
            recommended: ['description', 'jobTitle', 'worksFor', 'url', 'image']
        },
        'Event': {
            required: ['@type', 'name', 'startDate'],
            recommended: ['description', 'location', 'organizer', 'url', 'image']
        }
    };
    
    const requirements = schemaRequirements[type] || {
        required: ['@type', 'name'],
        recommended: ['description', 'url']
    };
    
    // Calculate max score dynamically: (required × 2) + (recommended × 1)
    validation.maxScore = (requirements.required.length * 2) + requirements.recommended.length;
    
    // Check required properties
    requirements.required.forEach(prop => {
        if (!item[prop] || (typeof item[prop] === 'string' && item[prop].trim() === '')) {
            validation.isValid = false;
            validation.missing.push(`${prop} (required)`);
        } else {
            validation.score += 2; // Required properties get more points
        }
    });
    
    // Check recommended properties
    requirements.recommended.forEach(prop => {
        if (item[prop]) {
            validation.score += 1;
        } else {
            validation.missing.push(`${prop} (recommended)`);
        }
    });
    
    // Additional validation checks
    if (type === 'Organization') {
        // Check if Organization has proper contact info
        if (!item.contactPoint && !item.email && !item.telephone) {
            validation.warnings.push('Missing contact information');
            validation.recommendations.push('Add contactPoint, email, or telephone for better AI understanding');
        }
        
        // Check for social media links
        if (!item.sameAs || !Array.isArray(item.sameAs) || item.sameAs.length === 0) {
            validation.warnings.push('No social media profiles found');
            validation.recommendations.push('Add sameAs property with social media URLs');
        }
    }
    
    if (type === 'WebSite') {
        // Check for search action
        if (!item.potentialAction) {
            validation.warnings.push('No search functionality defined');
            validation.recommendations.push('Add potentialAction with SearchAction for better AI discovery');
        }
    }
    
    if (type === 'Article') {
        // Check for proper date format
        if (item.datePublished && !isValidDate(item.datePublished)) {
            validation.warnings.push('Invalid datePublished format');
            validation.recommendations.push('Use ISO 8601 date format (YYYY-MM-DD)');
        }
        
        // Check for author information
        if (!item.author || (typeof item.author === 'object' && !item.author.name)) {
            validation.warnings.push('Missing or incomplete author information');
            validation.recommendations.push('Add author with name property');
        }
    }
    
    if (type === 'Product') {
        // Check for offers
        if (!item.offers) {
            validation.warnings.push('No pricing information');
            validation.recommendations.push('Add offers property with price and availability');
        }
        
        // Check for images
        if (!item.image) {
            validation.warnings.push('No product images');
            validation.recommendations.push('Add image property for better AI understanding');
        }
    }
    
    // Calculate percentage score (cap at 100%)
    validation.scorePercentage = Math.min(100, Math.round((validation.score / validation.maxScore) * 100));
    
    return validation;
}

// Helper function to validate date format
function isValidDate(dateString) {
    if (!dateString) return false;
    
    // Check for ISO 8601 format (YYYY-MM-DD)
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDateRegex.test(dateString)) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }
    
    // Check for full ISO format
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
}

function analyzeMobileFriendliness($) {
    const viewport = $('head meta[name="viewport"]').attr('content');
    const hasViewport = !!viewport && viewport.includes('width=device-width');
    
    // Check for responsive design indicators
    const hasMediaQueries = $('link[rel="stylesheet"]').length > 0 || $('style').text().includes('@media');
    
    // Check for mobile-friendly images
    const images = $('img');
    const responsiveImages = images.filter((i, img) => {
        const $img = $(img);
        return $img.attr('srcset') || $img.attr('sizes') || $img.hasClass('responsive');
    }).length;
    
    // Check for touch-friendly elements
    const buttons = $('button, input[type="button"], input[type="submit"], a').length;
    const smallButtons = $('button, input[type="button"], input[type="submit"], a').filter((i, el) => {
        const $el = $(el);
        const style = $el.attr('style') || '';
        return style.includes('font-size') && parseInt(style.match(/font-size:\s*(\d+)px/)?.[1] || 16) < 16;
    }).length;
    
    const isMobileFriendly = hasViewport && hasMediaQueries;
    
    let details = '';
    if (isMobileFriendly) {
        details = 'Mobile-friendly: viewport configured, responsive design detected';
    } else {
        const issues = [];
        if (!hasViewport) issues.push('missing viewport meta tag');
        if (!hasMediaQueries) issues.push('no responsive design detected');
        details = `Mobile issues: ${issues.join(', ')}`;
    }
    
    return {
        isMobileFriendly,
        details,
        hasViewport,
        hasMediaQueries,
        responsiveImages,
        touchFriendly: smallButtons / buttons < 0.2 // Less than 20% small buttons
    };
}

function analyzeOpenGraph($) {
    const requiredTags = ['og:title', 'og:description', 'og:image'];
    const foundTags = [];
    
    $('meta[property^="og:"]').each((i, meta) => {
        const property = $(meta).attr('property');
        if (property) {
            foundTags.push(property);
        }
    });
    
    const hasRequiredTags = requiredTags.every(tag => foundTags.includes(tag));
    
    return {
        hasRequiredTags,
        foundTags,
        details: hasRequiredTags ? 
            `Open Graph tags complete (${foundTags.length} tags)` : 
            `Missing Open Graph tags: ${requiredTags.filter(tag => !foundTags.includes(tag)).join(', ')}`
    };
}

function analyzeTwitterCards($) {
    const requiredTags = ['twitter:card', 'twitter:title', 'twitter:description'];
    const foundTags = [];
    
    $('meta[name^="twitter:"]').each((i, meta) => {
        const name = $(meta).attr('name');
        if (name) {
            foundTags.push(name);
        }
    });
    
    const hasRequiredTags = requiredTags.every(tag => foundTags.includes(tag));
    
    return {
        hasRequiredTags,
        foundTags,
        details: hasRequiredTags ? 
            `Twitter Cards complete (${foundTags.length} tags)` : 
            `Missing Twitter Card tags: ${requiredTags.filter(tag => !foundTags.includes(tag)).join(', ')}`
    };
}

function analyzeImages($) {
    const images = $('img');
    let optimizedCount = 0;
    let totalImages = images.length;
    
    images.each((i, img) => {
        const $img = $(img);
        const hasAlt = !!$img.attr('alt');
        const hasSrcset = !!$img.attr('srcset');
        const hasSizes = !!$img.attr('sizes');
        const hasLazy = $img.attr('loading') === 'lazy';
        
        if (hasAlt && (hasSrcset || hasSizes || hasLazy)) {
            optimizedCount++;
        }
    });
    
    const isOptimized = totalImages === 0 || optimizedCount / totalImages > 0.7;
    
    return {
        isOptimized,
        optimizedCount,
        totalImages,
        details: isOptimized ? 
            `Images optimized: ${optimizedCount}/${totalImages} have alt text and responsive attributes` :
            `Images need optimization: only ${optimizedCount}/${totalImages} are optimized`
    };
}

function aggregateResults(pageResults) {
    const summary = {
        totalPages: pageResults.length,
        successfulAudits: pageResults.filter(p => p.status === 'success').length,
        failedAudits: pageResults.filter(p => p.status === 'error').length,
        checks: {}
    };
    
    // Aggregate check results
    const checkKeys = [
        'llm_txt_exists', 'robots_txt_proper', 'sitemap_exists',
        'ssl_enabled', 'meta_titles_present', 'meta_descriptions_present',
        'content_quality', 'structured_data_basic', 'mobile_friendly', 'open_graph_tags', 
        'twitter_cards', 'image_optimization'
    ];
    
    checkKeys.forEach(checkKey => {
        const results = pageResults
            .filter(p => p.status === 'success' && p.checks[checkKey])
            .map(p => p.checks[checkKey]);
        
        if (results.length > 0) {
            const passed = results.filter(r => r.pass).length;
            const failed = results.length - passed;
            
            // Find pages that are missing this check
            const missingPages = pageResults
                .filter(p => p.status === 'success' && p.checks[checkKey] && !p.checks[checkKey].pass)
                .map(p => p.url);
            
            // For content quality, collect page-specific data
            if (checkKey === 'content_quality') {
                const pageData = results.map(result => result.value?.pageSpecific).filter(data => data);
                const pagesNeedingContent = pageData.filter(page => page.wordCount < 300);
                const pagesNeedingFaq = pageData.filter(page => !page.hasFaqSection);
                
                summary.checks[checkKey] = {
                    passed,
                    total: results.length,
                    percentage: Math.round((passed / results.length) * 100),
                    details: results[0]?.details || 'No data',
                    missingPages: missingPages.slice(0, 10), // Show max 10 missing pages
                    value: results[0]?.value, // Preserve the detailed value object
                    pageData: pageData, // Include all page-specific data
                    pagesNeedingContent: pagesNeedingContent, // Pages with < 300 words
                    pagesNeedingFaq: pagesNeedingFaq // Pages without FAQ sections
                };
            } else {
                summary.checks[checkKey] = {
                    passed,
                    total: results.length,
                    percentage: Math.round((passed / results.length) * 100),
                    details: results[0]?.details || 'No data',
                    missingPages: missingPages.slice(0, 10), // Show max 10 missing pages
                    value: results[0]?.value // Preserve the detailed value object
                };
            }
        }
    });
    
    return summary;
}

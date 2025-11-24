// Content script for LLM Audit Chrome Extension
// Analyzes the current page DOM and performs LLM readiness checks

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'runAudit') {
        runPageAudit(request.url)
            .then(results => sendResponse(results))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Keep channel open for async response
    }
});

// Main audit function
async function runPageAudit(url) {
    try {
        const checks = {};
        
        // 1. SSL Enabled
        checks.ssl_enabled = checkSSL(url);
        
        // 2. Meta Title
        checks.meta_titles_present = checkMetaTitle();
        
        // 3. Meta Description
        checks.meta_descriptions_present = checkMetaDescription();
        
        // 4. Structured Data
        checks.structured_data_basic = checkStructuredData();
        
        // 5. Open Graph Tags
        checks.open_graph_tags = checkOpenGraph();
        
        // 6. Twitter Cards
        checks.twitter_cards = checkTwitterCards();
        
        // 7. Image Optimization
        checks.image_optimization = checkImageOptimization();
        
        // 8. Mobile Friendly
        checks.mobile_friendly = checkMobileFriendly();
        
        // 9. FAQ Section
        checks.faq_section = checkFAQSection();
        
        // 10. LLM.txt File
        checks.llm_txt_exists = await checkLLMTxt(url);
        
        // 11. Content Quality
        checks.content_quality = checkContentQuality();
        
        // 12. Robots.txt
        checks.robots_txt_proper = await checkRobotsTxt(url);
        
        // 13. Sitemap
        checks.sitemap_exists = await checkSitemap(url);
        
        // 14. Canonical URL
        checks.canonical_url = checkCanonicalUrl(url);
        
        // 15. Language & Hreflang
        checks.language_tags = checkLanguageTags();
        
        // 16. Content Freshness
        checks.content_freshness = checkContentFreshness();
        
        // 17. Internal Linking
        checks.internal_linking = checkInternalLinking(url);
        
        // 18. External Links
        checks.external_links = checkExternalLinks();
        
        // 19. Schema Validation
        checks.schema_validation = checkSchemaValidation();
        
        // 20. Page Speed Indicators
        checks.page_speed_indicators = checkPageSpeedIndicators();
        
        // 21. Accessibility for LLMs
        checks.accessibility = checkAccessibility();
        
        return { checks, url };
        
    } catch (error) {
        console.error('Page audit error:', error);
        throw error;
    }
}

// Check SSL
function checkSSL(url) {
    const pass = url.startsWith('https://');
    return {
        pass,
        details: pass ? 'Site uses HTTPS.' : 'Site does not use HTTPS.',
        recommendation: pass 
            ? 'Great! Your site uses HTTPS which is essential for security and LLM trust.' 
            : 'Enable HTTPS/SSL for your website. This is critical for security and LLM indexing.'
    };
}

// Check Meta Title
function checkMetaTitle() {
    const titleElement = document.querySelector('head title');
    const title = titleElement ? titleElement.textContent.trim() : '';
    const pass = title.length > 0 && title.length <= 60;
    
    let details = '';
    if (!title) {
        details = 'No meta title found.';
    } else if (title.length > 60) {
        details = `Meta title too long (${title.length} characters, recommended: 50-60).`;
    } else {
        details = `Meta title found: "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}"`;
    }
    
    return {
        pass,
        details,
        value: { title },
        recommendation: pass
            ? 'Your meta title is well-optimized for search engines and LLMs.'
            : title.length > 60
                ? 'Shorten your meta title to 50-60 characters for optimal display.'
                : 'Add a descriptive meta title tag in your <head> section. This is crucial for LLM understanding.'
    };
}

// Check Meta Description
function checkMetaDescription() {
    const metaDesc = document.querySelector('head meta[name="description"]');
    const description = metaDesc ? (metaDesc.getAttribute('content') || '').trim() : '';
    const pass = description.length >= 120 && description.length <= 160;
    
    let details = '';
    if (!description) {
        details = 'No meta description found.';
    } else if (description.length < 120) {
        details = `Meta description too short (${description.length} characters, recommended: 120-160).`;
    } else if (description.length > 160) {
        details = `Meta description too long (${description.length} characters, recommended: 120-160).`;
    } else {
        details = `Meta description found: "${description.substring(0, 80)}..."`;
    }
    
    return {
        pass,
        details,
        value: { description },
        recommendation: pass
            ? 'Your meta description is well-optimized for search engines and LLMs.'
            : description.length > 160
                ? 'Shorten your meta description to 120-160 characters.'
                : description.length > 0
                    ? 'Expand your meta description to 120-160 characters for better LLM understanding.'
                    : 'Add a meta description tag in your <head> section. This helps LLMs understand your page content.'
    };
}

// Check Structured Data
function checkStructuredData() {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    const microdataItems = document.querySelectorAll('[itemscope]');
    
    let hasData = false;
    const types = [];
    const jsonLd = [];
    
    jsonLdScripts.forEach(script => {
        try {
            const content = script.textContent.trim();
            const data = JSON.parse(content);
            const items = Array.isArray(data) ? data : [data];
            
            items.forEach(item => {
                if (item['@type']) {
                    hasData = true;
                    const type = item['@type'];
                    types.push(type);
                    jsonLd.push({
                        type,
                        name: item.name || item.headline || 'Unknown',
                        hasName: !!(item.name || item.headline),
                        hasDescription: !!item.description
                    });
                }
            });
        } catch (e) {
            console.error('JSON-LD parsing error:', e);
        }
    });
    
    const essentialTypes = ['Organization', 'WebSite', 'WebPage', 'Article', 'Product', 'LocalBusiness'];
    const foundEssential = essentialTypes.some(type => 
        types.some(found => found.toLowerCase().includes(type.toLowerCase()))
    );
    
    const pass = hasData && foundEssential;
    
    let details = '';
    if (hasData) {
        const uniqueTypes = [...new Set(types)];
        details = `Found ${jsonLd.length} structured data item(s): ${uniqueTypes.join(', ')}`;
    } else {
        details = 'No structured data (JSON-LD, Microdata) found.';
    }
    
    return {
        pass,
        details,
        value: { types: [...new Set(types)], jsonLd, microdata: microdataItems.length },
        recommendation: pass
            ? 'Your page has proper structured data for LLM understanding.'
            : hasData
                ? 'Add essential schema types like Organization, WebSite, or Article for better LLM visibility.'
                : 'Add structured data (JSON-LD) to help LLMs understand your page content. Consider adding Organization, WebSite, or Article schemas.'
    };
}

// Check Open Graph Tags
function checkOpenGraph() {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogImage = document.querySelector('meta[property="og:image"]');
    const ogUrl = document.querySelector('meta[property="og:url"]');
    
    const hasTitle = !!ogTitle;
    const hasDescription = !!ogDescription;
    const hasImage = !!ogImage;
    const hasUrl = !!ogUrl;
    
    const requiredCount = [hasTitle, hasDescription, hasImage, hasUrl].filter(Boolean).length;
    const pass = requiredCount >= 3;
    
    let details = '';
    if (pass) {
        details = `Open Graph tags present (${requiredCount}/4 required tags).`;
    } else {
        const missing = [];
        if (!hasTitle) missing.push('og:title');
        if (!hasDescription) missing.push('og:description');
        if (!hasImage) missing.push('og:image');
        if (!hasUrl) missing.push('og:url');
        details = `Missing Open Graph tags: ${missing.join(', ')}`;
    }
    
    return {
        pass,
        details,
        value: { hasTitle, hasDescription, hasImage, hasUrl },
        recommendation: pass
            ? 'Your page has proper Open Graph tags for social sharing and LLM understanding.'
            : 'Add Open Graph meta tags (og:title, og:description, og:image, og:url) for better LLM and social media visibility.'
    };
}

// Check Twitter Cards
function checkTwitterCards() {
    const twitterCard = document.querySelector('meta[name="twitter:card"]');
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    
    const hasCard = !!twitterCard;
    const hasTitle = !!twitterTitle;
    const hasDescription = !!twitterDescription;
    const hasImage = !!twitterImage;
    
    const requiredCount = [hasCard, hasTitle, hasDescription, hasImage].filter(Boolean).length;
    const pass = requiredCount >= 3;
    
    let details = '';
    if (pass) {
        details = `Twitter Card tags present (${requiredCount}/4 recommended tags).`;
    } else {
        const missing = [];
        if (!hasCard) missing.push('twitter:card');
        if (!hasTitle) missing.push('twitter:title');
        if (!hasDescription) missing.push('twitter:description');
        if (!hasImage) missing.push('twitter:image');
        details = `Missing Twitter Card tags: ${missing.join(', ')}`;
    }
    
    return {
        pass,
        details,
        value: { hasCard, hasTitle, hasDescription, hasImage },
        recommendation: pass
            ? 'Your page has proper Twitter Card tags for social sharing.'
            : 'Add Twitter Card meta tags (twitter:card, twitter:title, twitter:description, twitter:image) for better social media visibility.'
    };
}

// Check Image Optimization
function checkImageOptimization() {
    const images = document.querySelectorAll('img');
    let hasAlt = 0;
    let missingAlt = 0;
    let hasDimensions = 0;
    
    images.forEach(img => {
        if (img.alt && img.alt.trim()) {
            hasAlt++;
        } else {
            missingAlt++;
        }
        
        if ((img.width && img.height) || (img.naturalWidth && img.naturalHeight)) {
            hasDimensions++;
        }
    });
    
    const totalImages = images.length;
    const altPercentage = totalImages > 0 ? Math.round((hasAlt / totalImages) * 100) : 100;
    const pass = totalImages === 0 || altPercentage >= 80;
    
    let details = '';
    if (totalImages === 0) {
        details = 'No images found on this page.';
    } else {
        details = `${hasAlt}/${totalImages} images have alt text (${altPercentage}%).`;
    }
    
    return {
        pass,
        details,
        value: { totalImages, hasAlt, missingAlt, hasDimensions, altPercentage },
        recommendation: pass
            ? totalImages === 0
                ? 'Consider adding images with descriptive alt text to enhance LLM understanding.'
                : 'Most images have alt text. Keep adding descriptive alt text to all images.'
            : `Add alt text to ${missingAlt} missing image(s). Alt text helps LLMs understand image content.`
    };
}

// Check Mobile Friendly
function checkMobileFriendly() {
    const viewport = document.querySelector('meta[name="viewport"]');
    const hasViewport = !!viewport;
    
    let viewportContent = '';
    if (viewport) {
        viewportContent = viewport.getAttribute('content') || '';
    }
    
    const hasProperViewport = hasViewport && (
        viewportContent.includes('width=device-width') || 
        viewportContent.includes('initial-scale=1')
    );
    
    const pass = hasProperViewport;
    
    let details = '';
    if (pass) {
        details = 'Mobile-friendly viewport meta tag found.';
    } else if (hasViewport) {
        details = 'Viewport meta tag present but may not be properly configured.';
    } else {
        details = 'No viewport meta tag found.';
    }
    
    return {
        pass,
        details,
        value: { hasViewport, viewportContent },
        recommendation: pass
            ? 'Your page is mobile-friendly with proper viewport settings.'
            : 'Add a viewport meta tag: <meta name="viewport" content="width=device-width, initial-scale=1">. This is essential for mobile LLM access.'
    };
}

// Check FAQ Section
function checkFAQSection() {
    const faqKeywords = ['faq', 'frequently asked', 'questions', 'answers', 'q&a', 'q and a'];
    
    // Method 1: Check for FAQ headings
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const faqHeadings = headings.filter(heading => {
        const text = heading.textContent.toLowerCase();
        return faqKeywords.some(keyword => text.includes(keyword));
    });
    
    // Method 2: Check for FAQ-specific HTML patterns
    const faqSelectors = [
        '.faq', '#faq', '.faqs', '#faqs', 
        '.frequently-asked-questions', '.questions-answers',
        '[data-faq]', '[data-accordion]', '.accordion-item', '.faq-item'
    ];
    const faqElements = faqSelectors.some(selector => {
        return document.querySelector(selector) !== null;
    });
    
    // Method 3: Check for Q&A patterns (dt/dd, question/answer classes)
    const questionElements = document.querySelectorAll('dt, .question, .faq-question, [data-question]');
    const answerElements = document.querySelectorAll('dd, .answer, .faq-answer, [data-answer]');
    const hasQAPattern = questionElements.length > 0 && answerElements.length > 0;
    
    // Method 4: Check for FAQ schema markup
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    let hasFaqSchema = false;
    
    jsonLdScripts.forEach(script => {
        try {
            const content = script.textContent.trim();
            const data = JSON.parse(content);
            const items = Array.isArray(data) ? data : [data];
            
            if (items.some(item => item['@type'] === 'FAQPage' || item['@type'] === 'Question')) {
                hasFaqSchema = true;
            }
        } catch (e) {
            // Ignore parse errors
        }
    });
    
    // Calculate score
    let score = 0;
    if (faqHeadings.length > 0) score += 30;
    if (faqElements) score += 20;
    if (hasQAPattern) score += 30;
    if (hasFaqSchema) score += 40; // Highest weight for structured data
    
    const hasFaq = score >= 30;
    const pass = hasFaq;
    
    let details = '';
    if (hasFaqSchema) {
        details = 'FAQ schema markup (FAQPage/Question) found.';
    } else if (hasQAPattern) {
        details = `FAQ section found with ${questionElements.length} question(s) and ${answerElements.length} answer(s).`;
    } else if (faqHeadings.length > 0) {
        details = `FAQ section detected (${faqHeadings.length} FAQ-related heading(s)).`;
    } else if (faqElements) {
        details = 'FAQ section detected via HTML patterns.';
    } else {
        details = 'No FAQ section detected on this page.';
    }
    
    return {
        pass,
        details,
        value: { 
            hasFaq, 
            score: Math.min(100, score),
            hasHeadings: faqHeadings.length > 0,
            hasHtmlPatterns: faqElements,
            hasQAPattern,
            hasSchema: hasFaqSchema
        },
        recommendation: pass
            ? 'Great! FAQ sections help LLMs understand common questions about your content.'
            : 'Add an FAQ section with common questions and answers. Consider using FAQPage schema markup for better LLM understanding.'
    };
}

// Check LLM.txt File
async function checkLLMTxt(url) {
    try {
        const urlObj = new URL(url);
        const llmTxtUrl = `${urlObj.origin}/llm.txt`;
        
        const response = await fetch(llmTxtUrl, {
            method: 'HEAD',
            cache: 'no-cache'
        });
        
        const pass = response.ok;
        
        let details = '';
        if (pass) {
            details = `LLM.txt file found at ${urlObj.origin}/llm.txt`;
        } else {
            details = 'No LLM.txt file found.';
        }
        
        return {
            pass,
            details,
            value: { url: llmTxtUrl, exists: pass },
            recommendation: pass
                ? 'Excellent! Your LLM.txt file helps AI platforms understand your content structure and priorities.'
                : 'Create an LLM.txt file at your site root (/llm.txt) to provide structured information to AI platforms. Learn more at llmtext.wtf'
        };
        
    } catch (error) {
        return {
            pass: false,
            details: 'Unable to check for LLM.txt file (CORS or network error).',
            value: { error: error.message },
            recommendation: 'Create an LLM.txt file at your site root (/llm.txt) to help AI platforms understand your content.'
        };
    }
}

// Check Content Quality
function checkContentQuality() {
    // Get main content (exclude nav, footer, scripts, styles)
    const mainContent = document.querySelector('main, article, [role="main"]') || document.body;
    
    // Remove script and style elements
    const clone = mainContent.cloneNode(true);
    const scripts = clone.querySelectorAll('script, style, nav, footer, header, aside');
    scripts.forEach(el => el.remove());
    
    const text = clone.textContent || '';
    const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    // Check heading structure
    const h1 = mainContent.querySelectorAll('h1').length;
    const h2 = mainContent.querySelectorAll('h2').length;
    const h3 = mainContent.querySelectorAll('h3').length;
    const h4 = mainContent.querySelectorAll('h4').length;
    
    // Check for paragraphs
    const paragraphs = mainContent.querySelectorAll('p').length;
    
    // Check for lists (good for structured content)
    const lists = mainContent.querySelectorAll('ul, ol').length;
    
    // Calculate scores
    let score = 0;
    const issues = [];
    const strengths = [];
    
    // Word count (recommended: 300+ words for good LLM understanding)
    if (wordCount >= 500) {
        score += 30;
        strengths.push('Excellent content length');
    } else if (wordCount >= 300) {
        score += 25;
        strengths.push('Good content length');
    } else if (wordCount >= 150) {
        score += 15;
        issues.push('Content could be longer (recommended: 300+ words)');
    } else {
        score += 5;
        issues.push('Content is too short for good LLM understanding (recommended: 300+ words)');
    }
    
    // Heading structure (need H1 and H2 for good structure)
    if (h1 > 0 && h2 > 0) {
        score += 25;
        strengths.push('Proper heading hierarchy (H1→H2)');
    } else if (h1 > 0) {
        score += 15;
        issues.push('Add H2 headings to improve content structure');
    } else {
        score += 5;
        issues.push('Add H1 and H2 headings for better LLM understanding');
    }
    
    // Paragraphs (good for readability)
    if (paragraphs >= 5) {
        score += 20;
        strengths.push('Well-structured with multiple paragraphs');
    } else if (paragraphs >= 3) {
        score += 15;
    } else {
        score += 5;
        issues.push('Add more paragraphs to improve readability');
    }
    
    // Lists (good for structured information)
    if (lists >= 2) {
        score += 15;
        strengths.push('Good use of lists for structured content');
    } else if (lists >= 1) {
        score += 10;
    } else {
        score += 5;
    }
    
    // Content density (words per paragraph - good: 50-100)
    const avgWordsPerPara = paragraphs > 0 ? Math.round(wordCount / paragraphs) : 0;
    if (avgWordsPerPara >= 50 && avgWordsPerPara <= 150) {
        score += 10;
    } else if (avgWordsPerPara > 0) {
        score += 5;
    }
    
    const finalScore = Math.min(100, score);
    const pass = finalScore >= 60;
    
    let details = '';
    if (pass) {
        details = `Good content quality (${finalScore}%): ${wordCount} words, proper heading structure, ${paragraphs} paragraphs.`;
    } else {
        details = `Content needs improvement (${finalScore}%): ${wordCount} words, ${h1} H1, ${h2} H2, ${paragraphs} paragraphs.`;
    }
    
    return {
        pass,
        details,
        value: {
            wordCount,
            headingCount: { h1, h2, h3, h4 },
            paragraphs,
            lists,
            avgWordsPerPara,
            score: finalScore,
            issues,
            strengths
        },
        recommendation: pass
            ? `Your content is well-structured for LLM understanding. ${strengths.join(', ')}.`
            : `Improve content quality: ${issues.join('; ')}. Aim for 300+ words, proper H1→H2 structure, and multiple paragraphs for better LLM visibility.`
    };
}

// Check Robots.txt
async function checkRobotsTxt(url) {
    try {
        const urlObj = new URL(url);
        const robotsUrl = `${urlObj.origin}/robots.txt`;
        
        const response = await fetch(robotsUrl, {
            method: 'GET',
            cache: 'no-cache'
        });
        
        if (response.ok) {
            const text = await response.text();
            const robotsText = text.toLowerCase();
            
            // Check if AI crawlers are explicitly blocked
            const aiBots = ['gptbot', 'claude-web', 'perplexitybot', 'googleother'];
            const blocksAI = aiBots.some(bot => {
                const botPattern = new RegExp(`user-agent:\\s*${bot}`, 'i');
                if (robotsText.match(botPattern)) {
                    const disallowPattern = new RegExp(`user-agent:\\s*${bot}[\\s\\S]*?disallow:\\s*[^\\n\\r]*`, 'i');
                    const match = robotsText.match(disallowPattern);
                    return match && match[0].includes('disallow: /');
                }
                return false;
            });
            
            // Check if all bots are blocked (must be paired: user-agent: * followed by disallow: /)
            // Parse robots.txt properly to check if user-agent: * is followed by disallow: / in the same block
            const lines = robotsText.split('\n');
            let allBlocked = false;
            let inWildcardBlock = false;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                // Skip comments
                if (line.startsWith('#')) continue;
                
                // Check if we're in a User-agent: * block
                if (line.match(/^user-agent:\s*\*$/i)) {
                    inWildcardBlock = true;
                    // Check next non-comment lines for Disallow: /
                    for (let j = i + 1; j < lines.length && j < i + 10; j++) {
                        const nextLine = lines[j].trim();
                        if (nextLine.startsWith('#')) continue;
                        if (nextLine.startsWith('user-agent:')) {
                            inWildcardBlock = false;
                            break;
                        }
                        // Check if this line has Disallow: / (exact match, not /something/)
                        if (nextLine.match(/^disallow:\s*\/\s*$/i)) {
                            allBlocked = true;
                            break;
                        }
                        // If we hit another directive (Allow, Crawl-delay, etc), stop checking
                        if (nextLine.match(/^(allow|crawl-delay|sitemap):/i)) {
                            break;
                        }
                    }
                    if (allBlocked) break;
                    inWildcardBlock = false;
                }
            }
            
            const pass = !blocksAI && !allBlocked;
            
            let details = '';
            if (blocksAI) {
                details = 'Robots.txt may block AI crawlers (GPTBot, Claude-Web, PerplexityBot).';
            } else if (allBlocked) {
                details = 'Robots.txt blocks all crawlers (Disallow: /).';
            } else {
                details = 'Robots.txt allows AI crawlers.';
            }
            
            return {
                pass,
                details,
                value: { exists: true, blocksAI, allBlocked },
                recommendation: pass
                    ? 'Your robots.txt properly allows AI crawlers to access your content.'
                    : 'Update your robots.txt to explicitly allow AI crawlers: GPTBot (OpenAI), Claude-Web (Anthropic), PerplexityBot, and GoogleOther (Gemini).'
            };
        } else {
            // No robots.txt found - this is okay (allows all crawlers)
            return {
                pass: true,
                details: 'No robots.txt found (allows all crawlers by default).',
                value: { exists: false },
                recommendation: 'Consider creating a robots.txt file to explicitly allow AI crawlers for better control.'
            };
        }
    } catch (error) {
        return {
            pass: true, // Default to pass if we can't check
            details: 'Unable to check robots.txt (CORS or network error).',
            value: { error: error.message },
            recommendation: 'Ensure your robots.txt allows AI crawlers: GPTBot, Claude-Web, PerplexityBot, and GoogleOther.'
        };
    }
}

// Check Sitemap
async function checkSitemap(url) {
    try {
        const urlObj = new URL(url);
        
        // Check common sitemap locations
        const sitemapUrls = [
            `${urlObj.origin}/sitemap.xml`,
            `${urlObj.origin}/sitemap_index.xml`
        ];
        
        let sitemapUrl = null;
        let sitemapText = null;
        
        for (const testUrl of sitemapUrls) {
            try {
                const response = await fetch(testUrl, {
                    method: 'GET',
                    cache: 'no-cache'
                });
                if (response.ok) {
                    sitemapUrl = testUrl;
                    sitemapText = await response.text();
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        // Also check robots.txt for sitemap reference
        let referencedInRobots = false;
        try {
            const robotsResponse = await fetch(`${urlObj.origin}/robots.txt`, {
                method: 'GET',
                cache: 'no-cache'
            });
            if (robotsResponse.ok) {
                const robotsText = await robotsResponse.text();
                referencedInRobots = robotsText.toLowerCase().includes('sitemap:');
            }
        } catch (e) {
            // Ignore robots.txt errors
        }
        
        if (sitemapUrl && sitemapText) {
            // Try to count URLs in sitemap
            const urlMatches = sitemapText.match(/<loc>(.*?)<\/loc>/gi);
            const urlCount = urlMatches ? urlMatches.length : 0;
            
            const pass = true;
            let details = `XML sitemap found at ${sitemapUrl}${urlCount > 0 ? ` (${urlCount} URLs)` : ''}`;
            if (!referencedInRobots && urlCount > 0) {
                details += '. Not referenced in robots.txt.';
            } else if (referencedInRobots) {
                details += ' and referenced in robots.txt.';
            }
            
            return {
                pass,
                details,
                value: { exists: true, url: sitemapUrl, urlCount, referencedInRobots },
                recommendation: referencedInRobots
                    ? 'Excellent! Your sitemap helps AI platforms discover all your pages efficiently.'
                    : 'Add a Sitemap directive to your robots.txt file to help crawlers find your sitemap.'
            };
        } else {
            return {
                pass: false,
                details: 'No XML sitemap found.',
                value: { exists: false },
                recommendation: 'Create an XML sitemap and reference it in your robots.txt. This helps AI platforms discover all your pages systematically.'
            };
        }
    } catch (error) {
        return {
            pass: false,
            details: 'Unable to check for sitemap (CORS or network error).',
            value: { error: error.message },
            recommendation: 'Create an XML sitemap at /sitemap.xml to help AI platforms discover your content.'
        };
    }
}

// Check Canonical URL
function checkCanonicalUrl(url) {
    const canonical = document.querySelector('link[rel="canonical"]');
    const canonicalUrl = canonical ? canonical.getAttribute('href') : null;
    
    if (!canonicalUrl) {
        return {
            pass: false,
            details: 'No canonical URL tag found.',
            value: { exists: false },
            recommendation: 'Add a canonical URL tag to prevent duplicate content issues. This helps LLMs identify the preferred version of your page.'
        };
    }
    
    try {
        // Check if canonical is self-referencing
        const currentUrlObj = new URL(url);
        const canonicalUrlObj = new URL(canonicalUrl, url);
        
        const isSelfReferencing = canonicalUrlObj.origin === currentUrlObj.origin &&
                                  canonicalUrlObj.pathname === currentUrlObj.pathname;
        
        const pass = isSelfReferencing;
        
        let details = '';
        if (isSelfReferencing) {
            details = `Canonical URL is self-referencing: ${canonicalUrl}`;
        } else {
            details = `Canonical URL points to different page: ${canonicalUrl}`;
        }
        
        return {
            pass,
            details,
            value: { canonicalUrl, isSelfReferencing },
            recommendation: pass
                ? 'Your canonical URL is properly configured to avoid duplicate content issues.'
                : 'Ensure your canonical URL points to the current page (self-referencing) to avoid duplicate content penalties.'
        };
    } catch (error) {
        return {
            pass: false,
            details: `Canonical URL found but may be invalid: ${canonicalUrl}`,
            value: { canonicalUrl, error: error.message },
            recommendation: 'Fix your canonical URL to be a valid, absolute URL that points to the current page.'
        };
    }
}

// Check Language & Hreflang Tags
function checkLanguageTags() {
    const htmlLang = document.documentElement.getAttribute('lang');
    const hreflangLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
    
    const hasLang = !!htmlLang;
    const hasHreflang = hreflangLinks.length > 0;
    
    let pass = hasLang;
    if (hasHreflang && !hasLang) {
        pass = false; // Should have both
    }
    
    let details = '';
    if (hasLang && hasHreflang) {
        details = `Language tag (${htmlLang}) and ${hreflangLinks.length} hreflang tag(s) found.`;
    } else if (hasLang) {
        details = `Language tag found: ${htmlLang}. No hreflang tags.`;
    } else if (hasHreflang) {
        details = `${hreflangLinks.length} hreflang tag(s) found but missing html lang attribute.`;
    } else {
        details = 'No language or hreflang tags found.';
    }
    
    return {
        pass,
        details,
        value: { htmlLang, hreflangCount: hreflangLinks.length },
        recommendation: pass
            ? 'Your page has proper language identification for LLMs and search engines.'
            : 'Add a lang attribute to your <html> tag (e.g., <html lang="en">). For multilingual sites, also add hreflang tags.'
    };
}

// Check Content Freshness
function checkContentFreshness() {
    // Check for publish dates in various formats
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    let publishDate = null;
    let modifiedDate = null;
    
    // Check JSON-LD for dates
    jsonLdScripts.forEach(script => {
        try {
            const content = script.textContent.trim();
            const data = JSON.parse(content);
            const items = Array.isArray(data) ? data : [data];
            
            items.forEach(item => {
                if (item.datePublished && !publishDate) {
                    publishDate = item.datePublished;
                }
                if (item.dateModified && !modifiedDate) {
                    modifiedDate = item.dateModified;
                }
            });
        } catch (e) {
            // Ignore parse errors
        }
    });
    
    // Check meta tags
    const metaPubDate = document.querySelector('meta[property="article:published_time"], meta[name="publish_date"]');
    if (metaPubDate && !publishDate) {
        publishDate = metaPubDate.getAttribute('content');
    }
    
    const metaModDate = document.querySelector('meta[property="article:modified_time"], meta[name="modified_date"]');
    if (metaModDate && !modifiedDate) {
        modifiedDate = metaModDate.getAttribute('content');
    }
    
    const hasDate = !!(publishDate || modifiedDate);
    const pass = hasDate;
    
    let details = '';
    if (publishDate && modifiedDate) {
        details = `Publish date: ${publishDate}, Modified: ${modifiedDate}`;
    } else if (publishDate) {
        details = `Publish date found: ${publishDate}`;
    } else if (modifiedDate) {
        details = `Modified date found: ${modifiedDate}`;
    } else {
        details = 'No publish or modified dates found.';
    }
    
    return {
        pass,
        details,
        value: { publishDate, modifiedDate, hasDate },
        recommendation: pass
            ? 'Your content includes date information which helps LLMs understand content freshness.'
            : 'Add publish/modified dates using article:published_time and article:modified_time meta tags or JSON-LD schema for better content freshness signals.'
    };
}

// Check Internal Linking
function checkInternalLinking(url) {
    try {
        const urlObj = new URL(url);
        const allLinks = document.querySelectorAll('a[href]');
        
        let internalLinks = 0;
        let externalLinks = 0;
        let descriptiveAnchors = 0;
        let emptyAnchors = 0;
        
        allLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            
            try {
                const linkUrl = new URL(href, url);
                const anchorText = link.textContent.trim().toLowerCase();
                
                if (linkUrl.origin === urlObj.origin) {
                    internalLinks++;
                    
                    // Check if anchor text is descriptive (not generic)
                    const genericAnchors = ['click here', 'read more', 'more', 'link', 'here', '#', '>>', 'learn more'];
                    const isDescriptive = anchorText.length > 3 && 
                                         !genericAnchors.includes(anchorText) &&
                                         anchorText !== '';
                    
                    if (isDescriptive) {
                        descriptiveAnchors++;
                    } else if (anchorText === '') {
                        emptyAnchors++;
                    }
                } else {
                    externalLinks++;
                }
            } catch (e) {
                // Invalid URL, skip
            }
        });
        
        const totalInternal = internalLinks;
        const descriptiveRatio = totalInternal > 0 ? Math.round((descriptiveAnchors / totalInternal) * 100) : 0;
        const pass = totalInternal >= 3 && descriptiveRatio >= 50;
        
        let details = `${totalInternal} internal link(s) found, ${descriptiveAnchors} with descriptive anchor text (${descriptiveRatio}%).`;
        if (emptyAnchors > 0) {
            details += ` ${emptyAnchors} link(s) with no anchor text.`;
        }
        
        return {
            pass,
            details,
            value: { internalLinks, externalLinks, descriptiveAnchors, emptyAnchors, descriptiveRatio },
            recommendation: pass
                ? 'Good internal linking structure with descriptive anchor text helps LLMs understand your site structure.'
                : 'Add more internal links with descriptive anchor text (avoid generic terms like "click here" or "read more"). Aim for at least 3-5 internal links per page.'
        };
    } catch (error) {
        return {
            pass: false,
            details: 'Unable to analyze internal links.',
            value: { error: error.message },
            recommendation: 'Add internal links with descriptive anchor text to help LLMs navigate your site.'
        };
    }
}

// Check External Links
function checkExternalLinks() {
    const allLinks = document.querySelectorAll('a[href]');
    
    let externalLinks = 0;
    let nofollowLinks = 0;
    let dofollowLinks = 0;
    
    allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        
        try {
            const linkUrl = new URL(href, window.location.href);
            if (linkUrl.origin !== window.location.origin) {
                externalLinks++;
                
                const rel = link.getAttribute('rel') || '';
                if (rel.toLowerCase().includes('nofollow')) {
                    nofollowLinks++;
                } else {
                    dofollowLinks++;
                }
            }
        } catch (e) {
            // Invalid URL, skip
        }
    });
    
    const pass = externalLinks === 0 || nofollowLinks <= dofollowLinks;
    
    let details = '';
    if (externalLinks === 0) {
        details = 'No external links found.';
    } else {
        details = `${externalLinks} external link(s): ${dofollowLinks} dofollow, ${nofollowLinks} nofollow.`;
    }
    
    return {
        pass,
        details,
        value: { externalLinks, nofollowLinks, dofollowLinks },
        recommendation: pass
            ? 'External links are properly configured. Use nofollow for untrusted links to preserve link equity.'
            : 'Review external links. Use rel="nofollow" for untrusted or sponsored links to maintain SEO value.'
    };
}

// Check Schema Validation
function checkSchemaValidation() {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    let validSchemas = 0;
    let invalidSchemas = 0;
    const errors = [];
    const validTypes = [];
    
    jsonLdScripts.forEach((script, index) => {
        try {
            const content = script.textContent.trim();
            const data = JSON.parse(content);
            const items = Array.isArray(data) ? data : [data];
            
            items.forEach(item => {
                if (item['@type']) {
                    validSchemas++;
                    validTypes.push(item['@type']);
                    
                    // Basic validation: check for required properties
                    const type = item['@type'].toLowerCase();
                    if (type.includes('organization') && !item.name && !item.url) {
                        errors.push('Organization schema missing name or url');
                    }
                    if (type.includes('article') && !item.headline && !item.name) {
                        errors.push('Article schema missing headline or name');
                    }
                    if (type.includes('website') && !item.url) {
                        errors.push('WebSite schema missing url');
                    }
                } else {
                    invalidSchemas++;
                    errors.push(`Schema ${index + 1} missing @type`);
                }
            });
        } catch (e) {
            invalidSchemas++;
            errors.push(`Schema ${index + 1} has invalid JSON: ${e.message}`);
        }
    });
    
    const pass = validSchemas > 0 && invalidSchemas === 0;
    
    let details = '';
    if (validSchemas > 0 && invalidSchemas === 0) {
        const uniqueTypes = [...new Set(validTypes)];
        details = `${validSchemas} valid schema(s) found: ${uniqueTypes.join(', ')}`;
    } else if (validSchemas > 0) {
        details = `${validSchemas} valid, ${invalidSchemas} invalid schema(s). Errors: ${errors.slice(0, 2).join(', ')}`;
    } else {
        details = 'No valid structured data schemas found.';
    }
    
    return {
        pass,
        details,
        value: { validSchemas, invalidSchemas, errors, validTypes },
        recommendation: pass
            ? 'Your structured data schemas are valid and properly formatted.'
            : validSchemas > 0
                ? `Fix schema errors: ${errors.slice(0, 2).join(', ')}. Use Google's Rich Results Test to validate schemas.`
                : 'Add valid JSON-LD structured data schemas (Organization, WebSite, Article) to improve LLM understanding.'
    };
}

// Check Page Speed Indicators
function checkPageSpeedIndicators() {
    const images = document.querySelectorAll('img');
    let lazyLoaded = 0;
    let hasLoadingAttr = 0;
    let modernFormats = 0;
    
    images.forEach(img => {
        // Check for loading="lazy"
        if (img.getAttribute('loading') === 'lazy') {
            lazyLoaded++;
            hasLoadingAttr++;
        }
        
        // Check for modern image formats (heuristics: srcset, src with .webp/.avif)
        const src = img.getAttribute('src') || '';
        const srcset = img.getAttribute('srcset') || '';
        if (src.includes('.webp') || src.includes('.avif') || 
            srcset.includes('.webp') || srcset.includes('.avif')) {
            modernFormats++;
        }
    });
    
    // Check for render-blocking resources
    const renderBlocking = document.querySelectorAll('script[src]:not([async]):not([defer])');
    const cssLinks = document.querySelectorAll('link[rel="stylesheet"]:not([media="print"])');
    
    const totalImages = images.length;
    const lazyRatio = totalImages > 0 ? Math.round((lazyLoaded / totalImages) * 100) : 100;
    
    // Check for preconnect/preload hints
    const preconnect = document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]');
    const preload = document.querySelectorAll('link[rel="preload"]');
    
    const hasOptimizations = lazyRatio >= 50 || modernFormats > 0 || preconnect.length > 0 || preload.length > 0;
    const hasBlockingIssues = renderBlocking.length > 3 || cssLinks.length > 3;
    
    const pass = hasOptimizations && !hasBlockingIssues;
    
    let details = '';
    const detailsParts = [];
    if (lazyRatio >= 50) {
        detailsParts.push(`${lazyLoaded}/${totalImages} images lazy-loaded`);
    }
    if (modernFormats > 0) {
        detailsParts.push(`${modernFormats} image(s) use modern formats`);
    }
    if (preconnect.length > 0 || preload.length > 0) {
        detailsParts.push(`${preconnect.length + preload.length} resource hint(s)`);
    }
    if (renderBlocking.length > 3) {
        detailsParts.push(`${renderBlocking.length} render-blocking scripts`);
    }
    if (cssLinks.length > 3) {
        detailsParts.push(`${cssLinks.length} render-blocking stylesheets`);
    }
    
    details = detailsParts.length > 0 
        ? detailsParts.join(', ')
        : 'Limited page speed optimizations detected.';
    
    return {
        pass,
        details,
        value: { 
            totalImages, 
            lazyLoaded, 
            lazyRatio, 
            modernFormats, 
            renderBlocking: renderBlocking.length,
            cssBlocking: cssLinks.length,
            preconnect: preconnect.length,
            preload: preload.length
        },
        recommendation: pass
            ? 'Your page has good speed optimization indicators for faster LLM crawling.'
            : 'Optimize page speed: add loading="lazy" to images, use modern image formats (WebP/AVIF), add async/defer to scripts, and use resource hints (preconnect/preload).'
    };
}

// Check Accessibility for LLMs
function checkAccessibility() {
    // Check for ARIA labels
    const elementsWithAria = document.querySelectorAll('[aria-label], [aria-labelledby]');
    const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
    const buttonsWithoutLabels = Array.from(document.querySelectorAll('button, [role="button"]')).filter(
        btn => !btn.textContent.trim() && !btn.getAttribute('aria-label') && !btn.getAttribute('aria-labelledby')
    );
    
    // Check semantic HTML
    const semanticElements = document.querySelectorAll('main, article, nav, aside, section, header, footer');
    const hasMain = document.querySelector('main, [role="main"]') !== null;
    const hasNav = document.querySelector('nav, [role="navigation"]') !== null;
    
    // Check for proper heading hierarchy
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let headingIssues = 0;
    for (let i = 1; i < headings.length; i++) {
        const currentLevel = parseInt(headings[i].tagName[1]);
        const prevLevel = parseInt(headings[i - 1].tagName[1]);
        if (currentLevel - prevLevel > 1) {
            headingIssues++;
        }
    }
    
    const accessibilityScore = 
        (elementsWithAria.length > 0 ? 20 : 0) +
        (hasMain ? 20 : 0) +
        (hasNav ? 15 : 0) +
        (semanticElements.length >= 3 ? 20 : 0) +
        (headingIssues === 0 && headings.length > 0 ? 25 : 0);
    
    const pass = accessibilityScore >= 60;
    
    let details = '';
    const detailsParts = [];
    if (semanticElements.length > 0) {
        detailsParts.push(`${semanticElements.length} semantic element(s)`);
    }
    if (elementsWithAria.length > 0) {
        detailsParts.push(`${elementsWithAria.length} ARIA label(s)`);
    }
    if (imagesWithoutAlt.length > 0) {
        detailsParts.push(`${imagesWithoutAlt.length} image(s) missing alt text`);
    }
    if (buttonsWithoutLabels.length > 0) {
        detailsParts.push(`${buttonsWithoutLabels.length} button(s) without labels`);
    }
    if (headingIssues > 0) {
        detailsParts.push(`${headingIssues} heading hierarchy issue(s)`);
    }
    
    details = detailsParts.length > 0 
        ? detailsParts.join(', ')
        : 'Basic accessibility structure found.';
    
    return {
        pass,
        details,
        value: {
            ariaLabels: elementsWithAria.length,
            semanticElements: semanticElements.length,
            hasMain,
            hasNav,
            imagesWithoutAlt: imagesWithoutAlt.length,
            buttonsWithoutLabels: buttonsWithoutLabels.length,
            headingIssues,
            score: accessibilityScore
        },
        recommendation: pass
            ? 'Good accessibility structure helps LLMs understand your page layout and content hierarchy.'
            : 'Improve accessibility: use semantic HTML (main, nav, article), add ARIA labels where needed, ensure images have alt text, and maintain proper heading hierarchy.'
    };
}


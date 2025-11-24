// Vercel Serverless Function for LLM Audit
// This runs on Vercel's servers, not in the browser

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { url } = req.body;
  
  // Validate URL
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }
  
  try {
    // Perform all checks
    const checks = {
      llm_txt_exists: await checkLLMTxt(url),
      robots_txt_proper: await checkRobotsTxt(url),
      sitemap_exists: await checkSitemap(url),
      meta_titles_present: await checkMetaTitles(url),
      meta_descriptions_present: await checkMetaDescriptions(url),
      structured_data_basic: await checkStructuredData(url),
      ssl_enabled: checkSSL(url),
      mobile_friendly: await checkMobileFriendly(url)
    };
    
    // Generate detailed messages
    const details = generateDetails(checks, url);
    
    return res.status(200).json({ checks, details });
    
  } catch (error) {
    console.error('Audit error:', error);
    return res.status(500).json({ 
      error: 'Failed to audit website',
      message: error.message 
    });
  }
}

// ===== CHECK FUNCTIONS =====

async function checkLLMTxt(url) {
  try {
    const normalizedUrl = normalizeUrl(url);
    const response = await fetch(`${normalizedUrl}/llm.txt`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function checkRobotsTxt(url) {
  try {
    const normalizedUrl = normalizeUrl(url);
    const response = await fetch(`${normalizedUrl}/robots.txt`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.status !== 200) return false;
    
    const text = await response.text();
    
    // Check if AI crawlers are explicitly disallowed
    const aiCrawlers = ['GPTBot', 'Claude-Web', 'PerplexityBot', 'GoogleOther'];
    
    for (const bot of aiCrawlers) {
      if (text.includes(`User-agent: ${bot}`) && text.includes('Disallow: /')) {
        return false;
      }
    }
    
    // Check if all bots are disallowed
    if (text.includes('User-agent: *') && text.match(/User-agent:\s*\*[\s\S]*?Disallow:\s*\//)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return true; // Assume OK if robots.txt doesn't exist
  }
}

async function checkSitemap(url) {
  const normalizedUrl = normalizeUrl(url);
  const sitemapLocations = [
    `${normalizedUrl}/sitemap.xml`,
    `${normalizedUrl}/sitemap_index.xml`,
    `${normalizedUrl}/sitemap-index.xml`
  ];
  
  for (const sitemapUrl of sitemapLocations) {
    try {
      const response = await fetch(sitemapUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      continue;
    }
  }
  
  return false;
}

async function checkMetaTitles(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SellOnLLM-Audit/1.0)'
      }
    });
    
    const html = await response.text();
    
    // Check for title tag with content
    const titleMatch = html.match(/<title>(.+?)<\/title>/i);
    return titleMatch && titleMatch[1].trim().length > 0;
  } catch (error) {
    return false;
  }
}

async function checkMetaDescriptions(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SellOnLLM-Audit/1.0)'
      }
    });
    
    const html = await response.text();
    
    // Check for meta description
    const descriptionMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    return descriptionMatch && descriptionMatch[1].trim().length > 0;
  } catch (error) {
    return false;
  }
}

async function checkStructuredData(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SellOnLLM-Audit/1.0)'
      }
    });
    
    const html = await response.text();
    
    // Check for JSON-LD structured data
    const hasJsonLd = html.includes('application/ld+json') &&
                       html.includes('"@context"') &&
                       html.includes('schema.org');
    
    return hasJsonLd;
  } catch (error) {
    return false;
  }
}

function checkSSL(url) {
  return url.startsWith('https://');
}

async function checkMobileFriendly(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      }
    });
    
    const html = await response.text();
    
    // Check for viewport meta tag
    const hasViewport = html.includes('name="viewport"');
    
    return hasViewport;
  } catch (error) {
    return false;
  }
}

// ===== HELPER FUNCTIONS =====

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch (_) {
    return url;
  }
}

function generateDetails(checks, url) {
  const normalizedUrl = normalizeUrl(url);
  const details = {};
  
  // LLM.txt
  details.llm_txt_exists = {
    message: checks.llm_txt_exists 
      ? `Found LLM.txt file at ${normalizedUrl}/llm.txt`
      : 'No LLM.txt file found',
    recommendation: checks.llm_txt_exists
      ? 'Great! Your LLM.txt file helps AI platforms understand your content structure and priorities.'
      : 'Create an LLM.txt file to provide structured information to AI platforms. This is similar to robots.txt but specifically for LLMs. Learn more at llmstxt.org'
  };
  
  // Robots.txt
  details.robots_txt_proper = {
    message: checks.robots_txt_proper
      ? 'Robots.txt allows AI crawlers'
      : 'Robots.txt may block AI crawlers',
    recommendation: checks.robots_txt_proper
      ? 'Your robots.txt properly allows AI crawlers like GPTBot, Claude-Web, and PerplexityBot to access your content.'
      : 'Update your robots.txt to explicitly allow AI crawlers: GPTBot (OpenAI), Claude-Web (Anthropic), PerplexityBot, and GoogleOther (Gemini).'
  };
  
  // Sitemap
  details.sitemap_exists = {
    message: checks.sitemap_exists
      ? `XML sitemap found at ${normalizedUrl}/sitemap.xml`
      : 'No XML sitemap detected',
    recommendation: checks.sitemap_exists
      ? 'Your sitemap helps AI platforms discover and index all your important pages efficiently.'
      : 'Create an XML sitemap and reference it in your robots.txt. This helps AI platforms discover all your pages systematically.'
  };
  
  // Meta titles
  details.meta_titles_present = {
    message: checks.meta_titles_present
      ? 'Meta titles are present on homepage'
      : 'Meta title is missing on homepage',
    recommendation: checks.meta_titles_present
      ? 'Good! Descriptive titles help AI platforms understand page context and use appropriate titles when citing your content.'
      : 'Add unique, descriptive meta titles (50-60 characters) to all pages. AI platforms use these to understand context and cite your content accurately.'
  };
  
  // Meta descriptions
  details.meta_descriptions_present = {
    message: checks.meta_descriptions_present
      ? 'Meta description found on homepage'
      : 'Meta description is missing',
    recommendation: checks.meta_descriptions_present
      ? 'Meta descriptions provide valuable summaries that AI platforms use to understand and represent your content.'
      : 'Write compelling meta descriptions (150-160 characters) for all pages. AI platforms use these to summarize and understand your content better.'
  };
  
  // Structured data
  details.structured_data_basic = {
    message: checks.structured_data_basic
      ? 'Schema.org structured data detected'
      : 'No structured data found',
    recommendation: checks.structured_data_basic
      ? 'Excellent! Structured data makes your content highly understandable to AI platforms. Consider adding more schema types (Product, Article, FAQ).'
      : 'Implement Schema.org markup (JSON-LD) for Organization, Product, Article, and FAQ content. This makes your content machine-readable and preferred by AI platforms.'
  };
  
  // SSL
  details.ssl_enabled = {
    message: checks.ssl_enabled
      ? 'SSL certificate is active (HTTPS)'
      : 'Site is not using HTTPS',
    recommendation: checks.ssl_enabled
      ? 'Great! HTTPS is essential for security and trust. AI platforms strongly prefer HTTPS sites.'
      : 'CRITICAL: Install an SSL certificate immediately. AI platforms may not index or cite HTTP-only sites due to security concerns.'
  };
  
  // Mobile friendly
  details.mobile_friendly = {
    message: checks.mobile_friendly
      ? 'Viewport meta tag detected (mobile-friendly)'
      : 'Missing viewport configuration',
    recommendation: checks.mobile_friendly
      ? 'Mobile-friendly design ensures good user experience. AI platforms consider this when evaluating content quality.'
      : 'Add viewport meta tag and implement responsive design. AI platforms evaluate user experience, and mobile-friendliness is a key factor.'
  };
  
  return details;
}


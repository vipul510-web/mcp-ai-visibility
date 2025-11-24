#!/usr/bin/env python3
"""
Automated Blog Post Generator for SellOnLLM
Generates SEO-optimized blog posts from target keywords
"""

import os
import json
import argparse
import re
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
import markdown

# Load environment variables
load_dotenv()

# Initialize OpenAI client (new API format for v1.0+)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def generate_blog_content(keyword, search_volume, target_word_count=3000):
    """
    Generate blog post content using OpenAI GPT-4
    """
    
    system_prompt = """You are an expert SEO content writer specializing in AI marketing, ChatGPT SEO, and e-commerce optimization. 
    Write comprehensive, well-researched blog posts that are helpful, accurate, and optimized for search engines.
    Always include real examples, actionable tips, and maintain a professional yet approachable tone."""

    user_prompt = f"""
    Create a comprehensive, SEO-optimized blog post about: {keyword}
    
    Requirements:
    - Target word count: {target_word_count} words
    - Primary keyword: {keyword} (use naturally 8-12 times)
    - Search volume: {search_volume} monthly searches
    - Target audience: E-commerce merchants, Shopify store owners, digital marketers
    
    Content Structure:
    1. Introduction (200-300 words)
       - Hook with compelling statistic or question
       - Briefly explain what the post covers
       - Value proposition: what reader will learn
    
    2. What is {keyword}? (300-400 words)
       - Clear definition
       - Context and background
       - Why it matters for businesses
    
    3. Why {keyword} Matters (400-500 words)
       - Key benefits
       - Industry statistics and data
       - Real-world impact examples
       - ROI considerations
    
    4. How to Optimize for {keyword} - Step-by-Step Guide (1000-1500 words)
       - Detailed, actionable steps
       - Code examples where relevant
       - Screenshot descriptions
       - Common pitfalls to avoid
    
    5. Best Practices (500-600 words)
       - Pro tips and strategies
       - Common mistakes to avoid
       - Advanced techniques
       - Industry expert recommendations
    
    6. Tools & Resources (300-400 words)
       - Recommended tools
       - Free resources
       - Further reading
       - Links to relevant guides
    
    7. Case Study / Real Examples (400-500 words)
       - Real success stories
       - Before/after comparisons
       - Results and metrics
       - Lessons learned
    
    8. Frequently Asked Questions (300-400 words)
       - 5-7 common questions
       - Detailed answers
       - Address common concerns
    
    9. Conclusion (200-300 words)
       - Summary of key points
       - Call-to-action
       - Next steps
    
    SEO Requirements:
    - Use H2 headings for main sections
    - Use H3 headings for subsections
    - Include the keyword in H1 (title) and first paragraph
    - Use related keywords naturally throughout
    - Include internal linking opportunities (mention SellOnLLM tools)
    - Use bullet points and numbered lists for readability
    - Write in active voice
    - Keep sentences concise (under 20 words when possible)
    - Use transition words to improve flow
    
    Brand Mentions:
    - Naturally mention SellOnLLM's Shopify app where relevant
    - Link to SellOnLLM's free LLM audit tool
    - Reference SellOnLLM's features when discussing solutions
    
    Tone & Style:
    - Professional yet approachable
    - Helpful and educational
    - Include data and statistics where relevant
    - Use examples and analogies
    - Write in second person (you/your) for engagement
    
    Write the complete blog post now:
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=4000,
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        print(f"Error generating content: {str(e)}")
        return None


def generate_metadata(keyword, content, search_volume):
    """
    Generate SEO metadata for blog post
    """
    
    # Generate slug from keyword
    slug = keyword.lower().replace(" ", "-").replace("/", "-").replace("'", "")
    
    # Generate title (55-60 characters for optimal SEO)
    title = f"{keyword}: Complete Guide | SellOnLLM"
    if len(title) > 60:
        title = f"{keyword} Guide | SellOnLLM"
    
    # Generate meta description (155-160 characters)
    meta_description = f"Learn everything about {keyword}. Comprehensive step-by-step guide with examples, best practices, and actionable tips. Search volume: {search_volume}/mo."
    if len(meta_description) > 160:
        meta_description = f"Complete guide to {keyword}. Step-by-step instructions, best practices, and real examples. Perfect for e-commerce merchants."
    
    # Extract H2 headings for table of contents
    h2_headings = []
    for line in content.split("\n"):
        if line.startswith("## "):
            h2_headings.append(line.replace("## ", "").strip())
    
    # Generate canonical URL
    canonical_url = f"https://sellonllm.com/blog/{slug}"
    
    return {
        "title": title,
        "meta_title": title,
        "meta_description": meta_description,
        "slug": slug,
        "keyword": keyword,
        "search_volume": search_volume,
        "word_count": len(content.split()),
        "h2_headings": h2_headings,
        "canonical_url": canonical_url,
        "date_published": datetime.now().isoformat(),
        "date_modified": datetime.now().isoformat(),
    }


def convert_markdown_to_html(markdown_content):
    """
    Convert markdown content to HTML using markdown library
    """
    # Configure markdown with extensions
    md = markdown.Markdown(extensions=[
        'fenced_code',
        'tables',
        'nl2br',
        'toc',
        'extra'
    ])
    
    html_content = md.convert(markdown_content)
    
    # Post-process: Add internal links for SellOnLLM mentions
    html_content = re.sub(
        r'(SellOnLLM|free LLM audit|Shopify app)',
        lambda m: {
            'SellOnLLM': '<a href="/index.html#shopify">SellOnLLM</a>',
            'free LLM audit': '<a href="/free-llm-audit.html">free LLM audit</a>',
            'Shopify app': '<a href="https://apps.shopify.com/llm-analytics" target="_blank" rel="noopener noreferrer">Shopify app</a>'
        }.get(m.group(1), m.group(1)),
        html_content,
        flags=re.IGNORECASE
    )
    
    # Extract first H1 as title if found
    h1_match = re.search(r'<h1>(.*?)</h1>', html_content)
    if h1_match:
        # Remove H1 from content (we'll use it in the title tag)
        html_content = re.sub(r'<h1>.*?</h1>\s*', '', html_content, count=1)
    
    return html_content, h1_match.group(1) if h1_match else None


def extract_title_from_markdown(content):
    """
    Extract the first H1 title from markdown content
    """
    lines = content.split('\n')
    for line in lines:
        if line.startswith('# '):
            return line.replace('# ', '').strip()
    return None


def format_blog_post_html(metadata, markdown_content):
    """
    Format blog post as complete HTML page with header, footer, and styling
    """
    
    # Convert markdown to HTML
    html_content, extracted_h1 = convert_markdown_to_html(markdown_content)
    
    # Use extracted H1 title or fall back to metadata title
    post_title = extracted_h1 or metadata['title'].replace(' | SellOnLLM', '')
    
    # Format date for display
    date_obj = datetime.fromisoformat(metadata['date_published'])
    formatted_date = date_obj.strftime('%B %d, %Y')
    iso_date = date_obj.strftime('%Y-%m-%d')
    
    # Calculate reading time (average 200 words per minute)
    reading_time = max(1, round(metadata['word_count'] / 200))
    
    # Get the blog-specific styles
    blog_styles = """
        .blog-post-page {
            padding: 8rem 0 4rem;
            background: var(--bg-color);
        }
        
        .blog-post__container {
            max-width: 900px;
            margin: 0 auto;
            background: var(--bg-card);
            padding: 3rem;
            border-radius: var(--radius-xl);
            box-shadow: var(--shadow-md);
        }
        
        .blog-post__header {
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
            border-bottom: 2px solid var(--border-color);
        }
        
        .blog-post__title {
            font-size: 2.5rem;
            font-weight: 800;
            color: var(--text-primary);
            margin-bottom: 1rem;
            line-height: 1.2;
        }
        
        .blog-post__meta {
            display: flex;
            align-items: center;
            gap: 1rem;
            font-size: 0.9375rem;
            color: var(--text-secondary);
            flex-wrap: wrap;
        }
        
        .blog-post__content {
            font-size: 1.125rem;
            line-height: 1.8;
            color: var(--text-secondary);
        }
        
        .blog-post__content h2 {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text-primary);
            margin-top: 2.5rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid var(--border-color);
        }
        
        .blog-post__content h3 {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-primary);
            margin-top: 2rem;
            margin-bottom: 1rem;
        }
        
        .blog-post__content p {
            margin-bottom: 1.5rem;
        }
        
        .blog-post__content ul,
        .blog-post__content ol {
            margin-left: 2rem;
            margin-bottom: 1.5rem;
        }
        
        .blog-post__content li {
            margin-bottom: 0.75rem;
        }
        
        .blog-post__content strong {
            color: var(--text-primary);
            font-weight: 600;
        }
        
        .blog-post__content blockquote {
            border-left: 4px solid var(--primary-color);
            padding-left: 1.5rem;
            margin: 1.5rem 0;
            font-style: italic;
            color: var(--text-secondary);
        }
        
        .blog-post__content a {
            color: var(--primary-color);
            text-decoration: none;
        }
        
        .blog-post__content a:hover {
            text-decoration: underline;
        }
        
        .blog-post__cta {
            background: linear-gradient(135deg, var(--primary-color), var(--primary-color-dark));
            color: white;
            padding: 2.5rem;
            border-radius: var(--radius-lg);
            margin-top: 3rem;
            text-align: center;
        }
        
        .blog-post__cta h2 {
            color: white;
            border: none;
            margin-top: 0;
            margin-bottom: 1rem;
        }
        
        .blog-post__cta p {
            color: rgba(255, 255, 255, 0.95);
            margin-bottom: 1.5rem;
        }
        
        .blog-post__cta .button {
            background: white;
            color: var(--primary-color);
        }
        
        .blog-post__cta .button:hover {
            background: rgba(255, 255, 255, 0.9);
        }
        
        @media (max-width: 768px) {
            .blog-post__container {
                padding: 2rem 1.5rem;
            }
            
            .blog-post__title {
                font-size: 2rem;
            }
        }
    """
    
    # Escape HTML in metadata for JSON
    def escape_json(s):
        return json.dumps(str(s))[1:-1]
    
    html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    
    <!-- Primary SEO Meta Tags -->
    <title>{escape_json(metadata['meta_title'])}</title>
    <meta name="title" content="{escape_json(metadata['meta_title'])}">
    <meta name="description" content="{escape_json(metadata['meta_description'])}">
    <meta name="keywords" content="{escape_json(metadata['keyword'])}">
    <meta name="author" content="SellOnLLM">
    <meta name="publisher" content="SellOnLLM">
    <meta name="copyright" content="SellOnLLM">
    <meta name="language" content="English">
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
    <meta name="googlebot" content="index, follow">
    <meta name="bingbot" content="index, follow">
    <link rel="canonical" href="{metadata['canonical_url']}">
    <link rel="alternate" href="{metadata['canonical_url']}" hreflang="en">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="{metadata['canonical_url']}">
    <meta property="og:site_name" content="SellOnLLM">
    <meta property="og:title" content="{escape_json(metadata['meta_title'])}">
    <meta property="og:description" content="{escape_json(metadata['meta_description'])}">
    <meta property="og:image" content="https://sellonllm.com/images/logo.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="{escape_json(post_title)}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:locale" content="en_US">
    <meta property="article:published_time" content="{iso_date}T00:00:00+00:00">
    <meta property="article:modified_time" content="{iso_date}T00:00:00+00:00">
    <meta property="article:author" content="SellOnLLM">
    <meta property="article:publisher" content="https://www.facebook.com/sellonllm">
    
    <!-- Twitter / X Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@sellonllm">
    <meta name="twitter:creator" content="@sellonllm">
    <meta name="twitter:url" content="{metadata['canonical_url']}">
    <meta name="twitter:title" content="{escape_json(metadata['meta_title'])}">
    <meta name="twitter:description" content="{escape_json(metadata['meta_description'])}">
    <meta name="twitter:image" content="https://sellonllm.com/images/logo.png">
    <meta name="twitter:image:alt" content="{escape_json(post_title)}">
    <meta name="twitter:domain" content="sellonllm.com">
    
    <!-- Schema.org Article -->
    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": {json.dumps(post_title)},
      "description": {json.dumps(metadata['meta_description'])},
      "image": "https://sellonllm.com/images/logo.png",
      "datePublished": "{iso_date}T00:00:00+00:00",
      "dateModified": "{iso_date}T00:00:00+00:00",
      "author": {{
        "@type": "Organization",
        "name": "SellOnLLM",
        "url": "https://sellonllm.com"
      }},
      "publisher": {{
        "@type": "Organization",
        "name": "SellOnLLM",
        "logo": {{
          "@type": "ImageObject",
          "url": "https://sellonllm.com/images/logo.png",
          "width": 1200,
          "height": 630
        }},
        "url": "https://sellonllm.com"
      }},
      "mainEntityOfPage": {{
        "@type": "WebPage",
        "@id": {json.dumps(metadata['canonical_url'])}
      }},
      "articleSection": "AI Marketing",
      "keywords": {json.dumps(metadata['keyword'])},
      "wordCount": {metadata['word_count']},
      "inLanguage": "en-US"
    }}
    </script>
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" href="../images/logo.png">
    
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    
    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-7KK7VYDR9D"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){{dataLayer.push(arguments);}}
      gtag('js', new Date());
      gtag('config', 'G-7KK7VYDR9D');
    </script>
    
    <!-- Styles -->
    <link rel="stylesheet" href="../css/style.css">
    <style>
{blog_styles}
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header" id="header">
        <nav class="nav container">
            <a href="/" class="nav__logo">
                <img src="../images/logo.png" alt="SellOnLLM" class="logo__icon" width="32" height="32">
                <span class="logo-text">Sell<span class="logo-highlight">On</span>LLM</span>
            </a>
            
            <div class="nav__menu" id="nav-menu">
                <ul class="nav__list">
                    <li class="nav__item">
                        <a href="/index.html#features" class="nav__link">Features</a>
                    </li>
                    <li class="nav__item">
                        <a href="/index.html#shopify" class="nav__link">Shopify App</a>
                    </li>
                    <li class="nav__item">
                        <a href="/index.html#faq" class="nav__link">FAQ</a>
                    </li>
                    <li class="nav__item">
                        <a href="/blog/" class="nav__link">Blog</a>
                    </li>
                    <li class="nav__item">
                        <a href="/free-llm-audit.html" class="nav__link">Free LLM Audit</a>
                    </li>
                </ul>
                <div class="nav__close" id="nav-close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </div>
            </div>
            
            <div class="nav__btns">
                <a href="https://apps.shopify.com/llm-analytics" target="_blank" rel="noopener noreferrer" class="button button--primary">Try Shopify App</a>
                <div class="nav__toggle" id="nav-toggle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </div>
            </div>
        </nav>
    </header>

    <!-- Blog Post Content -->
    <section class="blog-post-page section">
        <div class="container">
            <div class="blog-post__container">
                <header class="blog-post__header">
                    <a href="/blog/" class="button button--ghost" style="margin-bottom: 1.5rem; display: inline-flex; align-items: center; gap: 0.5rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                        Back to Blog
                    </a>
                    
                    <h1 class="blog-post__title">{post_title}</h1>
                    
                    <div class="blog-post__meta">
                        <time datetime="{iso_date}">{formatted_date}</time>
                        <span>•</span>
                        <span>{metadata['word_count']} words</span>
                        <span>•</span>
                        <span>{reading_time} min read</span>
                    </div>
                </header>
                
                <article class="blog-post__content">
{html_content}
                </article>
                
                <!-- CTA Section -->
                <div class="blog-post__cta">
                    <h2>Ready to Track Your AI Traffic?</h2>
                    <p>Install our Shopify app and start tracking traffic & conversions from ChatGPT, Claude, and Perplexity. Get your AI brand visibility score and optimization suggestions.</p>
                    <a href="https://apps.shopify.com/llm-analytics" target="_blank" rel="noopener noreferrer" class="button button--primary button--large">
                        Try Shopify App - Free 3-Day Trial
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 0.5rem;">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </a>
                    <p style="margin-top: 1rem; font-size: 0.875rem; opacity: 0.9;">$9.99/month • 3-day free trial • No credit card required</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="footer" id="contact">
        <div class="container">
            <div class="footer__content">
                <div class="footer__section">
                    <a href="/" class="footer__logo">
                        <img src="../images/logo.png" alt="SellOnLLM" class="logo__icon" width="40" height="40">
                        <span class="logo-text">Sell<span class="logo-highlight">On</span>LLM</span>
                    </a>
                    <p class="footer__description">
                        The leading platform for ranking and selling on AI platforms. Optimize your presence on ChatGPT, Claude, Perplexity, and more.
                    </p>
                    <div class="footer__social">
                        <a href="https://twitter.com/sellonllm" class="footer__social-link" aria-label="Twitter">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                            </svg>
                        </a>
                        <a href="https://linkedin.com/company/sellonllm" class="footer__social-link" aria-label="LinkedIn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                                <rect x="2" y="9" width="4" height="12"></rect>
                                <circle cx="4" cy="4" r="2"></circle>
                            </svg>
                        </a>
                        <a href="https://github.com/sellonllm" class="footer__social-link" aria-label="GitHub">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                            </svg>
                        </a>
                        <a href="https://youtube.com/@sellonllm" class="footer__social-link" aria-label="YouTube">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
                                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
                            </svg>
                        </a>
                    </div>
                </div>
                
                <div class="footer__section">
                    <h4 class="footer__title">Product</h4>
                    <ul class="footer__list">
                        <li><a href="/index.html#features">Features</a></li>
                        <li><a href="/index.html#shopify">Shopify App</a></li>
                        <li><a href="/free-llm-audit.html">Free LLM Audit</a></li>
                    </ul>
                </div>
                
                <div class="footer__section">
                    <h4 class="footer__title">Company</h4>
                    <ul class="footer__list">
                        <li><a href="/about-us.html">About Us</a></li>
                        <li><a href="/contact-us.html">Contact Us</a></li>
                    </ul>
                </div>
                
                <div class="footer__section">
                    <h4 class="footer__title">Legal</h4>
                    <ul class="footer__list">
                        <li><a href="/privacy-policy.html">Privacy Policy</a></li>
                    </ul>
                </div>
            </div>
            
            <div class="footer__bottom">
                <p class="footer__copy">
                    &copy; 2025 SellOnLLM. All rights reserved.
                </p>
                <div class="footer__badges">
                    <span class="footer__badge">Made with ❤️ for the AI era</span>
                </div>
            </div>
        </div>
    </footer>

    <!-- Scripts -->
    <script src="../js/script.js"></script>
</body>
</html>"""
    
    return html_template


def save_blog_post(metadata, content, output_dir="output", save_to_blog_dir=False):
    """
    Save blog post as HTML and JSON metadata
    
    Args:
        metadata: Blog post metadata
        content: Markdown content
        output_dir: Output directory (default: "output")
        save_to_blog_dir: If True, also save to ../blog/ directory for production
    """
    
    # Create output directory if it doesn't exist
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    slug = metadata['slug']
    
    # Generate HTML file
    html_content = format_blog_post_html(metadata, content)
    
    # Save HTML to output directory
    html_path = Path(output_dir) / f"{slug}.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    # Save metadata as JSON
    json_path = Path(output_dir) / f"{slug}.metadata.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    
    # Save markdown content
    md_path = Path(output_dir) / f"{slug}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    # If save_to_blog_dir is True, also save to production blog directory
    if save_to_blog_dir:
        blog_dir = Path(__file__).parent.parent / "blog"
        blog_dir.mkdir(exist_ok=True)
        
        blog_html_path = blog_dir / f"{slug}.html"
        with open(blog_html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        
        print(f"✅ Blog post saved to production:")
        print(f"   Production: {blog_html_path}")
        
        # Automatically update blog index page
        try:
            update_script = Path(__file__).parent / "update_blog_index.py"
            if update_script.exists():
                import subprocess
                result = subprocess.run(
                    ["python3", str(update_script)],
                    capture_output=True,
                    text=True,
                    cwd=str(Path(__file__).parent)
                )
                if result.returncode == 0:
                    print(f"   Blog index automatically updated!")
                else:
                    print(f"   ⚠️  Blog index update skipped (you can run it manually)")
        except Exception as e:
            print(f"   ⚠️  Blog index update skipped: {e}")
        
        # Automatically update sitemap
        try:
            sitemap_script = Path(__file__).parent / "update_sitemap.py"
            if sitemap_script.exists():
                import subprocess
                result = subprocess.run(
                    ["python3", str(sitemap_script)],
                    capture_output=True,
                    text=True,
                    cwd=str(Path(__file__).parent)
                )
                if result.returncode == 0:
                    print(f"   Sitemap automatically updated!")
                else:
                    print(f"   ⚠️  Sitemap update skipped (you can run it manually)")
        except Exception as e:
            print(f"   ⚠️  Sitemap update skipped: {e}")
        
        # Automatically update llm.txt
        try:
            llm_script = Path(__file__).parent / "update_llm_txt.py"
            if llm_script.exists():
                import subprocess
                result = subprocess.run(
                    ["python3", str(llm_script)],
                    capture_output=True,
                    text=True,
                    cwd=str(Path(__file__).parent)
                )
                if result.returncode == 0:
                    print(f"   llm.txt automatically updated!")
                else:
                    print(f"   ⚠️  llm.txt update skipped (you can run it manually)")
        except Exception as e:
            print(f"   ⚠️  llm.txt update skipped: {e}")
    
    print(f"✅ Blog post saved:")
    print(f"   HTML: {html_path}")
    print(f"   Markdown: {md_path}")
    print(f"   Metadata: {json_path}")
    
    return html_path


def main():
    parser = argparse.ArgumentParser(description="Generate SEO-optimized blog post")
    parser.add_argument("--keyword", required=True, help="Target keyword")
    parser.add_argument("--volume", type=int, required=True, help="Search volume")
    parser.add_argument("--words", type=int, default=3000, help="Target word count")
    parser.add_argument("--output", default="output", help="Output directory")
    parser.add_argument("--deploy", action="store_true", help="Also save to blog/ directory for production deployment")
    
    args = parser.parse_args()
    
    print(f"📝 Generating blog post for: {args.keyword}")
    print(f"   Search volume: {args.volume}/mo")
    print(f"   Target word count: {args.words}")
    print(f"\n⏳ Generating content... (this may take 1-2 minutes)\n")
    
    # Generate content
    content = generate_blog_content(args.keyword, args.volume, args.words)
    
    if not content:
        print("❌ Failed to generate content")
        return
    
    # Generate metadata
    metadata = generate_metadata(args.keyword, content, args.volume)
    
    # Save blog post
    html_path = save_blog_post(metadata, content, args.output, save_to_blog_dir=args.deploy)
    
    print(f"\n✨ Blog post generated successfully!")
    print(f"\n📊 Stats:")
    print(f"   Word count: {metadata['word_count']}")
    print(f"   H2 headings: {len(metadata['h2_headings'])}")
    print(f"   Slug: {metadata['slug']}")
    print(f"   URL: /blog/{metadata['slug']}.html")
    
    if args.deploy:
        print(f"\n✅ Blog post ready for deployment!")
        print(f"   File saved to: blog/{metadata['slug']}.html")
        print(f"\n📝 Next steps:")
        print(f"   1. Review the generated content: blog/{metadata['slug']}.html")
        print(f"   2. Add any real examples or screenshots if needed")
        print(f"   3. Deploy to production: vercel --prod")
    else:
        print(f"\n📝 Next steps:")
        print(f"   1. Review the generated content: {html_path}")
        print(f"   2. Add real examples and screenshots")
        print(f"   3. Review and update if needed")
        print(f"   4. Run with --deploy flag to save to blog/ directory")
        print(f"   5. Deploy to production: vercel --prod")


if __name__ == "__main__":
    main()


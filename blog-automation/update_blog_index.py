#!/usr/bin/env python3
"""
Automatically update blog/index.html when new blog posts are added
Scans the blog/ directory and generates blog cards for all posts
"""

import os
import re
import html
from pathlib import Path
from datetime import datetime


def extract_blog_metadata(html_path):
    """
    Extract metadata from blog post HTML file using regex (no external dependencies)
    """
    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract title from h1 tag
        title_match = re.search(r'<h1 class="blog-post__title">(.*?)</h1>', content, re.DOTALL)
        title = title_match.group(1).strip() if title_match else None
        
        # Extract meta description
        meta_desc_match = re.search(r'<meta name="description" content="([^"]*)"', content)
        description = meta_desc_match.group(1) if meta_desc_match else ''
        
        # Extract date
        time_match = re.search(r'<time datetime="([^"]*)">([^<]*)</time>', content)
        date_str = time_match.group(1) if time_match else ''
        formatted_date = time_match.group(2).strip() if time_match else ''
        
        # Extract word count
        word_count_match = re.search(r'<span>(\d+.*?words)</span>', content)
        word_count = word_count_match.group(1) if word_count_match else '0 words'
        
        # Extract reading time
        reading_time_match = re.search(r'<span>(\d+.*?min read)</span>', content)
        reading_time = reading_time_match.group(1) if reading_time_match else '5 min read'
        
        # Get slug from filename
        slug = html_path.stem
        
        # Calculate reading time if not found (average 200 words per minute)
        if reading_time == '5 min read' and word_count != '0 words':
            try:
                words = int(re.search(r'(\d+)', word_count).group(1))
                reading_time = f"{max(1, round(words / 200))} min read"
            except:
                pass
        
        return {
            'slug': slug,
            'title': title,
            'description': description,
            'date': date_str,
            'formatted_date': formatted_date,
            'word_count': word_count,
            'reading_time': reading_time,
            'url': f"/blog/{slug}.html"
        }
    except Exception as e:
        print(f"Error extracting metadata from {html_path}: {e}")
        return None


def generate_blog_index(blog_dir="../blog"):
    """
    Generate blog index page by scanning all blog posts
    """
    blog_path = Path(__file__).parent.parent / "blog"
    
    # Find all blog post HTML files (excluding index.html)
    blog_posts = []
    for html_file in blog_path.glob("*.html"):
        if html_file.name == "index.html":
            continue
        
        metadata = extract_blog_metadata(html_file)
        if metadata:
            blog_posts.append(metadata)
    
    # Sort by date (newest first)
    blog_posts.sort(key=lambda x: x['date'], reverse=True)
    
    if not blog_posts:
        print("No blog posts found!")
        return
    
    # Read the existing index.html template
    index_path = blog_path / "index.html"
    with open(index_path, 'r', encoding='utf-8') as f:
        index_content = f.read()
    
    # Generate blog cards HTML
    blog_cards_html = ""
    for post in blog_posts:
        # Truncate description to ~150 characters
        desc = post['description'].replace('Search volume: 8100/mo.', '').replace('Search volume: 5400/mo.', '').strip()
        if len(desc) > 150:
            desc = desc[:147] + "..."
        
        blog_cards_html += f"""
                <article class="blog-card">
                    <div class="blog-card__content">
                        <h2 class="blog-card__title">
                            <a href="{post['url']}">{html.escape(post['title'])}</a>
                        </h2>
                        <div class="blog-card__meta">
                            <time datetime="{post['date']}">{post['formatted_date']}</time>
                            <span>•</span>
                            <span>{post['word_count']}</span>
                            <span>•</span>
                            <span>{post['reading_time']}</span>
                        </div>
                        <p class="blog-card__description">
                            {html.escape(desc)}
                        </p>
                        <a href="{post['url']}" class="blog-card__link">
                            Read More
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </a>
                    </div>
                </article>
"""
    
    # Replace the blog-grid content (match everything between opening and closing div)
    pattern = r'<div class="blog-grid">.*?</div>\s*(?=</div>\s*</div>\s*</section>)'
    replacement = f'<div class="blog-grid">{blog_cards_html}\n            </div>'
    
    updated_content = re.sub(pattern, replacement, index_content, flags=re.DOTALL)
    
    # If pattern didn't match, try a simpler approach - replace after blog-grid opening tag
    if '<div class="blog-grid">' in updated_content and blog_cards_html.strip() not in updated_content:
        # Find the blog-grid div and replace its content
        start_marker = '<div class="blog-grid">'
        end_marker = '</div>'
        start_idx = updated_content.find(start_marker)
        if start_idx != -1:
            # Find the matching closing div (count nested divs)
            idx = start_idx + len(start_marker)
            depth = 1
            end_idx = idx
            while depth > 0 and end_idx < len(updated_content):
                if updated_content[end_idx:end_idx+5] == '<div ':
                    depth += 1
                elif updated_content[end_idx:end_idx+6] == '</div>':
                    depth -= 1
                    if depth == 0:
                        break
                end_idx += 1
            
            if end_idx < len(updated_content):
                updated_content = (
                    updated_content[:start_idx + len(start_marker)] +
                    blog_cards_html + "\n            " +
                    updated_content[end_idx:]
                )
    
    # Write updated index.html
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    print(f"✅ Blog index updated successfully!")
    print(f"   Found {len(blog_posts)} blog post(s):")
    for post in blog_posts:
        print(f"   - {post['title']} ({post['slug']}.html)")


if __name__ == "__main__":
    print("🔄 Updating blog index page...\n")
    generate_blog_index()


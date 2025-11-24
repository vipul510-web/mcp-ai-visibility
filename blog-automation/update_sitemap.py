#!/usr/bin/env python3
"""
Automatically update sitemap.xml when new blog posts or pages are added
Scans the blog/ directory and generates sitemap entries for all posts
"""

import os
import re
from pathlib import Path
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom


def get_file_modification_date(file_path):
    """Get file modification date in YYYY-MM-DD format"""
    try:
        mtime = os.path.getmtime(file_path)
        return datetime.fromtimestamp(mtime).strftime('%Y-%m-%d')
    except:
        return datetime.now().strftime('%Y-%m-%d')


def extract_blog_posts(blog_dir):
    """Extract all blog posts from blog directory"""
    blog_path = Path(blog_dir)
    posts = []
    
    for html_file in blog_path.glob("*.html"):
        if html_file.name == "index.html":
            continue
        
        # Get modification date
        lastmod = get_file_modification_date(html_file)
        
        # Extract date from HTML if available
        try:
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()
                date_match = re.search(r'<time datetime="([^"]*)"', content)
                if date_match:
                    lastmod = date_match.group(1)[:10]  # Get YYYY-MM-DD
        except:
            pass
        
        slug = html_file.stem
        posts.append({
            'url': f'https://sellonllm.com/blog/{slug}.html',
            'lastmod': lastmod,
            'changefreq': 'monthly',
            'priority': '0.8'
        })
    
    # Sort by date (newest first)
    posts.sort(key=lambda x: x['lastmod'], reverse=True)
    return posts


def generate_sitemap():
    """Generate complete sitemap.xml"""
    
    # Root element
    urlset = Element('urlset')
    urlset.set('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
    urlset.set('xmlns:image', 'http://www.google.com/schemas/sitemap-image/1.1')
    urlset.set('xmlns:news', 'http://www.google.com/schemas/sitemap-news/0.9')
    
    # Base path
    base_path = Path(__file__).parent.parent
    
    # 1. Homepage
    home_url = SubElement(urlset, 'url')
    SubElement(home_url, 'loc').text = 'https://sellonllm.com'
    SubElement(home_url, 'lastmod').text = datetime.now().strftime('%Y-%m-%d')
    SubElement(home_url, 'changefreq').text = 'daily'
    SubElement(home_url, 'priority').text = '1.0'
    
    # 2. Blog Index Page
    blog_index = base_path / 'blog' / 'index.html'
    if blog_index.exists():
        blog_url = SubElement(urlset, 'url')
        SubElement(blog_url, 'loc').text = 'https://sellonllm.com/blog/'
        SubElement(blog_url, 'lastmod').text = get_file_modification_date(blog_index)
        SubElement(blog_url, 'changefreq').text = 'weekly'
        SubElement(blog_url, 'priority').text = '0.9'
    
    # 3. All Blog Posts
    blog_posts = extract_blog_posts(base_path / 'blog')
    for post in blog_posts:
        post_url = SubElement(urlset, 'url')
        SubElement(post_url, 'loc').text = post['url']
        SubElement(post_url, 'lastmod').text = post['lastmod']
        SubElement(post_url, 'changefreq').text = post['changefreq']
        SubElement(post_url, 'priority').text = post['priority']
    
    # 4. Static Pages
    static_pages = [
        ('free-llm-audit.html', 'monthly', '0.9'),
        ('about-us.html', 'monthly', '0.7'),
        ('contact-us.html', 'monthly', '0.6'),
        ('privacy-policy.html', 'monthly', '0.5'),
    ]
    
    for page_file, changefreq, priority in static_pages:
        page_path = base_path / page_file
        if page_path.exists():
            page_url = SubElement(urlset, 'url')
            SubElement(page_url, 'loc').text = f'https://sellonllm.com/{page_file}'
            SubElement(page_url, 'lastmod').text = get_file_modification_date(page_path)
            SubElement(page_url, 'changefreq').text = changefreq
            SubElement(page_url, 'priority').text = priority
    
    # 5. Important anchor sections (for deep linking)
    anchor_sections = [
        ('#features', 'weekly', '0.8'),
        ('#shopify', 'weekly', '0.8'),
        ('#faq', 'monthly', '0.7'),
    ]
    
    for anchor, changefreq, priority in anchor_sections:
        anchor_url = SubElement(urlset, 'url')
        SubElement(anchor_url, 'loc').text = f'https://sellonllm.com{anchor}'
        SubElement(anchor_url, 'lastmod').text = datetime.now().strftime('%Y-%m-%d')
        SubElement(anchor_url, 'changefreq').text = changefreq
        SubElement(anchor_url, 'priority').text = priority
    
    # Convert to pretty XML
    rough_string = tostring(urlset, encoding='unicode')
    reparsed = minidom.parseString(rough_string)
    pretty_xml = reparsed.toprettyxml(indent='    ', encoding='UTF-8').decode('utf-8')
    
    # Write sitemap with proper XML formatting
    sitemap_path = base_path / 'sitemap.xml'
    with open(sitemap_path, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n')
        f.write('        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n')
        f.write('        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n')
        f.write('    \n')
        
        # Extract and format each URL entry
        urls = urlset.findall('url')
        for url_elem in urls:
            f.write('    <!-- ')
            loc = url_elem.find('loc').text
            if 'blog/' in loc:
                if loc.endswith('/'):
                    f.write('Blog Index Page')
                else:
                    f.write('Blog Post')
            elif loc.endswith('.html'):
                f.write('Page')
            elif '#' in loc:
                f.write('Anchor Section')
            else:
                f.write('Homepage')
            f.write(' -->\n')
            f.write('    <url>\n')
            
            for child in url_elem:
                tag_name = child.tag
                value = child.text
                f.write(f'        <{tag_name}>{value}</{tag_name}>\n')
            
            f.write('    </url>\n')
            f.write('    \n')
        
        f.write('</urlset>\n')
    
    # Print summary
    print(f"✅ Sitemap updated successfully!")
    print(f"   Location: {sitemap_path}")
    print(f"   Total URLs: {len(urlset.findall('url'))}")
    print(f"   - Homepage: 1")
    print(f"   - Blog index: 1")
    print(f"   - Blog posts: {len(blog_posts)}")
    print(f"   - Static pages: {len(static_pages)}")
    print(f"   - Anchor sections: {len(anchor_sections)}")
    
    if blog_posts:
        print(f"\n   Blog posts included:")
        for post in blog_posts[:5]:  # Show first 5
            print(f"   - {post['url']} (lastmod: {post['lastmod']})")
        if len(blog_posts) > 5:
            print(f"   ... and {len(blog_posts) - 5} more")


if __name__ == "__main__":
    print("🔄 Updating sitemap.xml...\n")
    generate_sitemap()


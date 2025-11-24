#!/usr/bin/env python3
"""
Batch blog post generator for SellOnLLM
Generates multiple blog posts from keyword list
"""

import json
import time
from pathlib import Path
from generate_blog_post import generate_blog_content, generate_metadata, save_blog_post

# Note: Make sure to activate virtual environment before running
# source venv/bin/activate

# Keyword list with search volumes
KEYWORDS = [
    {"keyword": "ChatGPT SEO", "volume": 5400, "priority": "high"},
    {"keyword": "AI marketing", "volume": 8100, "priority": "high"},
    {"keyword": "ChatGPT traffic", "volume": 3600, "priority": "high"},
    {"keyword": "AI platform optimization", "volume": 1300, "priority": "high"},
    {"keyword": "ChatGPT for ecommerce", "volume": 2400, "priority": "high"},
    {"keyword": "LLM marketing", "volume": 1900, "priority": "high"},
    {"keyword": "AI search optimization", "volume": 1800, "priority": "high"},
    {"keyword": "ChatGPT instant checkout", "volume": 2900, "priority": "high"},
    {"keyword": "ChatGPT analytics", "volume": 880, "priority": "medium"},
    {"keyword": "Claude SEO", "volume": 720, "priority": "medium"},
    {"keyword": "Perplexity SEO", "volume": 590, "priority": "medium"},
    {"keyword": "AI brand visibility", "volume": 650, "priority": "medium"},
    {"keyword": "ChatGPT product listings", "volume": 880, "priority": "medium"},
    {"keyword": "AI traffic tracking", "volume": 720, "priority": "medium"},
    {"keyword": "LLM audit", "volume": 590, "priority": "medium"},
    {"keyword": "ChatGPT conversion tracking", "volume": 720, "priority": "medium"},
    {"keyword": "Ecommerce AI optimization", "volume": 880, "priority": "medium"},
    {"keyword": "AI shopping optimization", "volume": 590, "priority": "medium"},
    {"keyword": "how to rank on ChatGPT", "volume": 320, "priority": "medium"},
    {"keyword": "ChatGPT traffic Shopify", "volume": 260, "priority": "medium"},
    {"keyword": "track AI traffic Google Analytics", "volume": 210, "priority": "medium"},
    {"keyword": "ChatGPT SEO best practices", "volume": 390, "priority": "medium"},
    {"keyword": "optimize for ChatGPT instant checkout", "volume": 170, "priority": "medium"},
    {"keyword": "ChatGPT vs Google SEO", "volume": 320, "priority": "medium"},
]


def generate_batch(priority=None, limit=None, output_dir="output"):
    """
    Generate blog posts for keywords in batch
    
    Args:
        priority: Filter by priority (high, medium, low). None = all
        limit: Maximum number of posts to generate. None = all
        output_dir: Output directory for generated posts
    """
    
    # Filter keywords by priority if specified
    filtered_keywords = KEYWORDS
    if priority:
        filtered_keywords = [kw for kw in KEYWORDS if kw["priority"] == priority]
    
    # Limit number if specified
    if limit:
        filtered_keywords = filtered_keywords[:limit]
    
    print(f"🚀 Starting batch generation...")
    print(f"   Keywords to generate: {len(filtered_keywords)}")
    print(f"   Priority filter: {priority or 'all'}")
    print(f"   Output directory: {output_dir}\n")
    
    results = []
    
    for i, kw in enumerate(filtered_keywords, 1):
        print(f"[{i}/{len(filtered_keywords)}] Generating: {kw['keyword']} ({kw['volume']}/mo)")
        
        try:
            # Generate content
            content = generate_blog_content(kw['keyword'], kw['volume'])
            
            if not content:
                print(f"   ❌ Failed to generate content\n")
                results.append({
                    "keyword": kw['keyword'],
                    "status": "failed",
                    "error": "Content generation failed"
                })
                continue
            
            # Generate metadata
            metadata = generate_metadata(kw['keyword'], content, kw['volume'])
            
            # Save blog post (don't auto-deploy in batch mode)
            html_path = save_blog_post(metadata, content, output_dir, save_to_blog_dir=False)
            
            print(f"   ✅ Success! ({metadata['word_count']} words)\n")
            
            results.append({
                "keyword": kw['keyword'],
                "status": "success",
                "word_count": metadata['word_count'],
                "slug": metadata['slug'],
                "path": str(html_path)
            })
            
            # Rate limiting - wait between requests to avoid API limits
            if i < len(filtered_keywords):
                print("   ⏳ Waiting 10 seconds before next generation...\n")
                time.sleep(10)
        
        except Exception as e:
            print(f"   ❌ Error: {str(e)}\n")
            results.append({
                "keyword": kw['keyword'],
                "status": "error",
                "error": str(e)
            })
            continue
    
    # Save batch results
    results_path = Path(output_dir) / "batch_results.json"
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    
    # Print summary
    print("\n" + "="*50)
    print("📊 BATCH GENERATION SUMMARY")
    print("="*50)
    
    successful = len([r for r in results if r["status"] == "success"])
    failed = len([r for r in results if r["status"] != "success"])
    
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"📄 Total: {len(results)}")
    print(f"\n📁 Results saved to: {results_path}")
    print(f"📁 Generated posts in: {output_dir}/")
    
    return results


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate multiple blog posts from keyword list")
    parser.add_argument("--priority", choices=["high", "medium", "low"], help="Filter by priority")
    parser.add_argument("--limit", type=int, help="Maximum number of posts to generate")
    parser.add_argument("--output", default="output", help="Output directory")
    
    args = parser.parse_args()
    
    results = generate_batch(
        priority=args.priority,
        limit=args.limit,
        output_dir=args.output
    )
    
    print("\n✨ Batch generation complete!")


if __name__ == "__main__":
    main()


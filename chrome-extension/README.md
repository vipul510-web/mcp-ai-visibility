# SellOnLLM Chrome Extension

A Chrome extension that provides instant LLM (Large Language Model) readiness audits for any webpage. Check if your page is optimized for AI platforms like ChatGPT, Claude, and Perplexity.

## Features

✅ **Instant Page Audit** - Analyze any webpage in seconds
✅ **Overall Score** - Get a 0-100 rating for LLM readiness
✅ **Detailed Checks** - See exactly what's missing or needs improvement
✅ **11 Comprehensive Checks**:
  - Meta Title
  - Meta Description
  - Structured Data (JSON-LD)
  - Open Graph Tags
  - Twitter Cards
  - **Content Quality** (word count, heading structure, readability)
  - **FAQ Section** (detects FAQ content and schema)
  - **LLM.txt File** (checks for AI platform configuration file)
  - Image Optimization
  - Mobile Friendly
  - SSL / HTTPS

## Installation

### For Development:

1. **Prepare Icons** (see below for icon generation)
2. **Load Extension**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `chrome-extension` folder
3. **Use Extension**:
   - Click the extension icon in Chrome toolbar
   - Extension will automatically audit the current page

## Icon Setup

The extension requires icons in the `icons/` folder:
- `icon16.png` (16x16 pixels)
- `icon32.png` (32x32 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

### Quick Icon Generation:

You can use your existing logo (`../images/logo.png`) and resize it:

```bash
# Using ImageMagick (install if needed: brew install imagemagick)
cd chrome-extension
mkdir -p icons
convert ../images/logo.png -resize 16x16 icons/icon16.png
convert ../images/logo.png -resize 32x32 icons/icon32.png
convert ../images/logo.png -resize 48x48 icons/icon48.png
convert ../images/logo.png -resize 128x128 icons/icon128.png
```

Or use any online tool to resize your logo to these dimensions.

## How It Works

1. **Content Script** (`content.js`): 
   - Runs on every page
   - Analyzes the DOM for LLM optimization elements
   - Performs 8 key checks

2. **Popup** (`popup.html/js`):
   - Displays audit results
   - Shows overall score (0-100)
   - Lists all checks with pass/fail status
   - Provides recommendations for improvements

3. **Audit Checks**:
   - All checks run client-side on the current page DOM
   - No data sent to external servers
   - Instant results

## File Structure

```
chrome-extension/
├── manifest.json          # Extension manifest (Manifest V3)
├── popup.html            # Extension popup UI
├── popup.css             # Popup styling
├── popup.js              # Popup logic
├── content.js            # Content script (runs on pages)
├── icons/                # Extension icons (16x16, 32x32, 48x48, 128x128)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## Usage

1. Navigate to any webpage
2. Click the SellOnLLM extension icon in Chrome toolbar
3. View your page's LLM readiness score and detailed checks
4. Click any check to expand and see recommendations
5. Click "Run Full Site Audit" to audit the entire site on sellonllm.com

## Development

### Making Changes:

1. Edit files in `chrome-extension/` folder
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

### Debugging:

- **Popup**: Right-click extension icon → "Inspect popup"
- **Content Script**: Open DevTools on any page → Console tab
- **Background**: `chrome://extensions/` → Extension details → "Service worker"

## Checks Performed

### 1. Meta Title ✓
- Checks if `<title>` tag exists
- Validates length (recommended: 50-60 characters)

### 2. Meta Description ✓
- Checks if `<meta name="description">` exists
- Validates length (recommended: 120-160 characters)

### 3. Structured Data ✓
- Looks for JSON-LD (`<script type="application/ld+json">`)
- Checks for Microdata (`itemscope`)
- Validates essential schema types (Organization, WebSite, Article, etc.)

### 4. Open Graph Tags ✓
- Checks for og:title, og:description, og:image, og:url
- Validates presence of required tags

### 5. Twitter Cards ✓
- Checks for twitter:card, twitter:title, twitter:description, twitter:image
- Validates presence of recommended tags

### 6. Content Quality ✓ **NEW**
- Analyzes word count (recommended: 300+ words)
- Checks heading hierarchy (H1→H2 structure)
- Validates paragraph count and readability
- Checks for lists and structured content
- Provides content quality score (0-100%)

### 7. FAQ Section ✓ **NEW**
- Detects FAQ headings (h1-h6 with FAQ keywords)
- Checks for FAQ HTML patterns (.faq, #faq, etc.)
- Looks for Q&A patterns (dt/dd, question/answer classes)
- Validates FAQPage/Question schema markup
- Provides FAQ detection score

### 8. LLM.txt File ✓ **NEW**
- Checks if `/llm.txt` file exists at site root
- Validates file accessibility
- Provides recommendation for creating LLM.txt

### 9. Image Optimization ✓
- Checks if images have alt text
- Validates alt text coverage (recommended: 80%+)

### 10. Mobile Friendly ✓
- Checks for viewport meta tag
- Validates proper mobile configuration

### 11. SSL / HTTPS ✓
- Checks if page uses HTTPS
- Validates security protocol

### 12. Robots.txt ✓ **NEW**
- Checks if robots.txt exists
- Verifies AI crawlers are allowed (GPTBot, Claude-Web, PerplexityBot, GoogleOther)
- Detects if crawlers are blocked

### 13. Sitemap ✓ **NEW**
- Checks if XML sitemap exists
- Validates sitemap format and URL count
- Verifies if referenced in robots.txt

### 14. Canonical URL ✓ **NEW**
- Checks for canonical tag
- Verifies self-referencing canonical
- Detects duplicate content issues

### 15. Language & Hreflang Tags ✓ **NEW**
- Checks html lang attribute
- Verifies hreflang tags for multilingual
- Validates language consistency

### 16. Content Freshness ✓ **NEW**
- Checks for publish/update dates
- Analyzes date formats (schema, meta)
- Scores based on content age signals

### 17. Internal Linking ✓ **NEW**
- Counts internal links
- Checks link quality (descriptive anchors)
- Identifies orphan pages

### 18. External Links ✓ **NEW**
- Checks nofollow/dofollow ratio
- Verifies outbound link quality
- Validates link attributes

### 19. Schema Validation ✓ **NEW**
- Validates JSON-LD syntax
- Checks required schema properties
- Verifies schema completeness

### 20. Page Speed Indicators ✓ **NEW**
- Checks for lazy loading
- Verifies image optimization (format, compression hints)
- Checks for render-blocking resources
- Validates resource hints (preconnect/preload)

### 21. Accessibility for LLMs ✓ **NEW**
- Checks ARIA labels
- Verifies semantic HTML (nav, main, article, aside)
- Checks for text alternatives
- Validates heading hierarchy

## PDF Export

The extension now includes a **PDF export feature** that generates a comprehensive branded audit report:

- **Branded header** with SellOnLLM logo and website link
- **Complete audit results** with all checks and recommendations
- **Overall score** and status breakdown
- **Page information** including URL and audit date
- **Professional formatting** with page numbers and footer
- **Downloadable PDF** with filename based on domain and timestamp

Click the "Download PDF Report" button in the extension popup to generate and download your audit report.

## Future Enhancements

- [ ] Save audit history
- [ ] Compare pages
- [ ] Batch audit multiple pages
- [ ] Dark mode support
- [ ] Watchlist/monitoring features
- [ ] Score tracking over time

## License

Part of SellOnLLM platform. See main repository for license details.

## Support

For issues or questions, visit: https://sellonllm.com/contact-us.html


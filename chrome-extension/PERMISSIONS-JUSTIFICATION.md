# Chrome Web Store - Permission Justifications

Use these justifications when submitting the extension to the Chrome Web Store.

---

## 1. activeTab Justification

**Required for:** Accessing the currently active tab's URL to perform AI/SEO audits

**Justification:**

The `activeTab` permission is required to access the URL of the currently active browser tab when the user clicks the extension icon. This allows the extension to:
- Display the URL being audited in the popup interface
- Pass the current page URL to the content script for analysis
- Verify that the page is a valid webpage (http/https) before running the audit
- Provide context about which page is being audited in the results

The extension only accesses the active tab when the user explicitly clicks the extension icon to run an audit. No data from the tab is collected, stored, or transmitted to external servers. All analysis is performed locally in the browser.

**Character count:** 544/1,000

---

## 2. scripting Justification

**Required for:** Injecting the content script into web pages to perform DOM analysis

**Justification:**

The `scripting` permission is essential for the extension's core functionality. It allows the extension to inject `content.js` into the currently active tab's page to:
- Analyze the page's DOM structure (HTML elements, meta tags, structured data)
- Perform client-side checks for SEO elements (meta titles, descriptions, Open Graph tags, etc.)
- Validate structured data (JSON-LD schemas)
- Check for AI-specific files (robots.txt, sitemap.xml, llm.txt) via fetch requests
- Analyze content quality, accessibility, and other on-page SEO factors

The content script runs only when the user explicitly triggers an audit by clicking the extension icon. It analyzes the page locally and returns results to the popup. No page content or data is stored or transmitted externally. The script is injected on-demand only and does not persist after the audit completes.

**Character count:** 612/1,000

---

## 3. Host Permission (<all_urls>) Justification

**Required for:** Fetching site-wide files (robots.txt, sitemap.xml, llm.txt) from any domain to complete the audit

**Justification:**

The `<all_urls>` host permission is required to fetch critical SEO and AI optimization files from any website the user wants to audit. Specifically, it enables the extension to:

1. **Check robots.txt** - Fetch `/robots.txt` from the site root to verify AI crawlers (GPTBot, Claude-Web, PerplexityBot) are allowed
2. **Check sitemap.xml** - Fetch `/sitemap.xml` or `/sitemap_index.xml` to validate XML sitemap existence and format
3. **Check llm.txt** - Fetch `/llm.txt` from the site root to verify AI platform configuration file exists

These files must be fetched from the site's root domain (e.g., `https://example.com/robots.txt`) rather than from the specific page being audited. Without `<all_urls>`, the extension would be unable to check these critical AI/SEO configuration files, which are essential parts of the 21+ audit checks provided.

**Privacy & Security:**
- All fetches are done locally in the user's browser
- No data is collected, stored, or transmitted to external servers
- Files are fetched only when the user explicitly runs an audit
- The extension follows the same-origin policy and only accesses files on domains the user is already viewing

**Character count:** 867/1,000

---

## Alternative: More Concise Versions (If Character Limits Are Tight)

### activeTab (Concise - 285 chars)

The `activeTab` permission is required to access the currently active tab's URL when the user clicks the extension icon to run an AI/SEO audit. This allows the extension to display which page is being audited and pass the URL to the content script for analysis. The extension only accesses the active tab when explicitly triggered by the user. No data is collected or transmitted externally.

### scripting (Concise - 319 chars)

The `scripting` permission is essential to inject `content.js` into web pages to analyze the DOM for SEO elements (meta tags, structured data, Open Graph tags, etc.) and check for AI-specific configuration files. The content script runs only when the user clicks the extension icon to audit a page. All analysis is performed locally; no page data is stored or transmitted externally.

### Host Permission (Concise - 498 chars)

The `<all_urls>` host permission is required to fetch critical SEO/AI configuration files (`robots.txt`, `sitemap.xml`, `llm.txt`) from any website's root domain that the user wants to audit. These files must be checked from the site root, not just the current page. All fetches occur locally in the user's browser only when an audit is explicitly triggered. No data is collected, stored, or transmitted to external servers. This permission is essential for completing the 21+ comprehensive audit checks.

---

## Additional Privacy Information (For Privacy Practices Section)

**Data Collection:**
This extension does not collect, store, or transmit any user data or website content to external servers. All audit analysis is performed locally in the user's browser. The extension:
- Does not track user behavior or browsing history
- Does not collect personal information
- Does not transmit any data to external servers
- Does not store audit results persistently
- All processing occurs locally on the user's device

**Permissions Usage:**
- **activeTab**: Only used to access the current tab's URL when the user explicitly clicks the extension icon
- **scripting**: Only used to inject audit scripts when the user explicitly runs an audit
- **host_permissions**: Only used to fetch robots.txt, sitemap.xml, and llm.txt files from domains the user is already viewing, and only when an audit is explicitly triggered

**User Control:**
Users have complete control over when audits run. The extension only performs analysis when the user:
1. Clicks the extension icon in the Chrome toolbar
2. Clicks the "Refresh Audit" button
3. Explicitly requests a PDF export

The extension does not run automatically or in the background.


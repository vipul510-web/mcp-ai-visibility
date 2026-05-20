// Popup script for LLM Audit Chrome Extension

let currentTab = null;

// Google Analytics tracking helper using Measurement Protocol API
// This avoids CSP issues with external scripts in Chrome extensions
const GA_MEASUREMENT_ID = 'G-7KK7VYDR9D';
const GA_API_SECRET = ''; // Optional: Add if you want to use Measurement Protocol with secret

function trackEvent(eventName, eventCategory, eventLabel, value = null) {
    try {
        // Use Measurement Protocol API (HTTP endpoint) instead of gtag.js
        // This works around CSP restrictions in Chrome extensions
        const eventData = {
            name: eventName,
            params: {
                event_category: eventCategory,
                event_label: eventLabel
            }
        };
        
        if (value !== null) {
            eventData.params.value = value;
        }
        
        // Send to Google Analytics via Measurement Protocol
        // Using fetch to avoid CSP issues
        fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET || 'default'}&_r=${Math.random()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: getOrCreateClientId(),
                events: [eventData]
            }),
            keepalive: true // Important: keeps request alive even if page closes
        }).catch(error => {
            // Silently fail - don't break extension if GA is blocked
            console.debug('GA tracking failed (non-critical):', error);
        });
    } catch (error) {
        // Silently fail - don't break extension if GA is blocked
        console.debug('GA tracking error (non-critical):', error);
    }
}

// Generate or retrieve a persistent client ID for this extension installation
function getOrCreateClientId() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['ga_client_id'], (result) => {
            if (result.ga_client_id) {
                resolve(result.ga_client_id);
            } else {
                // Generate a new client ID (UUID-like format)
                const clientId = `${Date.now()}.${Math.random().toString(36).substring(2, 15)}`;
                chrome.storage.local.set({ ga_client_id: clientId }, () => {
                    resolve(clientId);
                });
            }
        });
    });
}

// Async version of trackEvent — sends directly to GA Measurement Protocol (no Vercel proxy)
async function trackEventAsync(eventName, eventCategory, eventLabel, value = null) {
    try {
        const clientId = await getOrCreateClientId();
        const eventData = {
            name: eventName,
            params: {
                event_category: eventCategory,
                event_label: eventLabel,
                source: 'chrome_extension',
                platform: 'extension',
            },
        };
        if (value !== null) eventData.params.value = value;

        fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET || ''}&_r=${Math.random()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientId, events: [eventData] }),
            keepalive: true,
        }).catch(() => {});
    } catch {
        // noop — tracking must never break the extension
    }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Track extension open
        trackEventAsync('extension_opened', 'Extension', 'Popup opened');
        
        // Load saved API key first
        await loadSavedApiKey();
        
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;
        
        // URL is no longer displayed in the UI to save space
        
        // Setup tab switching
        setupTabs();
        
        // Only audit http/https pages
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
            await runAudit();
        } else {
            showError('Cannot audit this page. Please navigate to a webpage (http/https).');
            trackEventAsync('audit_error', 'Extension', 'Invalid page type');
        }
        
    } catch (error) {
        console.error('Error initializing popup:', error);
        showError('Unable to initialize audit.');
        trackEventAsync('extension_error', 'Extension', error.message);
    }
});

// Setup tab switching
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Track tab switch
            trackEventAsync('tab_switched', 'Extension', targetTab);
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(`tab-${targetTab}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// Retry button
document.getElementById('retry-btn')?.addEventListener('click', async () => {
    await runAudit();
});

// Refresh button
document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    await runAudit();
});

// Feedback submit button
document.getElementById('submit-feedback-btn')?.addEventListener('click', handleFeedbackSubmit);

// Prompt relevance analyze button
document.getElementById('analyze-prompts-btn')?.addEventListener('click', handlePromptAnalysis);

// API key save button
document.getElementById('save-api-key-btn')?.addEventListener('click', handleSaveApiKey);

// Handle API key input focus - clear masked value if it's the saved key
document.getElementById('openai-api-key')?.addEventListener('focus', async function() {
    if (this.getAttribute('data-saved') === 'true') {
        // User wants to edit, so load the actual key
        const actualKey = await getStoredApiKey();
        if (actualKey) {
            this.value = actualKey;
            this.removeAttribute('data-saved');
        }
    }
});

// PDF Export button
document.getElementById('export-pdf-btn')?.addEventListener('click', async () => {
    await exportToPDF();
});

let currentAuditData = null;

// Run audit
async function runAudit() {
    showLoading();
    
    // Track audit start
    trackEventAsync('audit_started', 'Extension', 'Page audit initiated');
    
    try {
        if (!currentTab || !currentTab.id) {
            throw new Error('No active tab found');
        }
        
        // Inject content script if needed
        try {
            await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                files: ['content.js']
            });
        } catch (error) {
            // Script may already be injected, continue
            console.log('Content script injection:', error);
        }
        
        // Wait a moment for script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Send message to run audit
        const results = await chrome.tabs.sendMessage(currentTab.id, {
            action: 'runAudit',
            url: currentTab.url
        });
        
        if (results && results.error) {
            trackEventAsync('audit_error', 'Extension', results.error);
            throw new Error(results.error);
        }
        
        // Track successful audit
        const checkKeys = Object.keys(results.checks || {});
        const passedChecks = checkKeys.filter(key => results.checks[key] && results.checks[key].pass).length;
        const overallScore = checkKeys.length > 0 ? Math.round((passedChecks / checkKeys.length) * 100) : 0;
        
        trackEventAsync('audit_completed', 'Extension', 'Page audit completed', overallScore);
        
        displayResults(results);
        
    } catch (error) {
        console.error('Audit error:', error);
        trackEventAsync('audit_error', 'Extension', error.message);
        showError(error.message || 'Unable to audit this page. Please try again.');
    }
}

// Show loading state
function showLoading() {
    document.getElementById('loading-state').style.display = 'flex';
    document.getElementById('error-state').style.display = 'none';
    document.getElementById('results-state').style.display = 'none';
}

// Show error state
function showError(message) {
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const resultsState = document.getElementById('results-state');
    const errorMessage = document.getElementById('error-message');
    
    if (loadingState) loadingState.style.display = 'none';
    if (errorState) errorState.style.display = 'flex';
    if (resultsState) resultsState.style.display = 'none';
    if (errorMessage) errorMessage.textContent = message;
}

// Display results
function displayResults(data) {
    currentAuditData = data; // Store for PDF export
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'none';
    document.getElementById('results-state').style.display = 'flex';
    
    if (!data || !data.checks) {
        showError('No audit data received.');
        return;
    }
    
    const checks = data.checks;
    
    // Calculate overall score
    const checkKeys = Object.keys(checks);
    const passedChecks = checkKeys.filter(key => checks[key] && checks[key].pass).length;
    const totalChecks = checkKeys.length;
    const overallScore = Math.round((passedChecks / totalChecks) * 100);
    
    // Update score display
    const overallScoreEl = document.getElementById('overall-score');
    if (overallScoreEl) {
        overallScoreEl.textContent = overallScore;
    }
    
    // Animate score ring
    const scoreProgress = document.getElementById('score-progress');
    if (scoreProgress) {
        const circumference = 2 * Math.PI * 45; // radius = 45
        const offset = circumference - (overallScore / 100) * circumference;
        scoreProgress.style.strokeDashoffset = offset;
    }
    
    // Update status (compact version)
    const scoreStatus = document.getElementById('score-status');
    
    if (scoreStatus) {
        if (overallScore >= 80) {
            scoreStatus.textContent = 'Excellent';
            scoreStatus.className = 'score-status-compact score-status-compact--excellent';
        } else if (overallScore >= 60) {
            scoreStatus.textContent = 'Good';
            scoreStatus.className = 'score-status-compact score-status-compact--good';
        } else {
            scoreStatus.textContent = 'Needs Improvement';
            scoreStatus.className = 'score-status-compact score-status-compact--poor';
        }
    }
    
    // Display checks in tabs
    displayChecksByCategory(checks);
    
    // Update full audit link
    const fullAuditLink = document.getElementById('full-audit-link');
    if (fullAuditLink && currentTab && currentTab.url) {
        try {
            const urlObj = new URL(currentTab.url);
            fullAuditLink.href = `https://sellonllm.com/free-llm-audit.html?url=${encodeURIComponent(urlObj.origin)}`;
            
            // Add click tracking
            fullAuditLink.addEventListener('click', () => {
                trackEventAsync('full_audit_clicked', 'Extension', 'Full site audit link clicked');
            });
        } catch {}
    }
}

// Display checks organized by category
function displayChecksByCategory(checks) {
    // Calculate category scores and find opportunities
    const { technicalScore, contentScore, opportunities } = calculateCategoryScores(checks);
    
    // Display overview summary
    displayOverviewSummary(technicalScore, contentScore, opportunities);
    
    // Define check categories
    const checkCategories = {
        technical: [
            { key: 'meta_titles_present', label: 'Meta Title' },
            { key: 'meta_descriptions_present', label: 'Meta Description' },
            { key: 'canonical_url', label: 'Canonical URL' },
            { key: 'language_tags', label: 'Language Tags' },
            { key: 'structured_data_basic', label: 'Structured Data' },
            { key: 'schema_validation', label: 'Schema Validation' },
            { key: 'open_graph_tags', label: 'Open Graph' },
            { key: 'twitter_cards', label: 'Twitter Cards' },
            { key: 'llm_txt_exists', label: 'llms.txt file' },
            { key: 'robots_txt_proper', label: 'Robots.txt' },
            { key: 'sitemap_exists', label: 'Sitemap' },
            { key: 'image_optimization', label: 'Image Optimization' },
            { key: 'page_speed_indicators', label: 'Page Speed' },
            { key: 'mobile_friendly', label: 'Mobile Friendly' },
            { key: 'accessibility', label: 'Accessibility' },
            { key: 'ssl_enabled', label: 'SSL / HTTPS' }
        ],
        content: [
            { key: 'content_quality', label: 'Content Quality' },
            { key: 'content_freshness', label: 'Content Freshness' },
            { key: 'faq_section', label: 'FAQ Section' },
            { key: 'internal_linking', label: 'Internal Linking' },
            { key: 'external_links', label: 'External Links' }
        ]
    };
    
    // Display checks in each category
    Object.keys(checkCategories).forEach(category => {
        const containerId = `${category}-checks`;
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        checkCategories[category].forEach(({ key, label }) => {
            const check = checks[key];
            if (!check) return;
            
            const checkItem = createCheckItem(key, label, check);
            container.appendChild(checkItem);
        });
    });
}

// Calculate category scores and find opportunities
function calculateCategoryScores(checks) {
    // Technical checks
    const technicalChecks = [
        'meta_titles_present',
        'meta_descriptions_present',
        'canonical_url',
        'language_tags',
        'structured_data_basic',
        'schema_validation',
        'open_graph_tags',
        'twitter_cards',
        'llm_txt_exists',
        'robots_txt_proper',
        'sitemap_exists',
        'image_optimization',
        'page_speed_indicators',
        'mobile_friendly',
        'accessibility',
        'ssl_enabled'
    ];
    
    // Content checks
    const contentChecks = [
        'content_quality',
        'content_freshness',
        'faq_section',
        'internal_linking',
        'external_links'
    ];
    
    // Calculate technical score
    const technicalPassed = technicalChecks.filter(key => checks[key] && checks[key].pass).length;
    const technicalScore = Math.round((technicalPassed / technicalChecks.length) * 100);
    
    // Calculate content score
    const contentPassed = contentChecks.filter(key => checks[key] && checks[key].pass).length;
    const contentScore = Math.round((contentPassed / contentChecks.length) * 100);
    
    // Find biggest opportunities (failed checks with high impact)
    const highImpactChecks = [
        { key: 'meta_titles_present', label: 'Meta Title', impact: 'high' },
        { key: 'meta_descriptions_present', label: 'Meta Description', impact: 'high' },
        { key: 'structured_data_basic', label: 'Structured Data', impact: 'high' },
        { key: 'content_quality', label: 'Content Quality', impact: 'high' },
        { key: 'llm_txt_exists', label: 'llms.txt file', impact: 'high' },
        { key: 'open_graph_tags', label: 'Open Graph Tags', impact: 'medium' },
        { key: 'faq_section', label: 'FAQ Section', impact: 'medium' },
        { key: 'robots_txt_proper', label: 'Robots.txt', impact: 'medium' }
    ];
    
    const opportunities = highImpactChecks
        .filter(({ key }) => checks[key] && !checks[key].pass)
        .slice(0, 3) // Top 3 opportunities
        .map(({ key, label, impact }) => ({
            key,
            label,
            impact,
            check: checks[key]
        }));
    
    return { technicalScore, contentScore, opportunities };
}

// Display overview summary
function displayOverviewSummary(technicalScore, contentScore, opportunities) {
    const overviewContainer = document.getElementById('overview-checks');
    if (!overviewContainer) return;
    
    overviewContainer.innerHTML = '';
    
    // Score cards
    const scoreSection = document.createElement('div');
    scoreSection.className = 'overview-scores';
    scoreSection.innerHTML = `
        <div class="overview-score-card">
            <div class="overview-score-label">Technical Score</div>
            <div class="overview-score-value overview-score-value--${getScoreClass(technicalScore)}">
                ${technicalScore}
            </div>
            <div class="overview-score-max">/100</div>
        </div>
        <div class="overview-score-card">
            <div class="overview-score-label">Content Score</div>
            <div class="overview-score-value overview-score-value--${getScoreClass(contentScore)}">
                ${contentScore}
            </div>
            <div class="overview-score-max">/100</div>
        </div>
    `;
    overviewContainer.appendChild(scoreSection);
    
    // Opportunities section
    if (opportunities.length > 0) {
        const opportunitiesSection = document.createElement('div');
        opportunitiesSection.className = 'overview-opportunities';
        
        const opportunitiesTitle = document.createElement('h4');
        opportunitiesTitle.className = 'opportunities-title';
        if (opportunitiesTitle) {
            opportunitiesTitle.textContent = 'Biggest Opportunities';
        }
        opportunitiesSection.appendChild(opportunitiesTitle);
        
        opportunities.forEach(({ label, check, impact }) => {
            const oppItem = document.createElement('div');
            oppItem.className = `opportunity-item opportunity-item--${impact}`;
            oppItem.innerHTML = `
                <div class="opportunity-header">
                    <span class="opportunity-label">${label}</span>
                    <span class="opportunity-impact opportunity-impact--${impact}">${impact.toUpperCase()}</span>
                </div>
                <div class="opportunity-details">${check.details || 'Needs improvement'}</div>
                ${check.recommendation ? `<div class="opportunity-recommendation">${check.recommendation}</div>` : ''}
            `;
            opportunitiesSection.appendChild(oppItem);
        });
        
        overviewContainer.appendChild(opportunitiesSection);
    } else {
        const noOpportunities = document.createElement('div');
        noOpportunities.className = 'overview-no-opportunities';
        noOpportunities.innerHTML = `
            <p>🎉 Great job! All high-impact checks are passing.</p>
            <p>Focus on optimizing medium and low-impact areas for even better results.</p>
        `;
        overviewContainer.appendChild(noOpportunities);
    }
}

// Get score class for styling
function getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    return 'poor';
}

// Create check item element
function createCheckItem(key, label, check) {
    const pass = check.pass;
    const details = check.details || 'No details available.';
    const value = check.value || {};
    
    const item = document.createElement('div');
    item.className = `check-item check-item--${pass ? 'pass' : 'fail'}`;
    
    const icon = pass ? '✓' : '✗';
    const status = pass ? 'PASS' : 'FAIL';
    
    item.innerHTML = `
        <div class="check-header">
            <div class="check-name">
                <span class="check-icon check-icon--${pass ? 'pass' : 'fail'}">${icon}</span>
                <span>${label}</span>
            </div>
            <span class="check-status check-status--${pass ? 'pass' : 'fail'}">${status}</span>
        </div>
        <div class="check-details">
            <strong>${details}</strong>
            ${check.recommendation ? `<p style="margin-top: 4px;">${check.recommendation}</p>` : value.recommendation ? `<p style="margin-top: 4px;">${value.recommendation}</p>` : ''}
        </div>
    `;
    
    // Toggle details on click
    item.querySelector('.check-header').addEventListener('click', () => {
        item.classList.toggle('expanded');
    });
    
    return item;
}

// Export audit results to PDF
async function exportToPDF() {
    if (!currentAuditData || !currentAuditData.checks) {
        alert('No audit data to export. Please run an audit first.');
        return;
    }
    
    try {
        // Check if jsPDF is loaded (UMD build exposes to window.jspdf.umd or window.jsPDF)
        let jsPDF;
        if (typeof window.jspdf !== 'undefined' && window.jspdf.jsPDF) {
            jsPDF = window.jspdf.jsPDF;
        } else if (typeof window.jsPDF !== 'undefined') {
            jsPDF = window.jsPDF;
        } else if (typeof window.jspdf !== 'undefined' && window.jspdf.default) {
            jsPDF = window.jspdf.default.jsPDF || window.jspdf.default;
        } else {
            throw new Error('jsPDF library not loaded. Please refresh the extension.');
        }
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const maxWidth = pageWidth - (margin * 2);
        
        let yPos = margin;
        
        // Helper to add new page if needed
        const checkNewPage = (requiredSpace) => {
            if (yPos + requiredSpace > pageHeight - margin) {
                pdf.addPage();
                yPos = margin;
                return true;
            }
            return false;
        };
        
        // Branding Header
        pdf.setFillColor(74, 144, 226); // SellOnLLM blue
        pdf.rect(0, 0, pageWidth, 30, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text('SellOnLLM', margin, 20);
        
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        pdf.text('LLM Audit Report', margin, 28);
        
        // Website link
        pdf.setFontSize(10);
        pdf.text('sellonllm.com', pageWidth - margin - 30, 28, { align: 'right' });
        
        yPos = 40;
        
        // Reset text color
        pdf.setTextColor(0, 0, 0);
        
        // Page Info
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Audit Report', margin, yPos);
        yPos += 8;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const auditUrl = currentAuditData.url || 'N/A';
        const urlText = pdf.splitTextToSize(`Page URL: ${auditUrl}`, maxWidth);
        pdf.text(urlText, margin, yPos);
        yPos += urlText.length * 5 + 3;
        
        const auditDate = new Date().toLocaleString();
        pdf.text(`Audit Date: ${auditDate}`, margin, yPos);
        yPos += 8;
        
        // Overall Score
        const checks = currentAuditData.checks;
        const checkKeys = Object.keys(checks);
        const passedChecks = checkKeys.filter(key => checks[key] && checks[key].pass).length;
        const totalChecks = checkKeys.length;
        const overallScore = Math.round((passedChecks / totalChecks) * 100);
        
        checkNewPage(20);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Overall Score: ${overallScore}/100`, margin, yPos);
        yPos += 10;
        
        // Score breakdown
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Passed Checks: ${passedChecks}/${totalChecks}`, margin, yPos);
        yPos += 6;
        
        // Status
        let statusText = '';
        if (overallScore >= 80) {
            statusText = 'Excellent - Your page is well-optimized for LLMs.';
        } else if (overallScore >= 60) {
            statusText = 'Good Start - Some improvements needed for better LLM visibility.';
        } else {
            statusText = 'Needs Improvement - Focus on the failing checks below to improve your score.';
        }
        pdf.text(`Status: ${statusText}`, margin, yPos);
        yPos += 10;
        
        // Detailed Checks
        checkNewPage(15);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Detailed Audit Results', margin, yPos);
        yPos += 8;
        
        // Check order (same as display)
        const checkOrder = [
            { key: 'meta_titles_present', label: 'Meta Title' },
            { key: 'meta_descriptions_present', label: 'Meta Description' },
            { key: 'canonical_url', label: 'Canonical URL' },
            { key: 'structured_data_basic', label: 'Structured Data' },
            { key: 'schema_validation', label: 'Schema Validation' },
            { key: 'open_graph_tags', label: 'Open Graph' },
            { key: 'twitter_cards', label: 'Twitter Cards' },
            { key: 'language_tags', label: 'Language Tags' },
            { key: 'content_quality', label: 'Content Quality' },
            { key: 'content_freshness', label: 'Content Freshness' },
            { key: 'faq_section', label: 'FAQ Section' },
            { key: 'internal_linking', label: 'Internal Linking' },
            { key: 'external_links', label: 'External Links' },
            { key: 'llm_txt_exists', label: 'llms.txt file' },
            { key: 'robots_txt_proper', label: 'Robots.txt' },
            { key: 'sitemap_exists', label: 'Sitemap' },
            { key: 'image_optimization', label: 'Image Optimization' },
            { key: 'page_speed_indicators', label: 'Page Speed' },
            { key: 'accessibility', label: 'Accessibility' },
            { key: 'mobile_friendly', label: 'Mobile Friendly' },
            { key: 'ssl_enabled', label: 'SSL / HTTPS' }
        ];
        
        checkOrder.forEach(({ key, label }) => {
            const check = checks[key];
            if (!check) return;
            
            checkNewPage(15);
            
            const pass = check.pass;
            const icon = pass ? '✓' : '✗';
            const status = pass ? 'PASS' : 'FAIL';
            
            // Check header
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            const checkHeader = `${icon} ${label} - ${status}`;
            pdf.text(checkHeader, margin, yPos);
            yPos += 6;
            
            // Details
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            const detailsText = pdf.splitTextToSize(check.details || 'No details available.', maxWidth);
            pdf.text(detailsText, margin + 3, yPos);
            yPos += detailsText.length * 4 + 2;
            
            // Recommendation
            if (check.recommendation) {
                pdf.setFont('helvetica', 'italic');
                pdf.setTextColor(100, 100, 100);
                const recText = pdf.splitTextToSize(`Recommendation: ${check.recommendation}`, maxWidth - 3);
                pdf.text(recText, margin + 3, yPos);
                yPos += recText.length * 4 + 3;
                pdf.setTextColor(0, 0, 0);
            } else {
                yPos += 2;
            }
            
            // Add small separator
            yPos += 2;
        });
        
        // Footer on every page
        const totalPages = pdf.internal.pages.length - 1;
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            pdf.text(
                `Page ${i} of ${totalPages} | Generated by SellOnLLM - sellonllm.com`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
            pdf.setTextColor(0, 0, 0);
        }
        
        // Save PDF
        const urlObj = new URL(auditUrl);
        const filename = `llm-audit-${urlObj.hostname.replace(/\./g, '-')}-${Date.now()}.pdf`;
        pdf.save(filename);
        
        // Track PDF export
        trackEventAsync('pdf_exported', 'Extension', 'Audit PDF downloaded');
        
    } catch (error) {
        console.error('PDF export error:', error);
        trackEventAsync('pdf_export_error', 'Extension', error.message);
        alert('Error generating PDF. Please try again or check your internet connection.');
    }
}

// Handle feedback submission
async function handleFeedbackSubmit() {
    const feedbackInput = document.getElementById('feedback-input');
    const feedbackMessage = document.getElementById('feedback-message');
    const submitBtn = document.getElementById('submit-feedback-btn');
    
    const feedback = feedbackInput.value.trim();
    
    if (!feedback) {
        feedbackMessage.textContent = 'Please enter your feedback';
        feedbackMessage.className = 'feedback-message feedback-message--error';
        feedbackMessage.style.display = 'block';
        return;
    }
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    feedbackMessage.style.display = 'none';
    
    try {
        // Get current page URL for context
        const pageUrl = currentTab?.url || 'unknown';
        
        // Send feedback to API
        try {
            const response = await fetch('https://sellonllm.com/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    feedback,
                    pageUrl,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
                }
                throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Track feedback submission
                trackEventAsync('feedback_submitted', 'Extension', 'User feedback submitted');
                
                feedbackMessage.textContent = 'Thank you for your feedback!';
                feedbackMessage.className = 'feedback-message feedback-message--success';
                feedbackInput.value = '';
                console.log('Feedback submitted successfully:', data);
            } else {
                throw new Error(data.message || data.error || 'Failed to submit feedback');
            }
        } catch (error) {
            console.error('Feedback submission error:', error);
            let errorMsg = error.message || 'Failed to submit feedback';
            
            // Provide more helpful error messages
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMsg = 'Network error: Unable to reach the server. Please check your internet connection.';
            } else if (error.message.includes('CORS')) {
                errorMsg = 'CORS error: Please ensure the API endpoint is properly configured.';
            }
            
            feedbackMessage.textContent = `Error: ${errorMsg}. Please try again.`;
            feedbackMessage.className = 'feedback-message feedback-message--error';
        }
        
        feedbackMessage.style.display = 'block';
        
        // Hide message after 3 seconds
        setTimeout(() => {
            feedbackMessage.style.display = 'none';
        }, 3000);
        
    } catch (error) {
        console.error('Feedback submission error:', error);
        feedbackMessage.textContent = 'Failed to submit feedback. Please try again.';
        feedbackMessage.className = 'feedback-message feedback-message--error';
        feedbackMessage.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Feedback';
    }
}

// Handle prompt relevance analysis
async function handlePromptAnalysis() {
    const promptInput = document.getElementById('prompt-input');
    const analyzeBtn = document.getElementById('analyze-prompts-btn');
    const promptResults = document.getElementById('prompt-results');
    const promptLoading = document.getElementById('prompt-loading');
    const promptError = document.getElementById('prompt-error');
    const promptErrorMessage = document.getElementById('prompt-error-message');
    
    if (!currentTab || !currentTab.url) {
        alert('Unable to get current page URL');
        return;
    }
    
    const promptsText = promptInput.value.trim();
    if (!promptsText) {
        alert('Please enter at least one prompt');
        return;
    }
    
    // Parse prompts (one per line)
    const prompts = promptsText
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    
    if (prompts.length === 0) {
        alert('Please enter at least one valid prompt');
        return;
    }
    
    // Limit to 5 prompts to avoid excessive API calls
    if (prompts.length > 5) {
        if (!confirm(`You entered ${prompts.length} prompts. Only the first 5 will be analyzed. Continue?`)) {
            return;
        }
    }
    
    const promptsToAnalyze = prompts.slice(0, 5);

    // Decide which credential path to use:
    //   1. If the user has an active Starter/Pro plan, run on the server (no API key needed) and count as 1 generation.
    //   2. Otherwise, use the BYO OpenAI API key (the user may also have one stored as a fallback).
    const planActive = !!(
        _entitlementSnapshot &&
        _entitlementSnapshot.active &&
        (_entitlementSnapshot.tier === 'starter' || _entitlementSnapshot.tier === 'pro')
    );
    const storedToken = planActive ? await getExtTokenFromStorage() : '';
    const storedApiKey = await getStoredApiKey();

    if (!planActive && !storedApiKey) {
        promptError.style.display = 'block';
        promptErrorMessage.innerHTML =
            'Either activate a Create Content plan to run this for free with your plan, or paste your own OpenAI API key under <em>Use my own OpenAI API key</em>.';
        const byo = document.getElementById('prompt-byo-key');
        if (byo) byo.open = true;
        return;
    }

    // Track prompt analysis start
    trackEventAsync('prompt_analysis_started', 'Extension', `Analyzing ${promptsToAnalyze.length} prompts`);

    // Show loading state
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    promptResults.style.display = 'none';
    promptError.style.display = 'none';
    promptLoading.style.display = 'block';

    // Robust response reader — Vercel sometimes returns an HTML 404 page when a route is missing,
    // in which case JSON.parse blows up with a useless syntax error. Always read text, then try JSON.
    async function readBody(response) {
        const text = await response.text().catch(() => '');
        try {
            return { kind: 'json', data: text ? JSON.parse(text) : {} };
        } catch {
            return { kind: 'text', data: text };
        }
    }

    async function callPlanEndpoint() {
        const headers = { 'Content-Type': 'application/json' };
        if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
        const res = await fetch(`${API_BASE}/api/extension/analyze-prompts`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ url: currentTab.url, prompts: promptsToAnalyze }),
        });
        return { res, body: await readBody(res) };
    }

    async function callByoEndpoint(apiKey) {
        const res = await fetch(`${API_BASE}/api/analyze-prompt-relevance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: currentTab.url, prompts: promptsToAnalyze, apiKey }),
        });
        return { res, body: await readBody(res) };
    }

    try {
        let attempt = { res: null, body: null };
        let pathUsed = '';

        if (planActive) {
            attempt = await callPlanEndpoint();
            pathUsed = 'plan';

            // If the plan endpoint isn't deployed yet (or returns a non-JSON 404),
            // gracefully fall back to BYO key path when the user has one stored.
            const isMissing =
                attempt.res.status === 404 ||
                (attempt.body.kind === 'text' && /could not be found|not found|<!doctype/i.test(attempt.body.data || ''));
            if (isMissing && storedApiKey) {
                attempt = await callByoEndpoint(storedApiKey);
                pathUsed = 'byo_fallback';
            } else if (isMissing) {
                throw new Error(
                    'The server hasn’t finished deploying the new prompt endpoint yet. Try again in ~1 minute, or paste your own OpenAI API key under "Use my own OpenAI API key" as a fallback.'
                );
            }
        } else {
            attempt = await callByoEndpoint(storedApiKey);
            pathUsed = 'byo';
        }

        const { res: response, body } = attempt;

        if (!response.ok) {
            if (body.kind === 'json') {
                const ed = body.data || {};
                if (response.status === 403 && ed.entitlement) {
                    throw new Error(
                        ed.error ||
                            'Plan limit reached for Create Content / Prompt analyses. Upgrade to Unlimited for unlimited usage.'
                    );
                }
                throw new Error(ed.message || ed.error || `HTTP ${response.status}`);
            }
            // Non-JSON error body — typically an HTML 404/500 page from Vercel.
            throw new Error(
                `Server error (HTTP ${response.status}). Please retry in a moment. If the issue persists, contact support.`
            );
        }

        const data = body.kind === 'json' ? body.data : null;
        if (!data) throw new Error('Empty response from server.');

        if (data.success) {
            trackEventAsync(
                'prompt_analysis_completed',
                'Extension',
                `Analyzed ${promptsToAnalyze.length} prompts via ${pathUsed}`,
                data.overallScore
            );
            displayPromptResults(data);
            // Refresh entitlement so the counter decrements in the UI.
            if (pathUsed === 'plan') refreshProEntitlement().catch(() => {});
        } else {
            throw new Error(data.error || 'Analysis failed');
        }

    } catch (error) {
        console.error('Prompt analysis error:', error);
        promptLoading.style.display = 'none';
        promptError.style.display = 'block';
        
        let errorMsg = error.message || 'Unknown error occurred';
        
        // Provide more helpful error messages
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.name === 'TypeError') {
            errorMsg = 'Network error: Unable to reach the server. Please check:\n1. Your internet connection\n2. The API endpoint is deployed\n3. Try again in a moment';
        } else if (error.message.includes('CORS')) {
            errorMsg = 'CORS error: Please ensure the API endpoint is properly configured.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMsg = 'Invalid API key. Please check your OpenAI API key and try again.';
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
            errorMsg = 'Rate limit exceeded. Please wait a moment and try again.';
        }
        
        promptErrorMessage.textContent = `Error: ${errorMsg}`;
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze Relevance';
        promptLoading.style.display = 'none';
    }
}

// Display prompt relevance results
function displayPromptResults(data) {
    const promptResults = document.getElementById('prompt-results');
    const promptResultsList = document.getElementById('prompt-results-list');
    const promptOverallScore = document.getElementById('prompt-overall-score-value');
    
    // Set overall score
    promptOverallScore.textContent = data.overallScore;
    
    // Clear previous results
    promptResultsList.innerHTML = '';
    
    // Display each prompt result
    data.results.forEach((result, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'prompt-result-item';
        
        // Determine score class
        let scoreClass = 'prompt-result-score--poor';
        if (result.score >= 90) {
            scoreClass = 'prompt-result-score--excellent';
        } else if (result.score >= 70) {
            scoreClass = 'prompt-result-score--good';
        } else if (result.score >= 50) {
            scoreClass = 'prompt-result-score--fair';
        }
        
        resultItem.innerHTML = `
            <div class="prompt-result-header">
                <div class="prompt-result-prompt">${escapeHtml(result.prompt)}</div>
                <div class="prompt-result-score ${scoreClass}">${result.score}</div>
            </div>
            <div class="prompt-result-explanation">${escapeHtml(result.explanation)}</div>
            <div class="prompt-result-details">
                ${result.strengths && result.strengths.length > 0 ? `
                    <div class="prompt-result-section">
                        <div class="prompt-result-section-title">Strengths:</div>
                        <ul class="prompt-result-list">
                            ${result.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${result.weaknesses && result.weaknesses.length > 0 ? `
                    <div class="prompt-result-section">
                        <div class="prompt-result-section-title">Weaknesses:</div>
                        <ul class="prompt-result-list">
                            ${result.weaknesses.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${result.recommendations && result.recommendations.length > 0 ? `
                    <div class="prompt-result-section">
                        <div class="prompt-result-section-title">Recommendations:</div>
                        <ul class="prompt-result-list">
                            ${result.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
        
        promptResultsList.appendChild(resultItem);
    });
    
    promptResults.style.display = 'block';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// API Key Management
async function loadSavedApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['openaiApiKey'], (result) => {
            const apiKeyInput = document.getElementById('openai-api-key');
            if (apiKeyInput && result.openaiApiKey) {
                // Show masked version (first 7 chars + ...)
                const masked = result.openaiApiKey.substring(0, 7) + '...' + result.openaiApiKey.substring(result.openaiApiKey.length - 4);
                apiKeyInput.value = masked;
                apiKeyInput.setAttribute('data-saved', 'true');
            }
            resolve(result.openaiApiKey || null);
        });
    });
}

async function saveApiKey(apiKey) {
    return new Promise((resolve, reject) => {
        // Validate API key format
        if (!apiKey || !apiKey.trim()) {
            reject(new Error('API key cannot be empty'));
            return;
        }
        
        if (!apiKey.startsWith('sk-')) {
            reject(new Error('Invalid API key format. OpenAI API keys start with "sk-"'));
            return;
        }
        
        chrome.storage.local.set({ openaiApiKey: apiKey.trim() }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

async function getStoredApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['openaiApiKey'], (result) => {
            resolve(result.openaiApiKey || null);
        });
    });
}

async function handleSaveApiKey() {
    const apiKeyInput = document.getElementById('openai-api-key');
    const apiKeyStatus = document.getElementById('api-key-status');
    const saveBtn = document.getElementById('save-api-key-btn');
    
    if (!apiKeyInput) return;
    
    const apiKey = apiKeyInput.value.trim();
    
    // If it's the masked saved key, don't save again
    if (apiKeyInput.getAttribute('data-saved') === 'true' && apiKey.includes('...')) {
        apiKeyStatus.style.display = 'block';
        apiKeyStatus.className = 'api-key-status api-key-status--saved';
        apiKeyStatus.textContent = '✓ API key already saved';
        setTimeout(() => {
            apiKeyStatus.style.display = 'none';
        }, 2000);
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    apiKeyStatus.style.display = 'none';
    
    try {
        await saveApiKey(apiKey);
        
        // Track API key save
        trackEventAsync('api_key_saved', 'Extension', 'OpenAI API key saved');
        
        // Mask the key in the input
        const masked = apiKey.substring(0, 7) + '...' + apiKey.substring(apiKey.length - 4);
        apiKeyInput.value = masked;
        apiKeyInput.setAttribute('data-saved', 'true');
        apiKeyInput.type = 'password'; // Keep it as password type
        
        apiKeyStatus.style.display = 'block';
        apiKeyStatus.className = 'api-key-status api-key-status--saved';
        apiKeyStatus.textContent = '✓ API key saved securely';
        
        setTimeout(() => {
            apiKeyStatus.style.display = 'none';
        }, 3000);
        
    } catch (error) {
        apiKeyStatus.style.display = 'block';
        apiKeyStatus.className = 'api-key-status api-key-status--error';
        apiKeyStatus.textContent = `✗ ${error.message}`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

/* -------- SellOnLLM Create Content (Polar checkout + gpt-4o server-side) -------- */
const API_BASE = 'https://www.sellonllm.com';
const EXT_TOKEN_KEY = 'sellonllm_extension_jwt';
const HISTORY_KEY = 'sellonllm_generation_history';
const HISTORY_MAX = 20;
const ACTIVATION_URL = `${API_BASE}/extension-connect.html`;
const PLANS_URL = `${API_BASE}/extension-upgrade.html`;

const TITLE_LIMIT = 60;
const TITLE_LIMIT_WARN = 70;
const DESC_LIMIT = 160;
const DESC_LIMIT_WARN = 170;

// Live snapshot of the user's plan so multiple panels (pro-strip, prompt tab, etc.)
// can react without each issuing their own /api/extension/status call.
let _entitlementSnapshot = null;

function getExtTokenFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get([EXT_TOKEN_KEY], (r) => resolve(r[EXT_TOKEN_KEY] || ''));
    });
}

function setExtTokenInStorage(token) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [EXT_TOKEN_KEY]: token.trim() }, resolve);
    });
}

function clearExtTokenFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.remove([EXT_TOKEN_KEY], resolve);
    });
}

/** Watch storage so a token saved by the auto-import content script refreshes the UI live. */
chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'local' || !changes[EXT_TOKEN_KEY]) return;
    chrome.storage.local.remove('entitlement_cache');
    refreshProEntitlement({ force: true }).catch(() => { /* noop */ });
});

/* -------- Generation history (local-only) -------- */
function loadHistory() {
    return new Promise((resolve) => {
        chrome.storage.local.get([HISTORY_KEY], (r) => {
            const list = Array.isArray(r[HISTORY_KEY]) ? r[HISTORY_KEY] : [];
            resolve(list);
        });
    });
}

function saveHistory(list) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [HISTORY_KEY]: list.slice(0, HISTORY_MAX) }, resolve);
    });
}

async function addHistoryEntry(entry) {
    const list = await loadHistory();
    list.unshift(entry);
    await saveHistory(list);
    return list;
}

async function clearHistory() {
    await saveHistory([]);
    return [];
}

function formatTimeAgo(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d} d ago`;
    return new Date(ts).toLocaleDateString();
}

function hostFromUrl(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); }
    catch { return u || ''; }
}

function shortUrl(u) {
    try {
        const url = new URL(u);
        const p = url.pathname.length > 1 ? url.pathname : '';
        return `${url.host.replace(/^www\./, '')}${p}`;
    } catch { return u || ''; }
}

function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

/* -------- Render: result cards + char counts -------- */
function setCharCount(el, value, limit, warn) {
    if (!el) return;
    el.classList.remove('cc-charcount--ok', 'cc-charcount--warn', 'cc-charcount--err');
    const n = value ? String(value).length : 0;
    el.textContent = n ? `${n} chars` : '';
    if (!n) return;
    if (n <= limit) el.classList.add('cc-charcount--ok');
    else if (n <= warn) el.classList.add('cc-charcount--warn');
    else el.classList.add('cc-charcount--err');
}

function renderResults(data, ctx) {
    const resultsEl = document.getElementById('cc-results');
    const headingEl = document.getElementById('cc-results-heading');
    const metaEl = document.getElementById('cc-results-meta');
    const titleEl = document.getElementById('cc-title-text');
    const descEl = document.getElementById('cc-desc-text');
    const bodyEl = document.getElementById('cc-body-text');
    const notesEl = document.getElementById('cc-notes');
    const usageEl = document.getElementById('pro-usage');

    const meta = (data && data.meta) || {};
    const content = (data && data.content) || '';
    const mode = (data && data.mode) || 'both';
    const title = meta.title || '';
    const description = meta.description || '';
    const notes = meta.notes || data?.summary || '';

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;
    if (bodyEl) bodyEl.textContent = content;

    setCharCount(document.getElementById('cc-title-count'), title, TITLE_LIMIT, TITLE_LIMIT_WARN);
    setCharCount(document.getElementById('cc-desc-count'), description, DESC_LIMIT, DESC_LIMIT_WARN);
    const bodyCountEl = document.getElementById('cc-body-count');
    if (bodyCountEl) {
        bodyCountEl.classList.remove('cc-charcount--ok', 'cc-charcount--warn', 'cc-charcount--err');
        bodyCountEl.textContent = content ? `${content.length} chars` : '';
    }

    if (notesEl) {
        if (notes && notes.trim()) {
            notesEl.textContent = notes;
            notesEl.hidden = false;
        } else {
            notesEl.hidden = true;
            notesEl.textContent = '';
        }
    }

    // Show/hide cards by mode
    const titleCard = document.getElementById('cc-card-title');
    const descCard = document.getElementById('cc-card-desc');
    const bodyCard = document.getElementById('cc-card-body');
    if (titleCard) titleCard.hidden = mode === 'rewrite' && !title;
    if (descCard) descCard.hidden = mode === 'rewrite' && !description;
    if (bodyCard) bodyCard.hidden = mode === 'meta' && !content;

    if (headingEl) {
        headingEl.textContent =
            mode === 'meta' ? 'Suggested title & description'
            : mode === 'rewrite' ? 'Draft page copy'
            : 'Suggestions';
    }
    if (metaEl) {
        const url = ctx?.url || data?.contextUrl || '';
        metaEl.textContent = url ? shortUrl(url) : '';
    }

    if (usageEl && data?.usage) {
        const u = data.usage;
        usageEl.textContent = u.limit == null
            ? 'Unlimited plan — generation completed.'
            : `Starter: ${u.used} / ${u.limit} generations used.`;
    } else if (usageEl) {
        usageEl.textContent = '';
    }

    if (resultsEl) resultsEl.hidden = false;
}

function renderResultsFromHistory(entry) {
    renderResults(
        {
            meta: entry.meta,
            content: entry.content,
            summary: entry.summary,
            mode: entry.mode,
            usage: entry.usage,
            contextUrl: entry.url,
        },
        { url: entry.url }
    );
    const meta = document.getElementById('cc-results-meta');
    if (meta) meta.textContent = `${shortUrl(entry.url)} · ${formatTimeAgo(entry.ts)}`;
}

/* -------- Render: history list -------- */
async function renderHistory() {
    const wrap = document.getElementById('cc-history-wrap');
    const list = document.getElementById('cc-history-list');
    const count = document.getElementById('cc-history-count');
    if (!wrap || !list) return;
    const items = await loadHistory();
    if (count) count.textContent = String(items.length);
    list.innerHTML = '';
    if (!items.length) {
        wrap.hidden = true;
        return;
    }
    wrap.hidden = false;
    items.forEach((entry) => {
        const li = document.createElement('li');
        li.className = 'cc-history-item';
        li.dataset.id = entry.id;
        const preview = (entry.meta?.title || entry.meta?.description || entry.content || entry.summary || '').slice(0, 140);
        li.innerHTML =
            '<div class="cc-history-item__top">' +
                '<span class="cc-history-item__url" title="' + escHtml(entry.url || '') + '">' +
                    '<span class="cc-history-item__badge">' + escHtml(entry.mode || 'both') + '</span>' +
                    escHtml(shortUrl(entry.url || '')) +
                '</span>' +
                '<span class="cc-history-item__time">' + escHtml(formatTimeAgo(entry.ts)) + '</span>' +
            '</div>' +
            (preview ? '<div class="cc-history-item__preview">' + escHtml(preview) + '</div>' : '');
        li.addEventListener('click', () => {
            renderResultsFromHistory(entry);
            const results = document.getElementById('cc-results');
            results?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        list.appendChild(li);
    });
}

/* -------- Copy buttons (event delegation) -------- */
document.addEventListener('click', (ev) => {
    const btn = ev.target?.closest?.('.cc-copy-btn');
    if (!btn) return;
    const srcId = btn.getAttribute('data-copy-source');
    const src = srcId && document.getElementById(srcId);
    if (!src) return;
    const text = src.textContent || '';
    if (!text.trim()) return;
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('is-copied');
        setTimeout(() => {
            btn.textContent = orig || 'Copy';
            btn.classList.remove('is-copied');
        }, 1400);
    }).catch(() => {
        btn.textContent = 'Copy failed';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1400);
    });
});

document.addEventListener('click', (ev) => {
    if (!ev.target?.closest?.('#cc-history-clear-btn')) return;
    clearHistory().then(renderHistory);
});

function formatPeriodEnd(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (_) {
        return '';
    }
}

function updateCancelNotice(j) {
    const notice = document.getElementById('cc-link-cancel-notice');
    if (!notice) return;
    if (j && j.tier === 'pro' && j.cancelAtPeriodEnd) {
        const ends = j.currentPeriodEnd ? formatPeriodEnd(j.currentPeriodEnd) : null;
        const text = document.getElementById('cc-link-cancel-text');
        if (text) {
            text.textContent = ends
                ? `Unlimited cancels on ${ends}. You keep access until then.`
                : 'Unlimited is scheduled to cancel at period end.';
        }
        notice.hidden = false;
    } else {
        notice.hidden = true;
    }
}

function setLinkStatus(text, kind, opts) {
    const el = document.getElementById('link-status-text');
    const dot = document.getElementById('link-status-dot');
    if (el) el.textContent = text || '';
    if (dot) {
        dot.classList.remove('link-dot--ok', 'link-dot--warn', 'link-dot--err', 'link-dot--idle');
        dot.classList.add(`link-dot--${kind || 'idle'}`);
    }
    const compactText = document.getElementById('cc-link-compact-text');
    if (compactText) compactText.textContent = text || '';
    const wrap = document.getElementById('cc-wrap');
    if (wrap) {
        if (opts && opts.linked) wrap.classList.add('cc-wrap--linked');
        else wrap.classList.remove('cc-wrap--linked');
    }
}

function updateProStripFromEntitlement(j) {
    // Once the user has an active plan, hide the pro-strip entirely. They've paid; the status
    // and quota are already shown inside the Create Content tab.
    const proStrip = document.getElementById('pro-strip');
    if (!proStrip) return;
    const active = !!(j && j.active && (j.tier === 'starter' || j.tier === 'pro'));
    proStrip.style.display = active ? 'none' : '';
}

function updatePromptTabBanner(j) {
    const banner = document.getElementById('prompt-pro-banner');
    const sub = document.getElementById('prompt-pro-banner-sub');
    const byo = document.getElementById('prompt-byo-key');
    const summary = document.getElementById('api-key-summary-label');
    const active = !!(j && j.active && (j.tier === 'starter' || j.tier === 'pro'));

    if (banner) banner.hidden = !active;
    if (active && sub) {
        if (j.tier === 'pro') {
            sub.textContent = 'Unlimited prompt analyses on your plan. Each click counts as 1 generation.';
        } else {
            const left = Math.max(0, (j.limit ?? 10) - (j.used ?? 0));
            sub.textContent = `Each analysis counts as 1 generation, no matter how many prompts you enter. ${left}/${j.limit ?? 10} left on Starter.`;
        }
    }
    if (byo) {
        // When the user is paid, collapse the BYO key section by default and label it as optional.
        if (active) {
            byo.open = false;
            if (summary) summary.textContent = 'Or use my own OpenAI API key (optional)';
        } else {
            byo.open = true;
            if (summary) summary.textContent = 'Use my own OpenAI API key';
        }
    }
}

function setForgetVisible(visible) {
    const btn = document.getElementById('forget-ext-token-btn');
    if (btn) btn.style.display = visible ? '' : 'none';
}

const ENTITLEMENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Applies a fetched (or cached) entitlement payload to the UI.
// Extracted so both the live-fetch path and cache-hit path share the same rendering logic.
function _applyEntitlementToUI(j) {
    const label = document.getElementById('entitlement-label');
    const detail = document.getElementById('ext-entitlement-detail');
    const marketing = document.getElementById('create-content-marketing');
    const tool = document.getElementById('create-content-tool');
    const statusMsg = document.getElementById('create-content-status-msg');
    const genCounter = document.getElementById('create-content-gen-counter');

    function _hide(el) { if (el) { el.style.display = 'none'; el.textContent = ''; } }

    const paid = j.active === true && (j.tier === 'starter' || j.tier === 'pro');
    if (!paid) {
        _hide(statusMsg);
        _hide(genCounter);
        if (marketing) marketing.style.display = '';
        if (tool) tool.style.display = 'none';
        setLinkStatus('Linked, but no active plan yet. Open Activation and click Verify my purchase.', 'warn', { linked: false });
        setForgetVisible(true);
        if (label) label.textContent = '';
        if (detail) detail.textContent = '';
        _entitlementSnapshot = j || null;
        updateProStripFromEntitlement(null);
        updatePromptTabBanner(null);
        return;
    }

    // Active plan — show the tool panel.
    _hide(statusMsg);
    if (marketing) marketing.style.display = 'none';
    if (tool) tool.style.display = 'block';
    setForgetVisible(true);

    if (genCounter) {
        if (j.tier === 'starter' && j.limit != null && j.active) {
            const left = Math.max(0, j.limit - j.used);
            genCounter.style.display = 'block';
            genCounter.textContent = left > 0
                ? `Create Content: ${j.used} / ${j.limit} generations used (${left} left on Starter)`
                : `Create Content: ${j.used} / ${j.limit} used — upgrade to Unlimited for unlimited generations.`;
        } else if (j.tier === 'pro' && j.active) {
            genCounter.style.display = 'block';
            genCounter.textContent = 'Create Content: unlimited generations on Unlimited.';
        } else {
            _hide(genCounter);
        }
    }

    if (j.tier === 'pro') {
        if (j.cancelAtPeriodEnd && j.currentPeriodEnd) {
            setLinkStatus(`Linked · Unlimited · cancels on ${formatPeriodEnd(j.currentPeriodEnd)}`, 'warn', { linked: true });
        } else {
            setLinkStatus('Linked · Unlimited', 'ok', { linked: true });
        }
    } else if (j.tier === 'starter') {
        const left = Math.max(0, (j.limit ?? 10) - (j.used ?? 0));
        setLinkStatus(`Linked · Starter · ${left}/${j.limit ?? 10} left`, 'ok', { linked: true });
    }
    updateCancelNotice(j);
    _entitlementSnapshot = j;
    updateProStripFromEntitlement(j);
    updatePromptTabBanner(j);
    populatePageContext();
    renderHistory().catch(() => {});

    if (label) {
        label.textContent = j.canGenerate
            ? (j.limit == null ? 'Active · Unlimited' : `Active · Starter ${j.used}/${j.limit}`)
            : (j.limit != null ? `Used up (${j.used}/${j.limit}) — upgrade to Unlimited` : 'Plan inactive');
    }
    if (detail) {
        detail.textContent = j.canGenerate
            ? (j.limit == null
                ? 'Unlimited Create Content generations on this plan.'
                : `Starter includes ${j.limit} Create Content generations total (${j.used} used so far).`)
            : (j.limit != null
                ? `You've used all ${j.limit} generations on Starter. Upgrade to Unlimited for unlimited runs.`
                : 'Plan inactive on this account. Open Activation and click Verify my purchase.');
    }
}

async function refreshProEntitlement({ force = false } = {}) {
    const label = document.getElementById('entitlement-label');
    const detail = document.getElementById('ext-entitlement-detail');
    const marketing = document.getElementById('create-content-marketing');
    const tool = document.getElementById('create-content-tool');
    const statusMsg = document.getElementById('create-content-status-msg');
    const genCounter = document.getElementById('create-content-gen-counter');
    const input = document.getElementById('ext-token-input');

    function hideGenCounter() {
        if (!genCounter) return;
        genCounter.style.display = 'none';
        genCounter.textContent = '';
    }

    function showGenCounterFor(j) {
        if (!genCounter) return;
        if (j.tier === 'starter' && j.limit != null && j.active) {
            const left = Math.max(0, j.limit - j.used);
            genCounter.style.display = 'block';
            genCounter.textContent =
                left > 0
                    ? `Create Content: ${j.used} / ${j.limit} generations used (${left} left on Starter)`
                    : `Create Content: ${j.used} / ${j.limit} used — upgrade to Unlimited for unlimited generations.`;
        } else if (j.tier === 'pro' && j.active) {
            genCounter.style.display = 'block';
            genCounter.textContent = 'Create Content: unlimited generations on Unlimited.';
        } else {
            hideGenCounter();
        }
    }

    function hideStatusMsg() {
        if (!statusMsg) return;
        statusMsg.style.display = 'none';
        statusMsg.textContent = '';
    }

    const token = await getExtTokenFromStorage();
    if (input) input.value = '';

    // No stored token at all → not linked, show marketing + clear all derived state.
    if (!token) {
        hideStatusMsg();
        hideGenCounter();
        if (marketing) marketing.style.display = '';
        if (tool) tool.style.display = 'none';
        if (label) label.textContent = '';
        if (detail) detail.textContent = '';
        setLinkStatus('Not linked yet — finish activation to enable Create Content.', 'idle', { linked: false });
        setForgetVisible(false);
        _entitlementSnapshot = null;
        updateProStripFromEntitlement(null);
        updatePromptTabBanner(null);
        return;
    }

    // Serve from cache when not forcing a refresh (reduces /api/extension/status calls)
    if (!force) {
        const cached = await new Promise(resolve =>
            chrome.storage.local.get(['entitlement_cache'], r => resolve(r.entitlement_cache || null))
        );
        if (cached && cached.j && (Date.now() - cached.ts) < ENTITLEMENT_CACHE_TTL_MS) {
            _applyEntitlementToUI(cached.j);
            return;
        }
    }

    // We have a token → validate it before believing anything.
    let resp, j;
    try {
        resp = await fetch(`${API_BASE}/api/extension/status`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        j = await resp.json();
    } catch (e) {
        setLinkStatus('Network error checking your plan. Retry in a moment.', 'warn');
        setForgetVisible(true);
        return;
    }

    if (resp.status === 401) {
        // Token is invalid or expired → wipe it so the popup is honest about state.
        await clearExtTokenFromStorage();
        if (marketing) marketing.style.display = '';
        if (tool) tool.style.display = 'none';
        hideGenCounter();
        hideStatusMsg();
        setLinkStatus(
            'Old connection has expired. Open Activation and click Link this browser again.',
            'warn',
            { linked: false }
        );
        setForgetVisible(false);
        if (label) label.textContent = '';
        if (detail) detail.textContent = '';
        _entitlementSnapshot = null;
        updateProStripFromEntitlement(null);
        updatePromptTabBanner(null);
        return;
    }

    if (!resp.ok) {
        setLinkStatus(`Could not check plan status (${resp.status}). Try again.`, 'warn', { linked: false });
        setForgetVisible(true);
        return;
    }

    // Cache the fresh response, then apply to UI.
    chrome.storage.local.set({ entitlement_cache: { j, ts: Date.now() } });
    _applyEntitlementToUI(j);
}



function summarizeChecksForGenerate(checks) {
    if (!checks) return '';
    const failed = Object.keys(checks).filter((k) => checks[k] && !checks[k].pass);
    return failed.slice(0, 14).join(', ') || 'checks mostly passing';
}

let _lastPageContext = null;

async function populatePageContext() {
    const urlEl = document.getElementById('cc-context-url');
    const titleEl = document.getElementById('cc-context-title');
    const descEl = document.getElementById('cc-context-desc');
    const wrap = document.getElementById('cc-page-context');
    if (!urlEl || !titleEl || !descEl || !wrap) return;
    if (!currentTab?.id) {
        wrap.hidden = true;
        return;
    }
    try {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                files: ['content.js'],
            });
        } catch (e) { /* already injected */ }
        const ctx = await chrome.tabs.sendMessage(currentTab.id, { action: 'getPageContextForGeneration' });
        if (ctx && !ctx.error) {
            _lastPageContext = ctx;
            urlEl.textContent = shortUrl(ctx.url || currentTab.url || '');
            titleEl.textContent = (ctx.pageTitle || '—').slice(0, 200);
            descEl.textContent = (ctx.metaDescription || '—').slice(0, 280);
            wrap.hidden = false;
            return;
        }
    } catch (e) { /* fall through */ }
    // Fallback to whatever we know
    urlEl.textContent = shortUrl(currentTab.url || '');
    titleEl.textContent = currentTab.title || '—';
    descEl.textContent = '—';
    wrap.hidden = false;
}

function selectedMode() {
    const checked = document.querySelector('input[name="cc-mode"]:checked');
    return checked?.value || 'both';
}

document.getElementById('upgrade-btn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: PLANS_URL });
    trackEventAsync('pro_upgrade_click', 'Extension', 'upgrade_btn');
});


document.getElementById('create-content-upgrade-cta')?.addEventListener('click', () => {
    chrome.tabs.create({ url: PLANS_URL });
    trackEventAsync('pro_upgrade_click', 'Extension', 'create_content_cta');
});

document.getElementById('open-activation-page-btn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: ACTIVATION_URL });
    trackEventAsync('ext_activation_page', 'Extension', 'open');
});

document.getElementById('cc-link-manage-sub')?.addEventListener('click', (ev) => {
    ev.preventDefault();
    chrome.tabs.create({ url: ACTIVATION_URL });
    trackEventAsync('ext_manage_sub', 'Extension', 'cancel_notice');
});

document.getElementById('open-activation-from-status')?.addEventListener('click', (ev) => {
    ev.preventDefault();
    chrome.tabs.create({ url: ACTIVATION_URL });
    trackEventAsync('ext_activation_page', 'Extension', 'status_link');
});

async function handleSaveTokenFrom(inputId) {
    const input = document.getElementById(inputId);
    const token = (input?.value || '').trim();
    if (!token) return;
    await setExtTokenInStorage(token);
    if (input) input.value = '';
    chrome.storage.local.remove('entitlement_cache');
    await refreshProEntitlement({ force: true });
    trackEventAsync('ext_token_saved', 'Extension', 'saved');
}

document.getElementById('save-ext-token-btn')?.addEventListener('click', () => handleSaveTokenFrom('ext-token-input'));
document.getElementById('save-ext-token-btn-full')?.addEventListener('click', () => handleSaveTokenFrom('ext-token-input-full'));

document.getElementById('refresh-entitlement-btn')?.addEventListener('click', () => refreshProEntitlement({ force: true }));
document.getElementById('refresh-entitlement-btn-full')?.addEventListener('click', () => refreshProEntitlement({ force: true }));

document.getElementById('open-activation-from-status-full')?.addEventListener('click', (ev) => {
    ev.preventDefault();
    chrome.tabs.create({ url: ACTIVATION_URL });
    trackEventAsync('ext_activation_page', 'Extension', 'status_link_full');
});

document.getElementById('forget-ext-token-btn')?.addEventListener('click', async () => {
    await clearExtTokenFromStorage();
    chrome.storage.local.remove('entitlement_cache');
    await refreshProEntitlement({ force: true });
    trackEventAsync('ext_token_forgotten', 'Extension', 'forget');
});

document.getElementById('generate-pro-btn')?.addEventListener('click', async () => {
    const token = await getExtTokenFromStorage();
    const proLoading = document.getElementById('pro-loading');
    const proError = document.getElementById('pro-error');
    const proErrMsg = document.getElementById('pro-error-msg');
    const results = document.getElementById('cc-results');
    const genBtn = document.getElementById('generate-pro-btn');
    proError.style.display = 'none';
    if (results) results.hidden = true;

    if (!token) {
        proErrMsg.textContent =
            'This browser isn’t linked yet. Open the activation page on sellonllm.com (the extension can link it automatically), then come back here.';
        proError.style.display = 'block';
        return;
    }
    if (!currentTab?.id) return;

    proLoading.style.display = 'block';
    if (genBtn) genBtn.disabled = true;
    const mode = selectedMode();

    try {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                files: ['content.js'],
            });
        } catch (e) {
            /* already injected */
        }
        await new Promise((r) => setTimeout(r, 80));
        const ctx = await chrome.tabs.sendMessage(currentTab.id, { action: 'getPageContextForGeneration' });
        if (ctx?.error) throw new Error(ctx.error);

        const checksSummary = summarizeChecksForGenerate(currentAuditData?.checks);
        const res = await fetch(`${API_BASE}/api/extension/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                mode,
                url: ctx.url,
                pageTitle: ctx.pageTitle,
                metaDescription: ctx.metaDescription,
                h1: ctx.h1,
                bodyText: ctx.bodyText,
                checksSummary,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);

        renderResults({ ...data, mode }, ctx);

        // Persist the generation so the user can come back to it later.
        const entry = {
            id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ts: Date.now(),
            url: ctx.url,
            mode,
            meta: data.meta || {},
            content: data.content || '',
            summary: data.summary || '',
            usage: data.usage || null,
            model: data.model || '',
        };
        await addHistoryEntry(entry);
        await renderHistory();

        trackEventAsync('pro_generate_ok', 'Extension', mode);
        await refreshProEntitlement();
    } catch (e) {
        proErrMsg.textContent = e.message || String(e);
        proError.style.display = 'block';
        trackEventAsync('pro_generate_err', 'Extension', e.message || 'err');
    } finally {
        proLoading.style.display = 'none';
        if (genBtn) genBtn.disabled = false;
    }
});

(async function initProOnLoad() {
    refreshProEntitlement();
    renderHistory().catch(() => { /* noop */ });
})();

/* =============================================================
   AI Readability (Citability) tab
   =============================================================
   Flow:
     1. Capture the live DOM in the active tab (chrome.scripting.executeScript)
     2. POST { url, humanView } to /api/extension/citability
     3. Server fetches the URL as GPTBot (no JS), diffs vs humanView, returns report
     4. Render score, side-by-side panels, and the "hidden from AI agents" list
   ============================================================= */

const CIT_VIEW_LABELS = { words: 'Words', headings: 'Headings', schema: 'Schema', html: 'HTML' };
let _citLastResult = null;
let _citCurrentView = 'words';

function _q(id) { return document.getElementById(id); }

function _citShowState(state) {
    const idle = _q('cit-idle');
    const loading = _q('cit-loading');
    const error = _q('cit-error');
    const result = _q('cit-result');
    if (idle) idle.hidden = state !== 'idle';
    if (loading) loading.hidden = state !== 'loading';
    if (error) error.hidden = state !== 'error';
    if (result) result.hidden = state !== 'result';
}

function _citSetError(htmlOrText, asHtml) {
    const el = _q('cit-error');
    if (!el) return;
    if (asHtml) el.innerHTML = htmlOrText;
    else el.textContent = htmlOrText;
    _citShowState('error');
}

async function _citGetActiveTab() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0] || null));
    });
}

/**
 * Runs inside the target page via chrome.scripting.executeScript.
 * Must be self-contained — no closures, no outer references.
 */
function _collectHumanViewInPage() {
    function isVisible(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el.hasAttribute('hidden')) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0) return false;
        return true;
    }
    function gatherText(root) {
        const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME']);
        const parts = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                let p = node.parentElement;
                while (p) {
                    if (skip.has(p.tagName)) return NodeFilter.FILTER_REJECT;
                    if (!isVisible(p)) return NodeFilter.FILTER_REJECT;
                    p = p.parentElement;
                }
                const t = node.nodeValue;
                if (!t || !t.trim()) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        });
        let node;
        while ((node = walker.nextNode())) parts.push(node.nodeValue);
        return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
    function collectHeadings() {
        const out = [];
        document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
            if (!isVisible(h)) return;
            const text = (h.textContent || '').replace(/\s+/g, ' ').trim();
            if (text) out.push({ tag: h.tagName.toLowerCase(), text: text.slice(0, 300) });
        });
        return out.slice(0, 200);
    }
    function collectBlocks() {
        const out = [];
        document.querySelectorAll('p,li,blockquote,td,dd').forEach((b) => {
            if (!isVisible(b)) return;
            const text = (b.textContent || '').replace(/\s+/g, ' ').trim();
            if (text.length >= 30) out.push(text.slice(0, 400));
        });
        return out.slice(0, 500);
    }
    function collectSchema() {
        const types = new Set();
        document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
            try {
                const data = JSON.parse(s.textContent || '');
                const walk = (o) => {
                    if (!o || typeof o !== 'object') return;
                    if (Array.isArray(o)) return o.forEach(walk);
                    if (o['@type']) {
                        const ts = Array.isArray(o['@type']) ? o['@type'] : [o['@type']];
                        ts.forEach((t) => types.add(String(t)));
                    }
                    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v);
                };
                walk(data);
            } catch (_) { /* ignore */ }
        });
        return [...types].slice(0, 50);
    }
    const fullText = gatherText(document.body);
    return {
        words: fullText.split(/\s+/).filter(Boolean).length,
        title: (document.title || '').slice(0, 500),
        metaDescription: (document.querySelector('meta[name="description"]')?.getAttribute('content') || '').slice(0, 1000),
        h1: (document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
        headings: collectHeadings(),
        blocks: collectBlocks(),
        schemaTypes: collectSchema(),
        hasMainLandmark: !!document.querySelector('main, [role="main"]'),
    };
}

async function _citCaptureHumanView(tabId) {
    if (!chrome.scripting?.executeScript) {
        throw new Error('script_injection_unavailable');
    }
    const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: _collectHumanViewInPage,
        world: 'MAIN',
    });
    return result?.result || null;
}

function _citEscape(t) {
    const d = document.createElement('div');
    d.textContent = t == null ? '' : String(t);
    return d.innerHTML;
}

function _citHeadlineForScore(score, agentWords, humanWords) {
    if (humanWords <= 0) return 'No human content captured — try re-loading the page.';
    return `AI agents see <strong>${score}%</strong> of your content (${agentWords.toLocaleString()} of ${humanWords.toLocaleString()} visible words).`;
}

function _citVerdictColorClass(verdict) {
    switch (verdict) {
        case 'Excellent': return 'cit-score-card--excellent';
        case 'Good':      return 'cit-score-card--good';
        case 'Partial':   return 'cit-score-card--partial';
        default:          return 'cit-score-card--critical';
    }
}

function _citRenderFlags(result) {
    const flags = [];
    if (result.cloaking?.detected) {
        flags.push({ kind: 'bad', text: '⚠ Cloaking detected' });
    }
    if (result.robots?.disallowed?.length) {
        flags.push({
            kind: 'bad',
            text: `🚫 robots.txt blocks ${result.robots.disallowed.length} AI bot${result.robots.disallowed.length === 1 ? '' : 's'}`,
        });
    }
    if (result.diff?.titleMismatch) {
        flags.push({ kind: 'warn', text: '⚠ Title differs from what humans see' });
    }
    if (result.diff?.h1Missing) {
        flags.push({ kind: 'warn', text: '⚠ H1 missing in agent view' });
    }
    if (result.diff?.hiddenSchema?.length) {
        flags.push({
            kind: 'warn',
            text: `⚠ ${result.diff.hiddenSchema.length} schema type${result.diff.hiddenSchema.length === 1 ? '' : 's'} hidden`,
        });
    }
    if (result.agent?.status && result.agent.status >= 400) {
        flags.push({ kind: 'bad', text: `🚫 Agent fetch returned ${result.agent.status}` });
    }
    if (!flags.length && result.score >= 85) {
        flags.push({ kind: 'ok', text: '✓ Bots see the page like humans do' });
    }
    const wrap = _q('cit-flags');
    if (!wrap) return;
    wrap.innerHTML = flags
        .map((f) => `<span class="cit-flag cit-flag--${f.kind}">${_citEscape(f.text)}</span>`)
        .join('') || '';
}

function _citRenderPanel(targetId, side, result, view) {
    const el = _q(targetId);
    if (!el) return;
    const v = side === 'agent' ? result.agent : result.human;
    if (!v) {
        el.innerHTML = '<div class="cit-panel__empty">No data.</div>';
        return;
    }
    if (view === 'words') {
        const blocks = (v.blocks || []).slice(0, 8);
        const blockHtml = blocks.length
            ? `<ul class="cit-panel__list">${blocks
                  .map((b) => `<li>${_citEscape(String(b).slice(0, 160))}${String(b).length > 160 ? '…' : ''}</li>`)
                  .join('')}</ul>`
            : '<div class="cit-panel__empty">No text blocks detected.</div>';
        el.innerHTML = `
            <div class="cit-panel__metric">${(v.words || 0).toLocaleString()}</div>
            <div class="cit-panel__metric-label">visible words${v.title ? ` · "${_citEscape(String(v.title).slice(0, 60))}${String(v.title).length > 60 ? '…' : ''}"` : ''}</div>
            ${blockHtml}
        `;
    } else if (view === 'headings') {
        const heads = v.headings || [];
        el.innerHTML = `
            <div class="cit-panel__metric">${heads.length}</div>
            <div class="cit-panel__metric-label">headings</div>
            ${heads.length
                ? `<ul class="cit-panel__list">${heads
                      .slice(0, 40)
                      .map((h) => `<li><span class="cit-panel__tag">${_citEscape(h.tag || 'h?')}</span><span>${_citEscape(h.text)}</span></li>`)
                      .join('')}</ul>`
                : '<div class="cit-panel__empty">No headings.</div>'}
        `;
    } else if (view === 'schema') {
        const types = v.schemaTypes || [];
        el.innerHTML = `
            <div class="cit-panel__metric">${types.length}</div>
            <div class="cit-panel__metric-label">JSON-LD types</div>
            ${types.length
                ? `<ul class="cit-panel__list">${types
                      .map((t) => `<li><span class="cit-panel__tag">@type</span><span>${_citEscape(t)}</span></li>`)
                      .join('')}</ul>`
                : '<div class="cit-panel__empty">No structured data.</div>'}
        `;
    } else if (view === 'html') {
        const summary = [
            `Title: ${v.title || '—'}`,
            `Meta description: ${v.metaDescription || '—'}`,
            `H1: ${v.h1 || '—'}`,
            `Has <main>: ${v.hasMainLandmark ? 'yes' : 'no'}`,
            `Visible words: ${v.words || 0}`,
            `Headings: ${(v.headings || []).length}`,
            `JSON-LD types: ${(v.schemaTypes || []).join(', ') || 'none'}`,
            side === 'agent' && result.agent.status ? `HTTP status: ${result.agent.status}` : null,
            side === 'agent' && result.agent.fetchError ? `Fetch note: ${result.agent.fetchError}` : null,
            side === 'agent' && result.finalUrl ? `Final URL: ${result.finalUrl}` : null,
        ].filter(Boolean).join('\n');
        el.innerHTML = `<pre class="cit-panel__html">${_citEscape(summary)}</pre>`;
    }
}

function _citRenderDiff(result) {
    const card = _q('cit-diff-card');
    const list = _q('cit-diff-list');
    const more = _q('cit-diff-more');
    if (!card || !list) return;
    const d = result.diff || {};
    const items = [];
    (d.hiddenHeadings || []).forEach((h) => {
        items.push({ tag: h.tag || 'h?', text: h.text });
    });
    (d.hiddenSchema || []).forEach((t) => {
        items.push({ tag: 'schema', text: `${t} (JSON-LD)` });
    });
    (d.hiddenBlocks || []).forEach((b) => {
        items.push({ tag: 'text', text: typeof b === 'string' ? b : b.text });
    });

    if (!items.length) {
        card.hidden = true;
        return;
    }

    card.hidden = false;
    const visible = items.slice(0, 20);
    list.innerHTML = visible
        .map(
            (i) =>
                `<li><span class="cit-panel__tag">${_citEscape(i.tag)}</span><span>${_citEscape(
                    String(i.text).slice(0, 220),
                )}${String(i.text).length > 220 ? '…' : ''}</span></li>`,
        )
        .join('');
    if (items.length > visible.length) {
        more.hidden = false;
        more.textContent = `…and ${items.length - visible.length} more hidden sections.`;
    } else {
        more.hidden = true;
    }
}

function _citApplyView(view) {
    _citCurrentView = view;
    document.querySelectorAll('.cit-views-toggle button').forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-view') === view);
    });
    if (_citLastResult) {
        _citRenderPanel('cit-agent-body', 'agent', _citLastResult, view);
        _citRenderPanel('cit-human-body', 'human', _citLastResult, view);
    }
}

function _citRenderResult(result) {
    _citLastResult = result;
    const card = _q('cit-score-card');
    const value = _q('cit-score-value');
    const verdict = _q('cit-verdict');
    const headline = _q('cit-headline');
    const sub = _q('cit-sub');

    if (card) {
        card.classList.remove(
            'cit-score-card--excellent',
            'cit-score-card--good',
            'cit-score-card--partial',
            'cit-score-card--critical',
        );
        card.classList.add(_citVerdictColorClass(result.verdict));
    }
    if (value) value.textContent = String(result.score ?? 0);
    if (verdict) verdict.textContent = result.verdict || '—';
    if (headline) {
        headline.innerHTML = _citHeadlineForScore(
            result.score ?? 0,
            result.agent?.words ?? 0,
            result.human?.words ?? 0,
        );
    }
    if (sub) {
        const bits = [];
        if (result.finalUrl) bits.push(`Scanned ${new URL(result.finalUrl).hostname}`);
        if (result.cached) bits.push('cached');
        sub.textContent = bits.join(' · ');
    }

    _citRenderFlags(result);
    _citApplyView(_citCurrentView);
    _citRenderDiff(result);

    _citShowState('result');
}

async function _citPopulateContext() {
    const ctxEl = _q('cit-context');
    if (!ctxEl) return;
    try {
        const tab = await _citGetActiveTab();
        if (!tab?.url || !/^https?:/i.test(tab.url)) {
            ctxEl.innerHTML = 'Open any <strong>public webpage</strong> and click <strong>Scan this page</strong>.';
            const btn = _q('cit-scan-btn');
            if (btn) btn.disabled = true;
            return;
        }
        const btn = _q('cit-scan-btn');
        if (btn) btn.disabled = false;
        ctxEl.innerHTML = `Scanning <strong>${_citEscape(tab.url)}</strong>`;
    } catch (_) {
        ctxEl.textContent = 'Open a webpage to scan.';
    }
}

async function runCitabilityScan() {
    _citShowState('loading');
    const loadingText = _q('cit-loading-text');
    try {
        const tab = await _citGetActiveTab();
        if (!tab?.url || !/^https?:/i.test(tab.url)) {
            _citSetError('Open a regular http(s) webpage to scan it.');
            return;
        }
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            _citSetError('Browser-internal pages can\'t be scanned.');
            return;
        }

        if (loadingText) loadingText.textContent = 'Reading the live page in your browser…';
        let humanView = null;
        try {
            humanView = await _citCaptureHumanView(tab.id);
        } catch (e) {
            console.warn('[citability] human view capture failed', e);
        }

        if (loadingText) loadingText.textContent = 'Asking GPTBot what it sees…';

        const token = await getExtTokenFromStorage();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const resp = await fetch(`${API_BASE}/api/extension/citability`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ url: tab.url, humanView }),
        });

        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            _citSetError(
                `<strong>Server is still warming up.</strong> The AI Readability endpoint hasn't deployed yet (got HTTP ${resp.status}). Try again in ~1 minute.`,
                true,
            );
            return;
        }
        const j = await resp.json();
        if (resp.status === 429) {
            _citSetError(
                `<strong>Daily scan limit reached.</strong> ${_citEscape(j.error || 'Try again later.')} ${j.signedIn ? '' : 'Sign in to get a higher allowance.'}`,
                true,
            );
            return;
        }
        if (!resp.ok || !j.ok) {
            _citSetError(_citEscape(j.error || `Scan failed (HTTP ${resp.status}).`));
            return;
        }

        _citRenderResult(j.result);
        trackEventAsync('citability_scan', 'Extension', j.result?.verdict || 'ok');
    } catch (e) {
        console.error('[citability] scan failed', e);
        _citSetError(_citEscape(e?.message || 'Network error. Try again.'));
    }
}

function _citCopyReport() {
    if (!_citLastResult) return;
    const r = _citLastResult;
    const lines = [
        `AI Readability report — ${r.finalUrl || ''}`,
        `Score: ${r.score}/100 (${r.verdict})`,
        `Agent (no JS): ${r.agent?.words || 0} words · ${(r.agent?.headings || []).length} headings · schema: ${(r.agent?.schemaTypes || []).join(', ') || 'none'}`,
        `Human (rendered): ${r.human?.words || 0} words · ${(r.human?.headings || []).length} headings · schema: ${(r.human?.schemaTypes || []).join(', ') || 'none'}`,
    ];
    if (r.diff?.titleMismatch) lines.push(`Title differs between views: agent="${r.agent?.title || ''}" human="${r.human?.title || ''}"`);
    if (r.diff?.h1Missing) lines.push('H1 is missing in the agent view.');
    if (r.robots?.disallowed?.length) lines.push(`robots.txt disallows: ${r.robots.disallowed.join(', ')}`);
    if (r.cloaking?.detected) lines.push(`Cloaking detected: agent ${r.cloaking.agentBytes}B vs human ${r.cloaking.humanBytes}B (ratio ${r.cloaking.ratio}).`);
    if (r.diff?.hiddenHeadings?.length) {
        lines.push('');
        lines.push('Hidden headings:');
        r.diff.hiddenHeadings.forEach((h) => lines.push(`  - ${h.tag || 'h?'}: ${h.text}`));
    }
    if (r.diff?.hiddenSchema?.length) {
        lines.push('');
        lines.push(`Hidden schema types: ${r.diff.hiddenSchema.join(', ')}`);
    }
    if (r.diff?.hiddenBlocks?.length) {
        lines.push('');
        lines.push('Hidden text blocks (truncated):');
        r.diff.hiddenBlocks.slice(0, 20).forEach((b) => {
            const t = typeof b === 'string' ? b : b.text;
            lines.push(`  - ${String(t).slice(0, 180)}${String(t).length > 180 ? '…' : ''}`);
        });
    }
    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        const btn = _q('cit-copy-report-btn');
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1500);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    _citShowState('idle');
    _citPopulateContext();

    document.getElementById('cit-scan-btn')?.addEventListener('click', runCitabilityScan);
    document.getElementById('cit-rescan-btn')?.addEventListener('click', runCitabilityScan);
    document.getElementById('cit-copy-report-btn')?.addEventListener('click', _citCopyReport);

    document.querySelectorAll('.cit-views-toggle button').forEach((b) => {
        b.addEventListener('click', () => _citApplyView(b.getAttribute('data-view') || 'words'));
    });

    document.querySelectorAll('.tab-button[data-tab="citability"]').forEach((tabBtn) => {
        tabBtn.addEventListener('click', _citPopulateContext);
    });
});


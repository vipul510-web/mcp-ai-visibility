// Popup script for LLM Audit Chrome Extension

let currentTab = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;
        
        // Show current URL
        const urlElement = document.getElementById('current-url');
        if (urlElement && tab.url) {
            try {
                const urlObj = new URL(tab.url);
                urlElement.textContent = urlObj.hostname + urlObj.pathname;
            } catch {
                urlElement.textContent = tab.url.substring(0, 60) + '...';
            }
        }
        
        // Only audit http/https pages
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
            await runAudit();
        } else {
            showError('Cannot audit this page. Please navigate to a webpage (http/https).');
        }
        
    } catch (error) {
        console.error('Error initializing popup:', error);
        showError('Unable to initialize audit.');
    }
});

// Retry button
document.getElementById('retry-btn')?.addEventListener('click', async () => {
    await runAudit();
});

// Refresh button
document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    await runAudit();
});

// PDF Export button
document.getElementById('export-pdf-btn')?.addEventListener('click', async () => {
    await exportToPDF();
});

let currentAuditData = null;

// Run audit
async function runAudit() {
    showLoading();
    
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
            throw new Error(results.error);
        }
        
        displayResults(results);
        
    } catch (error) {
        console.error('Audit error:', error);
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
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'flex';
    document.getElementById('results-state').style.display = 'none';
    document.getElementById('error-message').textContent = message;
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
    document.getElementById('overall-score').textContent = overallScore;
    
    // Animate score ring
    const scoreProgress = document.getElementById('score-progress');
    if (scoreProgress) {
        const circumference = 2 * Math.PI * 45; // radius = 45
        const offset = circumference - (overallScore / 100) * circumference;
        scoreProgress.style.strokeDashoffset = offset;
    }
    
    // Update status
    const scoreStatus = document.getElementById('score-status');
    const scoreDescription = document.getElementById('score-description');
    
    if (overallScore >= 80) {
        scoreStatus.textContent = 'Excellent!';
        scoreStatus.className = 'score-status score-status--excellent';
        scoreDescription.textContent = 'Your page is well-optimized for LLMs.';
    } else if (overallScore >= 60) {
        scoreStatus.textContent = 'Good Start';
        scoreStatus.className = 'score-status score-status--good';
        scoreDescription.textContent = 'Some improvements needed for better LLM visibility.';
    } else {
        scoreStatus.textContent = 'Needs Improvement';
        scoreStatus.className = 'score-status score-status--poor';
        scoreDescription.textContent = 'Focus on the failing checks below to improve your score.';
    }
    
    // Display checks
    displayChecks(checks);
    
    // Update full audit link
    const fullAuditLink = document.getElementById('full-audit-link');
    if (fullAuditLink && currentTab && currentTab.url) {
        try {
            const urlObj = new URL(currentTab.url);
            fullAuditLink.href = `https://sellonllm.com/free-llm-audit.html?url=${encodeURIComponent(urlObj.origin)}`;
        } catch {}
    }
}

// Display individual checks
function displayChecks(checks) {
    const checksList = document.getElementById('checks-list');
    checksList.innerHTML = '';
    
    // Check order and labels
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
        { key: 'llm_txt_exists', label: 'LLM.txt File' },
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
        
        const checkItem = createCheckItem(key, label, check);
        checksList.appendChild(checkItem);
    });
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
            ${value.recommendation ? `<p style="margin-top: 4px;">${value.recommendation}</p>` : ''}
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
            { key: 'llm_txt_exists', label: 'LLM.txt File' },
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
        
    } catch (error) {
        console.error('PDF export error:', error);
        alert('Error generating PDF. Please try again or check your internet connection.');
    }
}


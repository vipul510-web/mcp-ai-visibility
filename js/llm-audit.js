// ===== LLM AUDIT TOOL =====
// Handles the free technical audit on the homepage

const auditForm = document.getElementById('llm-audit-form');
const auditResults = document.getElementById('audit-results');
const heroSection = document.querySelector('.hero');
const backToAuditBtn = document.getElementById('back-to-audit');

// Audit form submission
if (auditForm) {
    auditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const urlInput = document.getElementById('website-url');
        let websiteUrl = urlInput.value.trim();
        // Allow inputs like "example.com" or "www.example.com" by auto-prepending https://
        if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
            websiteUrl = `https://${websiteUrl}`;
            urlInput.value = websiteUrl; // reflect normalization for clarity
        }
        
        if (!websiteUrl) return;
        
        // Validate URL
        if (!isValidUrl(websiteUrl)) {
            alert('Please enter a valid URL (e.g., https://example.com)');
            return;
        }
        
        // Track audit start
        if (typeof gtag !== 'undefined') {
            gtag('event', 'audit_started', {
                event_category: 'LLM Audit',
                event_label: websiteUrl,
                value: 1
            });
        }
        
        // Show loading state
        const submitButton = auditForm.querySelector('button[type="submit"]');
        const buttonText = submitButton.querySelector('.button-text');
        const originalText = buttonText.textContent;
        
        buttonText.textContent = 'Analyzing Your Site...';
        submitButton.classList.add('button-loading');
        submitButton.disabled = true;
        
        try {
            // Run site-wide audit by default
            const results = await performAudit(websiteUrl, true);
            
            // Display site-wide results
            displaySiteWideResults(websiteUrl, results);
            
            // Hide hero, show results (only if hero exists, e.g., on homepage)
            if (heroSection) heroSection.style.display = 'none';
            if (auditResults) auditResults.style.display = 'block';
            
            // Scroll to results
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Track completion
            if (typeof gtag !== 'undefined') {
                gtag('event', 'audit_completed', {
                    event_category: 'LLM Audit',
                    event_label: websiteUrl,
                    value: 1
                });
            }
            
        } catch (error) {
            console.error('Audit error:', error);
            
            // Show user-friendly error notification
            showNotification(
                'Unable to analyze website. Please check the URL and try again. If the issue persists, contact support.',
                'error'
            );
            
            if (typeof gtag !== 'undefined') {
                gtag('event', 'audit_error', {
                    event_category: 'LLM Audit',
                    event_label: websiteUrl,
                    error_message: error.message,
                    value: 1
                });
            }
        } finally {
            // Reset button
            buttonText.textContent = originalText;
            submitButton.classList.remove('button-loading');
            submitButton.disabled = false;
        }
    });
}

// Back to audit button
if (backToAuditBtn) {
    backToAuditBtn.addEventListener('click', () => {
        if (auditResults) auditResults.style.display = 'none';
        if (heroSection) heroSection.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        if (typeof gtag !== 'undefined') {
            gtag('event', 'new_audit_clicked', {
                event_category: 'LLM Audit',
                value: 1
            });
        }
    });
}

// Perform the audit (site-wide by default)
async function performAudit(url, isSiteWide = true) {
    const API_ENDPOINT = isSiteWide ? '/api/audit-site' : '/api/audit';
    
    // Try multiple attempts with different strategies
    const attempts = [
        // Try relative path first
        { endpoint: API_ENDPOINT, description: 'relative path' },
        // Try with current origin if relative fails
        { endpoint: `${window.location.origin}${API_ENDPOINT}`, description: 'absolute path' },
        // Try with www prefix if non-www
        { endpoint: `${window.location.protocol}//www.${window.location.host}${API_ENDPOINT}`, description: 'www subdomain' }
    ];
    
    for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        try {
            console.log(`Attempt ${i + 1}: Trying ${attempt.description} - ${attempt.endpoint}`);
            
            // Show retry notification for subsequent attempts
            if (i > 0) {
                showNotification(`Retrying connection... (${i + 1}/${attempts.length})`, 'warning');
            }
            
            const response = await fetch(attempt.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    url,
                    maxPages: isSiteWide ? 50 : 1
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Success with ${attempt.description}`);
            return data;
            
        } catch (error) {
            console.error(`Attempt ${i + 1} failed (${attempt.description}):`, error);
            
            // If this is the last attempt, throw the error
            if (i === attempts.length - 1) {
                const errorMessage = error.message.includes('Failed to fetch') || error.message.includes('ERR_HTTP2_PING_FAILED') 
                    ? 'Network connection issue. Please check your internet connection and try again.'
                    : `Audit API failed: ${error.message}`;
                throw new Error(errorMessage);
            }
            
            // Wait a bit before next attempt
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Note: All audit logic now handled by backend APIs
// Backend generates both checks and details - no client-side processing needed

// Display audit results
function displayResults(url, data) {
    const { checks, details } = data;
    
    // Set URL
    document.getElementById('audited-url').textContent = url;
    
    // Calculate score
    const passedChecks = Object.values(checks).filter(v => v === true).length;
    const totalChecks = Object.keys(checks).length;
    
    // Animate score
    animateScore(passedChecks, totalChecks);
    
    // Set score status
    const scoreStatus = document.getElementById('score-status');
    if (passedChecks >= 7) {
        scoreStatus.textContent = 'Excellent! Your site is well-optimized for LLM discovery.';
        scoreStatus.style.color = 'var(--success-color)';
    } else if (passedChecks >= 5) {
        scoreStatus.textContent = 'Good start! A few improvements will boost your LLM visibility.';
        scoreStatus.style.color = 'var(--accent-color)';
    } else {
        scoreStatus.textContent = 'Needs work. Significant opportunities to improve LLM readiness.';
        scoreStatus.style.color = 'var(--danger-color)';
    }
    
    // Update individual checks
    updateCheckResult('llm-txt', checks.llm_txt_exists, details.llm_txt_exists);
    updateCheckResult('robots-txt', checks.robots_txt_proper, details.robots_txt_proper);
    updateCheckResult('sitemap', checks.sitemap_exists, details.sitemap_exists);
    updateCheckResult('meta-titles', checks.meta_titles_present, details.meta_titles_present);
    updateCheckResult('meta-descriptions', checks.meta_descriptions_present, details.meta_descriptions_present);
    updateCheckResult('structured-data', checks.structured_data_basic, details.structured_data_basic);
    updateCheckResult('ssl', checks.ssl_enabled, details.ssl_enabled);
    updateCheckResult('mobile-friendly', checks.mobile_friendly, details.mobile_friendly);
}

// Animate the circular score
function animateScore(passed, total) {
    const scoreElement = document.getElementById('overall-score');
    const progressCircle = document.getElementById('score-progress');
    const circumference = 2 * Math.PI * 70; // radius is 70
    
    let currentScore = 0;
    const duration = 1500;
    const steps = 60;
    const increment = passed / steps;
    const stepDuration = duration / steps;
    
    const interval = setInterval(() => {
        currentScore += increment;
        if (currentScore >= passed) {
            currentScore = passed;
            clearInterval(interval);
        }
        
        scoreElement.textContent = Math.round(currentScore);
        
        const percentage = (currentScore / total) * 100;
        const offset = circumference - (percentage / 100) * circumference;
        progressCircle.style.strokeDashoffset = offset;
    }, stepDuration);
}

// Update individual check result
function updateCheckResult(checkId, passed, detail) {
    const checkElement = document.getElementById(`check-${checkId}`);
    const statusElement = checkElement.querySelector('.check-result__status');
    const detailsElement = checkElement.querySelector('.check-result__details');
    
    // Set status class
    checkElement.classList.remove('pass', 'fail', 'warning');
    checkElement.classList.add(passed ? 'pass' : 'fail');
    
    // Set status text
    statusElement.textContent = passed ? 'PASS' : 'FAIL';
    
    // Set details
    detailsElement.innerHTML = `
        <p><strong>${detail.message}</strong></p>
        <p>${detail.recommendation}</p>
    `;
    
    // Add click to expand
    checkElement.querySelector('.check-result__header').addEventListener('click', () => {
        const isOpen = detailsElement.style.display === 'block';
        detailsElement.style.display = isOpen ? 'none' : 'block';
    });
}

// Helper: Validate URL
function isValidUrl(string) {
    try {
        // If protocol is missing, assume https for validation
        const normalized = /^https?:\/\//i.test(string) ? string : `https://${string}`;
        const url = new URL(normalized);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// Helper: Normalize URL
function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        return `${urlObj.protocol}//${urlObj.hostname}`;
    } catch (_) {
        return url;
    }
}

// Show notification to user
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.getElementById('audit-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'audit-notification';
    notification.className = `notification notification--${type}`;
    notification.innerHTML = `
        <div class="notification__content">
            <span class="notification__message">${message}</span>
            <button class="notification__close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Store current audit data for PDF export (global scope)
window.currentAuditData = null;

// Display site-wide audit results
function displaySiteWideResults(url, data) {
    // Store audit data for PDF export
    window.currentAuditData = { url, data };
    
    const auditedUrlSpan = document.getElementById('audited-url');
    let overallScoreSpan = document.getElementById('overall-score');
    let scoreProgressCircle = document.getElementById('score-progress');
    let scoreStatusP = document.getElementById('score-status');
    const auditResultsSection = document.getElementById('audit-results');
    const auditResultsContainer = auditResultsSection ? auditResultsSection.querySelector('.container') : null;
    const header = auditResultsContainer ? auditResultsContainer.querySelector('.audit-results__header') : null;
    
    // If score header elements are missing, create a minimal header block so we don't crash
    if ((!overallScoreSpan || !scoreProgressCircle || !scoreStatusP) && header) {
        const scoreBlock = document.createElement('div');
        scoreBlock.className = 'audit-results__score';
        scoreBlock.innerHTML = `
            <div class="score-ring" style="display:inline-flex; align-items:center; gap:.75rem;">
                
                <div class="score-meta" style="display:flex; flex-direction:column;">
                    <div style="font-size:2rem; font-weight:800; line-height:1;">
                        <span id="overall-score">0</span><span style="font-size:1rem; color:#94a3b8;">/100</span>
                    </div>
                    <p id="score-status" class="score-status" style="margin:.25rem 0 0; color:#64748b;">Analyzing…</p>
                </div>
            </div>
        `;
        header.appendChild(scoreBlock);
        // Re-query after injecting
        overallScoreSpan = document.getElementById('overall-score');
        scoreProgressCircle = document.getElementById('score-progress');
        scoreStatusP = document.getElementById('score-status');
    }
    
    // Update header
    if (auditedUrlSpan) auditedUrlSpan.textContent = url;

    // Ensure results skeleton exists on pages that don't ship the full markup (e.g., free-llm-audit.html)
    (function ensureResultsSkeletonExists() {
        if (!auditResultsSection || !auditResultsContainer) return;
        const existingAnyCheck = auditResultsSection.querySelector('.check-result');
        if (existingAnyCheck) return; // already present

        const checksWrapper = document.createElement('div');
        checksWrapper.className = 'audit-results__checks';
        checksWrapper.id = 'audit-results-checks';

        const checkItems = [
            { id: 'check-llm-txt', label: 'LLM.txt' },
            { id: 'check-robots-txt', label: 'robots.txt' },
            { id: 'check-sitemap', label: 'sitemap.xml' },
            { id: 'check-meta-titles', label: 'Meta Titles' },
            { id: 'check-meta-descriptions', label: 'Meta Descriptions' },
            { id: 'check-structured-data', label: 'Structured Data' },
            { id: 'check-content-quality', label: 'Content Quality' },
            { id: 'check-image-optimization', label: 'Image Optimization' },
            { id: 'check-mobile-friendly', label: 'Mobile Friendly' },
            { id: 'check-open-graph', label: 'Open Graph' },
            { id: 'check-twitter-cards', label: 'Twitter Cards' },
            { id: 'check-ssl', label: 'SSL / HTTPS' }
        ];

        const itemHtml = (id, label) => `
            <div class="check-result" id="${id}">
                <div class="check-result__header" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:.5rem;">
                        <span class="check-result__icon" aria-hidden="true"></span>
                        <span class="check-result__title">${label}</span>
                    </div>
                    <span class="check-result__status">—</span>
                </div>
                <div class="check-result__details" style="display:none; margin-top:.5rem;"></div>
            </div>`;

        checksWrapper.innerHTML = `
            <div class="checks-grid">
                ${checkItems.map(ci => itemHtml(ci.id, ci.label)).join('')}
            </div>
        `;

        auditResultsContainer.appendChild(checksWrapper);
    })();
    
    // Calculate overall score from summary
    const summary = data.summary || data;
    const totalChecks = Object.keys(summary.checks || {}).length;
    
    // Calculate average percentage across all checks
    const checkPercentages = Object.values(summary.checks || {}).map(check => check.percentage || 0);
    const overallScore = checkPercentages.length > 0 ? 
        Math.round(checkPercentages.reduce((sum, pct) => sum + pct, 0) / checkPercentages.length) : 0;
    
    // Update score display
    if (overallScoreSpan) overallScoreSpan.textContent = overallScore;
    
    // Animate score circle
    if (scoreProgressCircle) {
        const circumference = 2 * Math.PI * 70; // radius = 70
        const offset = circumference - (overallScore / 100) * circumference;
        scoreProgressCircle.style.strokeDashoffset = offset;
    }
    
    // Update status text
    if (scoreStatusP) {
        if (overallScore >= 80) {
            scoreStatusP.textContent = 'Excellent! Your site is well-optimized for LLMs.';
            scoreStatusP.className = 'score-status score-status--excellent';
        } else if (overallScore >= 60) {
            scoreStatusP.textContent = 'Good start! Some improvements needed for better LLM visibility.';
            scoreStatusP.className = 'score-status score-status--good';
        } else {
            scoreStatusP.textContent = 'Needs improvement. Focus on the failing checks below.';
            scoreStatusP.className = 'score-status score-status--poor';
        }
    }
    
    // Update individual checks with site-wide data
    updateSiteWideCheckResults(summary.checks || {});
    
    // Show pages breakdown if available
    if (data.pages && data.pages.length > 0) {
        displayPagesBreakdown(data.pages);
    }
}

function updateSiteWideCheckResults(checks) {
    const checkMappings = {
        'llm_txt_exists': 'check-llm-txt',
        'robots_txt_proper': 'check-robots-txt',
        'sitemap_exists': 'check-sitemap',
        'ssl_enabled': 'check-ssl',
        'meta_titles_present': 'check-meta-titles',
        'meta_descriptions_present': 'check-meta-descriptions',
        'content_quality': 'check-content-quality',
        'structured_data_basic': 'check-structured-data',
        'mobile_friendly': 'check-mobile-friendly',
        'open_graph_tags': 'check-open-graph',
        'twitter_cards': 'check-twitter-cards',
        'image_optimization': 'check-image-optimization'
    };
    
    Object.entries(checkMappings).forEach(([checkKey, elementId]) => {
        const checkElement = document.getElementById(elementId);
        if (!checkElement || !checks[checkKey]) return;
        
        const check = checks[checkKey];
        const icon = checkElement.querySelector('.check-result__icon');
        const status = checkElement.querySelector('.check-result__status');
        const details = checkElement.querySelector('.check-result__details');
        
        // Update icon and status
        if (check.percentage >= 80) {
            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            status.textContent = 'PASS';
            status.className = 'check-result__status check-result__status--pass';
        } else if (check.percentage >= 50) {
            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
            status.textContent = 'WARN';
            status.className = 'check-result__status check-result__status--warn';
        } else {
            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
            status.textContent = 'FAIL';
            status.className = 'check-result__status check-result__status--fail';
        }
        
        // Update details with site-wide info and missing items
        let detailsHTML = `
            <div class="check-summary">
                <p><strong>Site-wide Coverage:</strong> ${check.passed}/${check.total} pages (${check.percentage}%)</p>
        `;
        
        // Show missing pages for meta tags and descriptions
        if ((checkKey === 'meta_titles_present' || checkKey === 'meta_descriptions_present') && check.missingPages && check.missingPages.length > 0) {
            detailsHTML += `
                <div class="missing-pages">
                    <p><strong>Pages Missing ${checkKey === 'meta_titles_present' ? 'Meta Titles' : 'Meta Descriptions'}:</strong></p>
                    <ul>
                        ${check.missingPages.map(url => `<li><a href="${url}" target="_blank">${url}</a></li>`).join('')}
                    </ul>
                    ${check.missingPages.length >= 10 ? '<p><em>... and more pages</em></p>' : ''}
                </div>
            `;
        }
        
        // Show file generation for site-level files
        if ((checkKey === 'llm_txt_exists' || checkKey === 'robots_txt_proper' || checkKey === 'sitemap_exists') && !check.passed) {
            const fileName = checkKey === 'llm_txt_exists' ? 'llm.txt' : 
                           checkKey === 'robots_txt_proper' ? 'robots.txt' : 'sitemap.xml';
            
            detailsHTML += `
                <div class="file-generator">
                    <p><strong>Missing ${fileName.toUpperCase()} file</strong></p>
                    <p>We can generate a ${fileName} file for your site.</p>
                    <button class="generate-file-btn" onclick="generateFile('${fileName}', '${checkKey}')">
                        📁 Generate ${fileName}
                    </button>
                </div>
            `;
        }
        
        // Add detailed content quality breakdown
        if (checkKey === 'content_quality' && check.value) {
            const contentChecks = check.value.checks || {};
            
            detailsHTML += `
                <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
                    <p style="margin: 0; font-weight: 600; color: #1e40af;">📊 Site-Wide Content Quality Analysis</p>
                    <p style="margin: 0.5rem 0 0 0; color: #64748b; font-size: 0.9rem;">
                        Overall Score: ${check.value.overallScore}% - ${check.value.summary}<br>
                        <strong>Analyzed Pages:</strong> ${check.pageData ? check.pageData.length : 0} pages
                    </p>
                </div>
            `;
            
            // Content Length - Site-wide analysis
            if (contentChecks.contentLength) {
                const statusColor = contentChecks.contentLength.score >= 80 ? '#22c55e' : 
                                  contentChecks.contentLength.score >= 60 ? '#f59e0b' : '#ef4444';
                
                // Calculate site-wide averages
                const avgWordCount = check.pageData ? 
                    Math.round(check.pageData.reduce((sum, page) => sum + page.wordCount, 0) / check.pageData.length) : 0;
                const pagesWithGoodContent = check.pageData ? 
                    check.pageData.filter(page => page.wordCount >= 300).length : 0;
                const pagesNeedingContent = check.pagesNeedingContent ? check.pagesNeedingContent.length : 0;
                
                detailsHTML += `
                    <div style="margin: 1rem 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #1e293b;">📝 Content Length</h5>
                        <div style="background: #f8fafc; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.75rem;">
                            <p style="margin: 0.25rem 0; color: #64748b;">
                                <strong>Site Average:</strong> ${avgWordCount} words per page
                                <span style="color: ${statusColor}; font-weight: 600;">(${contentChecks.contentLength.score}%)</span>
                            </p>
                            <p style="margin: 0.25rem 0; color: #64748b; font-size: 0.9rem;">
                                📊 ${pagesWithGoodContent}/${check.pageData ? check.pageData.length : 0} pages have 300+ words
                                ${pagesNeedingContent > 0 ? ` • ${pagesNeedingContent} pages need more content` : ''}
                            </p>
                        </div>
                        
                        ${check.pageData && check.pageData.length > 0 ? `
                            <details style="margin-top: 0.5rem;">
                                <summary style="cursor: pointer; font-weight: 600; color: #3b82f6; font-size: 0.9rem;">📋 View Page Details</summary>
                                <div style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; table-layout: auto;">
                                        <thead>
                                            <tr style="background: #f1f5f9;">
                                                <th style="padding: 0.4rem; text-align: left; border-bottom: 1px solid #e2e8f0;">Page</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Words</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${check.pageData.map(page => {
                                                const wordStatus = page.wordCount >= 300 ? 'good' : page.wordCount >= 150 ? 'warning' : 'poor';
                                                const wordColor = wordStatus === 'good' ? '#22c55e' : wordStatus === 'warning' ? '#f59e0b' : '#ef4444';
                                                const statusIcon = wordStatus === 'good' ? '✅' : wordStatus === 'warning' ? '⚠️' : '❌';
                                                
                                                return `
                                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                                        <td style="padding: 0.4rem; border-bottom: 1px solid #f1f5f9; word-break: break-all; max-width: 300px;">
                                                            <a href="${page.url}" target="_blank" style="color: #3b82f6; text-decoration: none;">
                                                                ${page.url}
                                                            </a>
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; color: ${wordColor}; font-weight: 600;">
                                                            ${page.wordCount}
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9;">
                                                            ${statusIcon}
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        ` : ''}
                        
                        ${contentChecks.contentLength.recommendation ? `
                            <p style="margin: 0.5rem 0 0 0; color: #ef4444; font-size: 0.9rem;">⚠️ ${contentChecks.contentLength.recommendation}</p>
                        ` : ''}
                    </div>
                `;
            }
            
            // FAQ Section - Site-wide analysis
            if (contentChecks.hasFaqSection) {
                const statusColor = contentChecks.hasFaqSection.score >= 80 ? '#22c55e' : 
                                  contentChecks.hasFaqSection.score >= 60 ? '#f59e0b' : 
                                  contentChecks.hasFaqSection.score >= 40 ? '#f59e0b' : '#ef4444';
                const statusText = contentChecks.hasFaqSection.score >= 80 ? 'Excellent' :
                                 contentChecks.hasFaqSection.score >= 60 ? 'Good' :
                                 contentChecks.hasFaqSection.score >= 40 ? 'Fair' : 'Poor';
                
                // Calculate site-wide FAQ statistics
                const pagesWithFaq = check.pageData ? 
                    check.pageData.filter(page => page.hasFaqSection).length : 0;
                const pagesNeedingFaq = check.pagesNeedingFaq ? check.pagesNeedingFaq.length : 0;
                
                detailsHTML += `
                    <div style="margin: 1rem 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #1e293b;">❓ FAQ Section</h5>
                        <div style="background: #f8fafc; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.75rem;">
                            <p style="margin: 0.25rem 0; color: #64748b;">
                                <strong>Site Status:</strong> ${contentChecks.hasFaqSection.hasFaq ? 'Found' : 'Not Found'} 
                                <span style="color: ${statusColor}; font-weight: 600;">(${contentChecks.hasFaqSection.score}% - ${statusText})</span>
                            </p>
                            <p style="margin: 0.25rem 0; color: #64748b; font-size: 0.9rem;">
                                📊 ${pagesWithFaq}/${check.pageData ? check.pageData.length : 0} pages have FAQ sections
                                ${pagesNeedingFaq > 0 ? ` • ${pagesNeedingFaq} pages need FAQ sections` : ''}
                            </p>
                        </div>
                        
                        
                        
                        ${check.pageData && check.pageData.length > 0 ? `
                            <details style="margin-top: 0.5rem;">
                                <summary style="cursor: pointer; font-weight: 600; color: #3b82f6; font-size: 0.9rem;">📋 View Page Details</summary>
                                <div style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; table-layout: auto;">
                                        <thead>
                                            <tr style="background: #f1f5f9;">
                                                <th style="padding: 0.4rem; text-align: left; border-bottom: 1px solid #e2e8f0;">Page</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">FAQ</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${check.pageData.map(page => {
                                                const faqIcon = page.hasFaqSection ? '✅' : '❌';
                                                const faqColor = page.hasFaqSection ? '#22c55e' : '#ef4444';
                                                
                                                return `
                                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                                        <td style="padding: 0.4rem; border-bottom: 1px solid #f1f5f9; word-break: break-all; max-width: 300px;">
                                                            <a href="${page.url}" target="_blank" style="color: #3b82f6; text-decoration: none;">
                                                                ${page.url}
                                                            </a>
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; color: ${faqColor}; font-weight: 600;">
                                                            ${faqIcon}
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9;">
                                                            ${page.hasFaqSection ? '✅ Found' : '❌ Missing'}
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        ` : ''}
                        
                        ${contentChecks.hasFaqSection.recommendation ? `
                            <p style="margin: 0.5rem 0 0 0; color: #ef4444; font-size: 0.9rem;">💡 ${contentChecks.hasFaqSection.recommendation}</p>
                        ` : ''}
                    </div>
                `;
            }
            
            // Heading Structure - Site-wide analysis
            if (contentChecks.headingStructure) {
                const statusColor = contentChecks.headingStructure.score >= 70 ? '#22c55e' : '#f59e0b';
                
                // Calculate site-wide heading statistics
                const avgH1 = check.pageData ? 
                    Math.round(check.pageData.reduce((sum, page) => sum + page.headingCount.h1, 0) / check.pageData.length) : 0;
                const avgH2 = check.pageData ? 
                    Math.round(check.pageData.reduce((sum, page) => sum + page.headingCount.h2, 0) / check.pageData.length) : 0;
                const avgH3 = check.pageData ? 
                    Math.round(check.pageData.reduce((sum, page) => sum + page.headingCount.h3, 0) / check.pageData.length) : 0;
                const avgH4 = check.pageData ? 
                    Math.round(check.pageData.reduce((sum, page) => sum + page.headingCount.h4, 0) / check.pageData.length) : 0;
                const pagesWithProperStructure = check.pageData ? 
                    check.pageData.filter(page => page.headingCount.h1 > 0 && page.headingCount.h2 > 0).length : 0;
                
                detailsHTML += `
                    <div style="margin: 1rem 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #1e293b;">📁 Heading Structure</h5>
                        <div style="background: #f8fafc; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.75rem;">
                            <p style="margin: 0.25rem 0; color: #64748b;">
                                <strong>Site Averages:</strong> H1: ${avgH1} | H2: ${avgH2} | H3: ${avgH3} | H4: ${avgH4}
                                <span style="color: ${statusColor}; font-weight: 600;">(${contentChecks.headingStructure.score}%)</span>
                            </p>
                            <p style="margin: 0.25rem 0; color: #64748b; font-size: 0.9rem;">
                                📊 ${pagesWithProperStructure}/${check.pageData ? check.pageData.length : 0} pages have proper H1→H2 structure
                            </p>
                        </div>
                        
                        ${check.pageData && check.pageData.length > 0 ? `
                            <details style="margin-top: 0.5rem;">
                                <summary style="cursor: pointer; font-weight: 600; color: #3b82f6; font-size: 0.9rem;">📋 View Page Details</summary>
                                <div style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; table-layout: auto;">
                                        <thead>
                                            <tr style="background: #f1f5f9;">
                                                <th style="padding: 0.4rem; text-align: left; border-bottom: 1px solid #e2e8f0;">Page</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">H1</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">H2</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">H3</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">H4</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${check.pageData.map(page => {
                                                const hasStructure = page.headingCount.h1 > 0 && page.headingCount.h2 > 0;
                                                const headingScore = Math.min(100, page.headingScore || 0);
                                                const scoreColor = headingScore >= 70 ? '#22c55e' : '#f59e0b';
                                                const structureIcon = hasStructure ? '✅' : '❌';
                                                
                                                return `
                                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                                        <td style="padding: 0.4rem; border-bottom: 1px solid #f1f5f9; word-break: break-all; max-width: 300px;">
                                                            <a href="${page.url}" target="_blank" style="color: #3b82f6; text-decoration: none;">
                                                                ${page.url}
                                                            </a>
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
                                                            ${page.headingCount.h1}
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
                                                            ${page.headingCount.h2}
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
                                                            ${page.headingCount.h3}
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
                                                            ${page.headingCount.h4}
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; color: ${scoreColor}; font-weight: 600;">
                                                            ${headingScore}% ${structureIcon}
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        ` : ''}
                        
                        ${contentChecks.headingStructure.recommendation ? `
                            <p style="margin: 0.5rem 0 0 0; color: #ef4444; font-size: 0.9rem;">⚠️ ${contentChecks.headingStructure.recommendation}</p>
                        ` : ''}
                    </div>
                `;
            }
            
            // Content Freshness - Site-wide analysis
            if (contentChecks.contentFreshness) {
                const statusColor = contentChecks.contentFreshness.score >= 80 ? '#22c55e' : 
                                  contentChecks.contentFreshness.score >= 60 ? '#f59e0b' : '#ef4444';
                
                // Calculate site-wide freshness statistics
                const avgFreshnessScore = check.pageData ? 
                    Math.round(check.pageData.reduce((sum, page) => sum + (page.freshnessScore || 50), 0) / check.pageData.length) : 0;
                const pagesWithDates = check.pageData ? 
                    check.pageData.filter(page => page.freshnessScore >= 60).length : 0;
                
                detailsHTML += `
                    <div style="margin: 1rem 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #1e293b;">🕒 Content Freshness</h5>
                        <div style="background: #f8fafc; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.75rem;">
                            <p style="margin: 0.25rem 0; color: #64748b;">
                                <strong>Site Average:</strong> ${contentChecks.contentFreshness.status}
                                <span style="color: ${statusColor}; font-weight: 600;">(${contentChecks.contentFreshness.score}%)</span>
                            </p>
                            <p style="margin: 0.25rem 0; color: #64748b; font-size: 0.9rem;">
                                📊 ${pagesWithDates}/${check.pageData ? check.pageData.length : 0} pages have publish/update dates
                            </p>
                        </div>
                        
                        ${check.pageData && check.pageData.length > 0 ? `
                            <details style="margin-top: 0.5rem;">
                                <summary style="cursor: pointer; font-weight: 600; color: #3b82f6; font-size: 0.9rem;">📋 View Page Details</summary>
                                <div style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; table-layout: auto;">
                                        <thead>
                                            <tr style="background: #f1f5f9;">
                                                <th style="padding: 0.4rem; text-align: left; border-bottom: 1px solid #e2e8f0;">Page</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Score</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${check.pageData.map(page => {
                                                const freshnessScore = Math.min(100, page.freshnessScore || 50);
                                                const scoreColor = freshnessScore >= 80 ? '#22c55e' : freshnessScore >= 60 ? '#f59e0b' : '#ef4444';
                                                const statusIcon = freshnessScore >= 80 ? '✅' : freshnessScore >= 60 ? '⚠️' : '❌';
                                                const statusText = freshnessScore >= 80 ? 'Fresh' : freshnessScore >= 60 ? 'Fair' : 'Unknown';
                                                
                                                return `
                                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                                        <td style="padding: 0.4rem; border-bottom: 1px solid #f1f5f9; word-break: break-all; max-width: 300px;">
                                                            <a href="${page.url}" target="_blank" style="color: #3b82f6; text-decoration: none;">
                                                                ${page.url}
                                                            </a>
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; color: ${scoreColor}; font-weight: 600;">
                                                            ${freshnessScore}%
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9;">
                                                            ${statusIcon} ${statusText}
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        ` : ''}
                        
                        ${contentChecks.contentFreshness.recommendation ? `
                            <p style="margin: 0.5rem 0 0 0; color: #ef4444; font-size: 0.9rem;">⚠️ ${contentChecks.contentFreshness.recommendation}</p>
                        ` : ''}
                    </div>
                `;
            }
            
            // Internal Linking - Site-wide analysis
            if (contentChecks.internalLinking) {
                const statusColor = contentChecks.internalLinking.score >= 70 ? '#22c55e' : '#f59e0b';
                
                // Calculate site-wide linking statistics
                const avgInternalLinks = check.pageData ? 
                    Math.round(check.pageData.reduce((sum, page) => sum + page.internalLinks, 0) / check.pageData.length) : 0;
                const totalInternalLinks = check.pageData ? 
                    check.pageData.reduce((sum, page) => sum + page.internalLinks, 0) : 0;
                const pagesWithGoodLinking = check.pageData ? 
                    check.pageData.filter(page => page.internalLinks >= 5).length : 0;
                
                detailsHTML += `
                    <div style="margin: 1rem 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #1e293b;">🔗 Internal Linking</h5>
                        <div style="background: #f8fafc; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.75rem;">
                            <p style="margin: 0.25rem 0; color: #64748b;">
                                <strong>Site Totals:</strong> ${totalInternalLinks} total links | ${avgInternalLinks} avg per page
                                <span style="color: ${statusColor}; font-weight: 600;">(${contentChecks.internalLinking.score}%)</span>
                            </p>
                            <p style="margin: 0.25rem 0; color: #64748b; font-size: 0.9rem;">
                                📊 ${pagesWithGoodLinking}/${check.pageData ? check.pageData.length : 0} pages have 5+ internal links
                            </p>
                        </div>
                        
                        ${check.pageData && check.pageData.length > 0 ? `
                            <details style="margin-top: 0.5rem;">
                                <summary style="cursor: pointer; font-weight: 600; color: #3b82f6; font-size: 0.9rem;">📋 View Page Details</summary>
                                <div style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; table-layout: auto;">
                                        <thead>
                                            <tr style="background: #f1f5f9;">
                                                <th style="padding: 0.4rem; text-align: left; border-bottom: 1px solid #e2e8f0;">Page</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Links</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Score</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${check.pageData.map(page => {
                                                const linkCount = page.internalLinks;
                                                const linkScore = Math.min(100, page.linkingScore || 0);
                                                const scoreColor = linkScore >= 70 ? '#22c55e' : linkScore >= 40 ? '#f59e0b' : '#ef4444';
                                                const statusIcon = linkCount >= 5 ? '✅' : linkCount >= 2 ? '⚠️' : '❌';
                                                const statusText = linkCount >= 5 ? 'Good' : linkCount >= 2 ? 'Fair' : 'Poor';
                                                
                                                return `
                                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                                        <td style="padding: 0.4rem; border-bottom: 1px solid #f1f5f9; word-break: break-all; max-width: 300px;">
                                                            <a href="${page.url}" target="_blank" style="color: #3b82f6; text-decoration: none;">
                                                                ${page.url}
                                                            </a>
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
                                                            ${linkCount}
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; color: ${scoreColor}; font-weight: 600;">
                                                            ${linkScore}%
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9;">
                                                            ${statusIcon} ${statusText}
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        ` : ''}
                        
                        ${contentChecks.internalLinking.recommendation ? `
                            <p style="margin: 0.5rem 0 0 0; color: #ef4444; font-size: 0.9rem;">⚠️ ${contentChecks.internalLinking.recommendation}</p>
                        ` : ''}
                    </div>
                `;
            }
            
            // Image Optimization - Site-wide analysis
            if (contentChecks.imageOptimization) {
                const statusColor = contentChecks.imageOptimization.score >= 80 ? '#22c55e' : 
                                  contentChecks.imageOptimization.score >= 50 ? '#f59e0b' : '#ef4444';
                
                // Calculate site-wide image statistics
                const totalImages = check.pageData ? 
                    check.pageData.reduce((sum, page) => sum + page.totalImages, 0) : 0;
                const totalImagesWithAlt = check.pageData ? 
                    check.pageData.reduce((sum, page) => sum + page.imagesWithAlt, 0) : 0;
                const avgImageScore = check.pageData ? 
                    Math.round(check.pageData.reduce((sum, page) => sum + (page.imageScore || 0), 0) / check.pageData.length) : 0;
                const pagesWithGoodImages = check.pageData ? 
                    check.pageData.filter(page => page.imageScore >= 80).length : 0;
                
                detailsHTML += `
                    <div style="margin: 1rem 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #1e293b;">🖼️ Image Optimization</h5>
                        <div style="background: #f8fafc; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.75rem;">
                            <p style="margin: 0.25rem 0; color: #64748b;">
                                <strong>Site Totals:</strong> ${totalImagesWithAlt}/${totalImages} images have alt tags
                                <span style="color: ${statusColor}; font-weight: 600;">(${contentChecks.imageOptimization.score}%)</span>
                            </p>
                            <p style="margin: 0.25rem 0; color: #64748b; font-size: 0.9rem;">
                                📊 ${pagesWithGoodImages}/${check.pageData ? check.pageData.length : 0} pages have 80%+ alt tag coverage
                            </p>
                        </div>
                        
                        ${check.pageData && check.pageData.length > 0 ? `
                            <details style="margin-top: 0.5rem;">
                                <summary style="cursor: pointer; font-weight: 600; color: #3b82f6; font-size: 0.9rem;">📋 View Page Details</summary>
                                <div style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; table-layout: auto;">
                                        <thead>
                                            <tr style="background: #f1f5f9;">
                                                <th style="padding: 0.4rem; text-align: left; border-bottom: 1px solid #e2e8f0;">Page</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Alt/Total</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Score</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${check.pageData.map(page => {
                                                const altCount = page.imagesWithAlt;
                                                const totalCount = page.totalImages;
                                                const imageScore = Math.min(100, page.imageScore || 0);
                                                const scoreColor = imageScore >= 80 ? '#22c55e' : imageScore >= 50 ? '#f59e0b' : '#ef4444';
                                                const statusIcon = imageScore >= 80 ? '✅' : imageScore >= 50 ? '⚠️' : '❌';
                                                const statusText = imageScore >= 80 ? 'Good' : imageScore >= 50 ? 'Fair' : 'Poor';
                                                
                                                return `
                                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                                        <td style="padding: 0.4rem; border-bottom: 1px solid #f1f5f9; word-break: break-all; max-width: 300px;">
                                                            <a href="${page.url}" target="_blank" style="color: #3b82f6; text-decoration: none;">
                                                                ${page.url}
                                                            </a>
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
                                                            ${altCount}/${totalCount}
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; color: ${scoreColor}; font-weight: 600;">
                                                            ${imageScore}%
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9;">
                                                            ${statusIcon} ${statusText}
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        ` : ''}
                        
                        ${contentChecks.imageOptimization.recommendation ? `
                            <p style="margin: 0.5rem 0 0 0; color: #ef4444; font-size: 0.9rem;">⚠️ ${contentChecks.imageOptimization.recommendation}</p>
                        ` : ''}
                    </div>
                `;
            }
            
            // Readability - Site-wide analysis
            if (contentChecks.readability) {
                const statusColor = contentChecks.readability.score >= 70 ? '#22c55e' : '#f59e0b';
                
                // Calculate site-wide readability statistics
                const avgSentenceLength = check.pageData ? 
                    Math.round(check.pageData.reduce((sum, page) => sum + page.avgSentenceLength, 0) / check.pageData.length) : 0;
                const avgReadabilityScore = check.pageData ? 
                    Math.round(check.pageData.reduce((sum, page) => sum + (page.readabilityScore || 50), 0) / check.pageData.length) : 0;
                const pagesWithGoodReadability = check.pageData ? 
                    check.pageData.filter(page => page.readabilityScore >= 70).length : 0;
                
                detailsHTML += `
                    <div style="margin: 1rem 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #1e293b;">📖 Readability</h5>
                        <div style="background: #f8fafc; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.75rem;">
                            <p style="margin: 0.25rem 0; color: #64748b;">
                                <strong>Site Average:</strong> ${avgSentenceLength} words per sentence
                                <span style="color: ${statusColor}; font-weight: 600;">(${contentChecks.readability.score}%)</span>
                            </p>
                            <p style="margin: 0.25rem 0; color: #64748b; font-size: 0.9rem;">
                                📊 ${pagesWithGoodReadability}/${check.pageData ? check.pageData.length : 0} pages have good readability (≤20 words/sentence)
                            </p>
                        </div>
                        
                        ${check.pageData && check.pageData.length > 0 ? `
                            <details style="margin-top: 0.5rem;">
                                <summary style="cursor: pointer; font-weight: 600; color: #3b82f6; font-size: 0.9rem;">📋 View Page Details</summary>
                                <div style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; table-layout: auto;">
                                        <thead>
                                            <tr style="background: #f1f5f9;">
                                                <th style="padding: 0.4rem; text-align: left; border-bottom: 1px solid #e2e8f0;">Page</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Avg Words</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Score</th>
                                                <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #e2e8f0;">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${check.pageData.map(page => {
                                                const sentenceLength = page.avgSentenceLength;
                                                const readabilityScore = Math.min(100, page.readabilityScore || 50);
                                                const scoreColor = readabilityScore >= 70 ? '#22c55e' : readabilityScore >= 40 ? '#f59e0b' : '#ef4444';
                                                const statusIcon = sentenceLength <= 20 ? '✅' : sentenceLength <= 25 ? '⚠️' : '❌';
                                                const statusText = sentenceLength <= 20 ? 'Good' : sentenceLength <= 25 ? 'Fair' : 'Poor';
                                                
                                                return `
                                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                                        <td style="padding: 0.4rem; border-bottom: 1px solid #f1f5f9; word-break: break-all; max-width: 300px;">
                                                            <a href="${page.url}" target="_blank" style="color: #3b82f6; text-decoration: none;">
                                                                ${page.url}
                                                            </a>
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
                                                            ${sentenceLength}
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9; color: ${scoreColor}; font-weight: 600;">
                                                            ${readabilityScore}%
                                                        </td>
                                                        <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid #f1f5f9;">
                                                            ${statusIcon} ${statusText}
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        ` : ''}
                        
                        ${contentChecks.readability.recommendation ? `
                            <p style="margin: 0.5rem 0 0 0; color: #ef4444; font-size: 0.9rem;">⚠️ ${contentChecks.readability.recommendation}</p>
                        ` : ''}
                    </div>
                `;
            }
            
            // Summary of analyzed pages
            if (check.pageData && check.pageData.length > 0) {
                detailsHTML += `
                    <div style="margin: 1rem 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #1e293b;">📄 Analyzed Pages Summary</h5>
                        <p style="margin: 0; color: #64748b; font-size: 0.9rem;">
                            Analyzed ${check.pageData.length} pages across your website. 
                            Click "View Page Details" under each category above to see specific page breakdowns.
                        </p>
                        <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.25rem;">
                            ${check.pageData.slice(0, 10).map(page => `
                                <span style="background: #e2e8f0; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; color: #64748b;">
                                    ${page.url.replace(/^https?:\/\//, '').replace(/\/$/, '').substring(0, 40)}${page.url.length > 40 ? '...' : ''}
                                </span>
                            `).join('')}
                            ${check.pageData.length > 10 ? `<span style="color: #64748b; font-size: 0.8rem;">... and ${check.pageData.length - 10} more</span>` : ''}
                        </div>
                    </div>
                `;
            }
            
            // Pages Needing Improvement
            if (check.pagesNeedingContent && check.pagesNeedingContent.length > 0) {
                detailsHTML += `
                    <div style="margin: 1rem 0; padding: 1rem; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #dc2626;">⚠️ Pages Needing More Content (Under 300 words)</h5>
                        <ul style="margin: 0; padding-left: 1.5rem;">
                            ${check.pagesNeedingContent.slice(0, 5).map(page => 
                                `<li style="margin-bottom: 0.25rem; color: #dc2626;">
                                    <a href="${page.url}" target="_blank" style="color: #dc2626; text-decoration: none;">${page.url}</a> 
                                    (${page.wordCount} words)
                                </li>`
                            ).join('')}
                            ${check.pagesNeedingContent.length > 5 ? 
                                `<li style="color: #dc2626; font-style: italic;">... and ${check.pagesNeedingContent.length - 5} more pages</li>` : ''
                            }
                        </ul>
                    </div>
                `;
            }
            
            // Overall Recommendations
            if (check.value.recommendations && check.value.recommendations.length > 0) {
                detailsHTML += `
                    <div style="margin: 1rem 0; padding: 1rem; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #92400e;">💡 Recommendations for Better AI Visibility</h5>
                        <ul style="margin: 0; padding-left: 1.5rem;">
                            ${check.value.recommendations.map(rec => `<li style="margin-bottom: 0.25rem; color: #92400e;">${rec}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
        }
        
        // Add detailed structured data breakdown
        if (checkKey === 'structured_data_basic' && check.value) {
            // Show what was found with validation scores
            if (check.value.jsonLd && check.value.jsonLd.length > 0) {
                detailsHTML += `
                    <div class="found-schemas">
                        <p><strong>Schema Types Found:</strong></p>
                        <ul>
                            ${check.value.jsonLd.map(schema => {
                                const validation = schema.validation || {};
                                const score = validation.scorePercentage || 0;
                                const status = score >= 80 ? '✓ Excellent' : 
                                             score >= 60 ? '⚠ Good' : 
                                             score >= 40 ? '⚠ Needs Work' : '❌ Poor';
                                const statusColor = score >= 80 ? '#22c55e' : 
                                                  score >= 60 ? '#f59e0b' : 
                                                  score >= 40 ? '#f59e0b' : '#ef4444';
                                
                                return `
                                    <li>
                                        <strong>${schema.type}</strong> - ${schema.name}
                                        <span style="color: ${statusColor}; font-weight: 600;">${status} (${score}%)</span>
                                        ${validation.warnings && validation.warnings.length > 0 ? `
                                            <ul style="margin: 0.5rem 0; padding-left: 1rem; font-size: 0.9em; color: #f59e0b;">
                                                ${validation.warnings.map(warning => `<li>⚠ ${warning}</li>`).join('')}
                                            </ul>
                                        ` : ''}
                                        ${validation.missing && validation.missing.length > 0 ? `
                                            <ul style="margin: 0.5rem 0; padding-left: 1rem; font-size: 0.9em; color: #ef4444;">
                                                ${validation.missing.slice(0, 3).map(missing => `<li>❌ Missing: ${missing}</li>`).join('')}
                                                ${validation.missing.length > 3 ? `<li>... and ${validation.missing.length - 3} more</li>` : ''}
                                            </ul>
                                        ` : ''}
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    </div>
                `;
            } else if (check.value.typeCounts && Object.keys(check.value.typeCounts).length > 0) {
                detailsHTML += `
                    <div class="found-schemas">
                        <p><strong>Schema Types Found:</strong></p>
                        <ul>
                            ${Object.entries(check.value.typeCounts).map(([type, count]) => 
                                `<li><strong>${type}</strong>: ${count} item${count > 1 ? 's' : ''} found</li>`
                            ).join('')}
                        </ul>
                    </div>
                `;
            }
            
            // Show what's missing with detailed explanations
            if (check.value.missing && check.value.missing.length > 0) {
                const schemaGuidance = {
                    'Organization': {
                        why: 'AI needs to understand your business to recommend it in relevant searches',
                        where: 'Add to <head> section of every page (or homepage + footer)',
                        placement: 'Inside <head> tags, before closing </head>',
                        bestPractice: 'Place near the top of <head> for faster AI parsing',
                        whatYouHave: 'Company name, logo, contact info, address, social links',
                        howToAdd: 'Wrap existing content in JSON-LD structured data',
                        example: `<!-- Add this inside <head> section -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company Name",
  "url": "https://yoursite.com",
  "logo": "https://yoursite.com/logo.png",
  "description": "Your company description",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-555-123-4567",
    "contactType": "customer service"
  }
}</script>`
                    },
                    'WebSite': {
                        why: 'Helps AI understand your site structure and search capabilities',
                        where: 'Add to <head> section of your homepage only',
                        placement: 'Inside <head> tags, before closing </head>',
                        bestPractice: 'Place after Organization schema if both exist',
                        whatYouHave: 'Site name, URL, search functionality',
                        howToAdd: 'Use existing site information and search features',
                        example: `<!-- Add this inside <head> section of homepage -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Your Website",
  "url": "https://yoursite.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://yoursite.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}</script>`
                    },
                    'WebPage': {
                        why: 'Helps AI understand what each page is about and when it was created',
                        where: 'Add to <head> section of each individual page',
                        placement: 'Inside <head> tags, before closing </head>',
                        bestPractice: 'Place after WebSite schema on homepage',
                        whatYouHave: 'Page title, description, content, publish date',
                        howToAdd: 'Use existing meta tags and page content',
                        example: `<!-- Add this inside <head> section of each page -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page Title",
  "description": "Page description",
  "url": "https://yoursite.com/this-page",
  "datePublished": "2024-01-15",
  "dateModified": "2024-01-20"
}</script>`
                    },
                    'Article': {
                        why: 'Makes your blog posts discoverable in AI search results',
                        where: 'Add to <head> section of individual blog post pages',
                        placement: 'Inside <head> tags, before closing </head>',
                        bestPractice: 'Include mainEntityOfPage pointing to article URL',
                        whatYouHave: 'Headlines, content, author names, publish dates',
                        howToAdd: 'Extract from existing blog post elements',
                        example: `<!-- Add this inside <head> section of blog posts -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Article Title",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  },
  "datePublished": "2024-01-15",
  "description": "Article summary",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://yoursite.com/article-url"
  }
}</script>`
                    },
                    'Product': {
                        why: 'Helps AI recommend your products in shopping-related queries',
                        where: 'Add to <head> section of individual product pages',
                        placement: 'Inside <head> tags, before closing </head>',
                        bestPractice: 'Include GTIN/UPC codes and brand information',
                        whatYouHave: 'Product names, prices, descriptions, images',
                        howToAdd: 'Use existing product information from your store',
                        example: `<!-- Add this inside <head> section of product pages -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Product description",
  "image": "https://yoursite.com/product.jpg",
  "brand": {
    "@type": "Brand",
    "name": "Your Brand"
  },
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
}</script>`
                    },
                    'LocalBusiness': {
                        why: 'Makes your business appear in local AI searches',
                        where: 'Add to <head> section of homepage or contact page',
                        placement: 'Inside <head> tags, before closing </head>',
                        bestPractice: 'Include geo coordinates and opening hours',
                        whatYouHave: 'Business name, address, phone, hours, services',
                        howToAdd: 'Use information from your contact page',
                        example: `<!-- Add this inside <head> section -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Your Business",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "City",
    "addressRegion": "State",
    "postalCode": "12345"
  },
  "telephone": "+1-555-123-4567",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "40.7128",
    "longitude": "-74.0060"
  },
  "openingHours": "Mo-Fr 09:00-17:00"
}</script>`
                    }
                };
                
                detailsHTML += `
                    <div class="missing-items">
                        <p><strong>Missing Schema Types for Better AI Visibility:</strong></p>
                        <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
                            <p style="margin: 0; font-weight: 600; color: #1e40af;">💡 You likely already have this information on your website!</p>
                            <p style="margin: 0.5rem 0 0 0; color: #64748b; font-size: 0.9rem;">Schema markup just tells AI how to understand and categorize your existing content.</p>
                        </div>
                        ${check.value.missing.map(type => {
                            const guidance = schemaGuidance[type];
                            if (!guidance) {
                                console.warn(`No guidance found for schema type: ${type}`);
                                return '';
                            }
                            
                            // Escape HTML in the example code
                            const escapedExample = guidance.example
                                .replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/"/g, '&quot;')
                                .replace(/'/g, '&#39;');
                            
                            return `
                                <div style="margin: 1.5rem 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;">
                                    <h4 style="margin: 0 0 0.5rem 0; color: #1e293b; font-size: 1.1rem;">${type} Schema</h4>
                                    
                                    <div style="margin-bottom: 1rem;">
                                        <strong style="color: #1e293b;">🎯 Why add this?</strong>
                                        <p style="margin: 0.25rem 0; color: #64748b; font-size: 0.9rem;">${guidance.why}</p>
                                    </div>
                                    
                                    <div style="margin-bottom: 1rem;">
                                        <strong style="color: #1e293b;">📍 Where to add it?</strong>
                                        <p style="margin: 0.25rem 0; color: #64748b; font-size: 0.9rem;">${guidance.where}</p>
                                        <p style="margin: 0.25rem 0; color: #1e293b; font-size: 0.85rem; font-weight: 600;">📝 Exact placement: ${guidance.placement}</p>
                                        <p style="margin: 0.25rem 0; color: #1e293b; font-size: 0.85rem; font-weight: 600;">⚡ AI optimization: ${guidance.bestPractice}</p>
                                    </div>
                                    
                                    <div style="margin-bottom: 1rem;">
                                        <strong style="color: #1e293b;">📋 What you already have:</strong>
                                        <p style="margin: 0.25rem 0; color: #64748b; font-size: 0.9rem;">${guidance.whatYouHave}</p>
                                    </div>
                                    
                                    <div style="margin-bottom: 1rem;">
                                        <strong style="color: #1e293b;">🔧 How to implement:</strong>
                                        <p style="margin: 0.25rem 0; color: #64748b; font-size: 0.9rem;">${guidance.howToAdd}</p>
                                    </div>
                                    
                                    <details style="margin-top: 1rem;">
                                        <summary style="cursor: pointer; font-weight: 600; color: #1e293b;">📝 View Example Code</summary>
                                        <pre style="background: #f1f5f9; padding: 1rem; border-radius: 4px; overflow-x: auto; margin: 0.5rem 0; font-size: 0.8rem; border: 1px solid #cbd5e1; white-space: pre-wrap; font-family: 'Courier New', monospace;">${escapedExample}</pre>
                                    </details>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }
        }
        
        detailsHTML += `</div>`;
        details.innerHTML = detailsHTML;
        details.style.display = 'block';
    });
}

function displayPagesBreakdown(pages) {
    // Add pages breakdown section if it doesn't exist
    let breakdownSection = document.getElementById('pages-breakdown');
    if (!breakdownSection) {
        breakdownSection = document.createElement('div');
        breakdownSection.id = 'pages-breakdown';
        breakdownSection.className = 'pages-breakdown';
        breakdownSection.innerHTML = `
            <h3>Pages Analysis</h3>
            <div class="pages-list" id="pages-list"></div>
        `;
        
        const auditResults = document.getElementById('audit-results');
        const ctaSection = auditResults.querySelector('.audit-results__cta');
        
        // Insert before CTA if it exists, otherwise append to end
        if (ctaSection && ctaSection.parentNode === auditResults) {
            auditResults.insertBefore(breakdownSection, ctaSection);
        } else {
            auditResults.appendChild(breakdownSection);
        }
    }
    
    const pagesList = document.getElementById('pages-list');
    pagesList.innerHTML = '';
    
    pages.forEach(page => {
        if (page.status === 'success') {
            const pageElement = document.createElement('div');
            pageElement.className = 'page-item';
            
            const passedChecks = Object.values(page.checks || {}).filter(check => check.pass).length;
            const totalChecks = Object.keys(page.checks || {}).length;
            const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
            
            pageElement.innerHTML = `
                <div class="page-url">${page.url}</div>
                <div class="page-score score-${score >= 80 ? 'good' : score >= 50 ? 'warn' : 'poor'}">${score}%</div>
            `;
            
            pagesList.appendChild(pageElement);
        }
    });
}

// Generate missing files for users
function generateFile(fileName, checkKey) {
    const auditedUrl = document.getElementById('audited-url').textContent;
    const baseUrl = new URL(auditedUrl).origin;
    
    let fileContent = '';
    let mimeType = 'text/plain';
    
    switch (fileName) {
        case 'llm.txt':
            fileContent = generateLLMTxt(baseUrl);
            break;
        case 'robots.txt':
            fileContent = generateRobotsTxt(baseUrl);
            break;
        case 'sitemap.xml':
            fileContent = generateSitemap(baseUrl);
            mimeType = 'application/xml';
            break;
    }
    
    // Create and download the file
    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show success notification
    showNotification(`${fileName} generated and downloaded! Upload it to your website root directory.`, 'success');
}

function generateLLMTxt(baseUrl) {
    // Try to extract domain name for better branding
    const domainName = new URL(baseUrl).hostname.replace('www.', '');
    const siteName = domainName.charAt(0).toUpperCase() + domainName.slice(1).split('.')[0];
    
    return `# LLM.txt file for ${baseUrl}

This file provides structured information about our website for AI platforms like ChatGPT, Claude, and Perplexity.

## About ${siteName}
${siteName} is a website that provides valuable content and services. We aim to be a helpful resource for our users and the broader community.

## Contact Information
- Website: ${baseUrl}
- Email: [REPLACE: your-email@${domainName}]
- Company: [REPLACE: Your Company Name]

## Content Guidelines
- Our content is factual and helpful
- We aim to provide accurate, up-to-date information
- Feel free to cite our content with proper attribution
- Please link back to our website when referencing our information

## AI Usage Policy
We encourage AI platforms to:
- Cite our content when using it in responses
- Link back to our website when referencing our information
- Use our content to provide helpful answers to users
- Respect our content guidelines and attribution requirements

## Content Areas
Based on our site structure, we cover:
${generateContentAreas(baseUrl)}

## Last Updated
${new Date().toISOString().split('T')[0]}

---
This file follows the LLM.txt specification for AI platform communication.
For more information, visit: https://llmtxt.com/`;
}

function generateContentAreas(baseUrl) {
    // Get actual pages from audit results to suggest content areas
    const pagesSection = document.getElementById('pages-breakdown');
    let actualPages = [];
    
    if (pagesSection) {
        const pageItems = pagesSection.querySelectorAll('.page-url');
        actualPages = Array.from(pageItems).map(item => item.textContent.trim());
    }
    
    // Analyze pages to suggest content areas
    const contentAreas = [];
    actualPages.forEach(url => {
        const path = new URL(url).pathname.toLowerCase();
        if (path.includes('/blog') || path.includes('/news')) contentAreas.push('- Blog posts and articles');
        if (path.includes('/product') || path.includes('/shop')) contentAreas.push('- Product information');
        if (path.includes('/service')) contentAreas.push('- Service offerings');
        if (path.includes('/about')) contentAreas.push('- Company information');
        if (path.includes('/contact')) contentAreas.push('- Contact and support');
    });
    
    // Remove duplicates and return
    const uniqueAreas = [...new Set(contentAreas)];
    return uniqueAreas.length > 0 ? uniqueAreas.join('\n') : '- General website content';
}

function generateRobotsTxt(baseUrl) {
    return `# Robots.txt for ${baseUrl}

# Allow all AI crawlers
User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

# Allow all other crawlers
User-agent: *
Allow: /

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Optional: Block admin areas (uncomment if needed)
# Disallow: /admin/
# Disallow: /private/
# Disallow: /wp-admin/
# Disallow: /wp-login.php`;
}

function generateSitemap(baseUrl) {
    // Get actual pages from audit results
    const pagesSection = document.getElementById('pages-breakdown');
    let actualPages = [];
    
    if (pagesSection) {
        const pageItems = pagesSection.querySelectorAll('.page-url');
        actualPages = Array.from(pageItems).map(item => item.textContent.trim());
    }
    
    // If we have actual pages, use them; otherwise use defaults
    const urlsToInclude = actualPages.length > 1 ? actualPages : [
        `${baseUrl}/`,
        `${baseUrl}/about`,
        `${baseUrl}/contact`,
        `${baseUrl}/blog`
    ];
    
    const urlEntries = urlsToInclude.map((url, index) => {
        const priority = url === `${baseUrl}/` ? '1.0' : 
                        url.includes('/blog') ? '0.9' : 
                        url.includes('/about') ? '0.8' : '0.7';
        
        return `    <url>
        <loc>${url}</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>${url === `${baseUrl}/` ? 'weekly' : 'monthly'}</changefreq>
        <priority>${priority}</priority>
    </url>`;
    }).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

// All audit results now come from real backend APIs
// No demo/dummy data generation needed


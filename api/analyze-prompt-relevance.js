// Vercel Serverless Function to analyze content relevance for specific prompts
import { OpenAI } from 'openai';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url, prompts, apiKey } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
        return res.status(400).json({ error: 'At least one prompt is required' });
    }

    // Use user's API key if provided, otherwise fall back to server key (for backward compatibility)
    // IMPORTANT: User's API key is NEVER stored, logged, or saved. It's only used for this single request.
    const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
        return res.status(400).json({ 
            error: 'OpenAI API key required',
            message: 'Please provide an API key. Your key is used only for this request and never stored on our servers.'
        });
    }

    try {
        // Initialize OpenAI client with user's API key
        // The key is only used for this request and never persisted
        const openai = new OpenAI({
            apiKey: openaiApiKey
        });

        // Fetch and parse the page content
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SellOnLLM/1.0; +https://sellonllm.com)'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract main content
        const mainContent = $('main, article, .content, #content, .post-content, .entry-content').first();
        const bodyText = mainContent.length > 0 ? mainContent.text() : $('body').text();
        
        // Clean and prepare content (limit to 8000 chars to avoid token limits)
        const pageContent = bodyText.trim().replace(/\s+/g, ' ').substring(0, 8000);
        
        // Extract metadata
        const title = $('title').text() || '';
        const metaDescription = $('meta[name="description"]').attr('content') || '';
        const h1 = $('h1').first().text() || '';

        // Analyze each prompt
        const results = await Promise.all(
            prompts.map(async (prompt) => {
                try {
                    const analysis = await analyzePromptRelevance(
                        openai,
                        prompt,
                        {
                            content: pageContent,
                            title,
                            metaDescription,
                            h1,
                            url
                        }
                    );
                    
                    return {
                        prompt,
                        ...analysis
                    };
                } catch (error) {
                    console.error(`Error analyzing prompt "${prompt}":`, error);
                    return {
                        prompt,
                        score: 0,
                        relevance: 'error',
                        explanation: `Error analyzing: ${error.message}`,
                        strengths: [],
                        weaknesses: [],
                        recommendations: []
                    };
                }
            })
        );

        // Calculate overall score (average of all prompts)
        const overallScore = Math.round(
            results.reduce((sum, r) => sum + r.score, 0) / results.length
        );

        return res.status(200).json({
            success: true,
            url,
            overallScore,
            results,
            analyzedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Prompt relevance analysis error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to analyze prompt relevance',
            message: error.message
        });
    }
}

async function analyzePromptRelevance(openai, prompt, pageData) {
    const systemPrompt = `You are an expert AI SEO analyst. Analyze how well a webpage's content matches a specific user prompt/query. 
Provide a relevance score (0-100), explanation, strengths, weaknesses, and actionable recommendations.

Score Guidelines:
- 90-100: Excellent match - content directly and comprehensively addresses the prompt
- 70-89: Good match - content addresses most aspects of the prompt
- 50-69: Fair match - content partially addresses the prompt but missing key elements
- 30-49: Poor match - content has limited relevance to the prompt
- 0-29: Very poor match - content is not relevant to the prompt

Respond in valid JSON format only.`;

    const userPrompt = `Analyze how well this webpage content matches the user prompt: "${prompt}"

Webpage Information:
- Title: ${pageData.title}
- H1: ${pageData.h1}
- Meta Description: ${pageData.metaDescription}
- URL: ${pageData.url}

Page Content (first 8000 characters):
${pageData.content}

Provide your analysis in this exact JSON format:
{
  "score": <number 0-100>,
  "relevance": "<excellent|good|fair|poor|very_poor>",
  "explanation": "<2-3 sentence explanation of why this score>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...],
  "recommendations": ["<actionable recommendation 1>", "<recommendation 2>", ...]
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: 'json_object' }
        });

        const responseText = completion.choices[0].message.content;
        const analysis = JSON.parse(responseText);

        // Validate and normalize the response
        return {
            score: Math.max(0, Math.min(100, parseInt(analysis.score) || 0)),
            relevance: analysis.relevance || 'unknown',
            explanation: analysis.explanation || 'No explanation provided',
            strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
            weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
            recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : []
        };

    } catch (error) {
        console.error('OpenAI API error:', error);
        throw new Error(`Failed to analyze with OpenAI: ${error.message}`);
    }
}


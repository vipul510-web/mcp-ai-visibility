// Vercel Serverless Function to collect user feedback
import { neon } from '@neondatabase/serverless';

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

    const { feedback, pageUrl, timestamp } = req.body;

    if (!feedback || !feedback.trim()) {
        return res.status(400).json({ error: 'Feedback is required' });
    }

    try {
        // Verify database connection
        if (!process.env.DATABASE_URL) {
            console.error('DATABASE_URL is not set');
            throw new Error('Database connection not configured');
        }

        // Initialize SQL connection
        const sql = neon(process.env.DATABASE_URL);

        const feedbackText = feedback.trim();
        const pageUrlValue = pageUrl || 'unknown';
        const timestampValue = timestamp || new Date().toISOString();

        console.log('Attempting to save feedback:', {
            feedback: feedbackText.substring(0, 50),
            pageUrl: pageUrlValue,
            timestamp: timestampValue
        });

        // Save feedback to database
        const result = await sql(
            `INSERT INTO feedback (feedback_text, page_url, created_at)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [feedbackText, pageUrlValue, timestampValue]
        );

        // Log for debugging
        console.log('Feedback saved successfully:', {
            id: result[0]?.id,
            feedback: feedbackText.substring(0, 50),
            pageUrl: pageUrlValue,
            timestamp: timestampValue
        });

        return res.status(200).json({
            success: true,
            message: 'Feedback received. Thank you!',
            id: result[0]?.id
        });

    } catch (error) {
        console.error('Feedback submission error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            databaseUrl: process.env.DATABASE_URL ? 'Set (length: ' + process.env.DATABASE_URL.length + ')' : 'Not set'
        });
        
        // Return error details for debugging
        return res.status(500).json({
            success: false,
            error: 'Failed to save feedback',
            message: error.message,
            detail: error.detail,
            hint: error.hint
        });
    }
}


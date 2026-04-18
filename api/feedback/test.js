// Test endpoint to verify database connection and table
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        if (!process.env.DATABASE_URL) {
            return res.status(500).json({
                error: 'DATABASE_URL not set',
                message: 'Database connection string is missing'
            });
        }

        const sql = neon(process.env.DATABASE_URL);

        // Test 1: Check if table exists
        const tableCheck = await sql(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'feedback'
            )
        `);

        // Test 2: Count rows
        const countResult = await sql(`SELECT COUNT(*) as count FROM feedback`);

        // Test 3: Get recent feedback
        const recentFeedback = await sql(`
            SELECT id, feedback_text, page_url, created_at 
            FROM feedback 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        return res.status(200).json({
            databaseConnected: true,
            tableExists: tableCheck[0]?.exists || false,
            totalRows: parseInt(countResult[0]?.count || 0),
            recentFeedback: recentFeedback,
            databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Not set'
        });

    } catch (error) {
        console.error('Test error:', error);
        return res.status(500).json({
            error: 'Database test failed',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}


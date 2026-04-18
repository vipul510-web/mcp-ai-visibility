// Vercel Serverless Function to list all feedback
// Add authentication/authorization as needed for production

export default async function handler(req, res) {
    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // TODO: Add authentication/authorization check here
    // For now, this endpoint is open - secure it in production!
    // const authHeader = req.headers.authorization;
    // if (!authHeader || !authHeader.startsWith('Bearer ')) {
    //     return res.status(401).json({ error: 'Unauthorized' });
    // }

    try {
        const { neon } = await import('@neondatabase/serverless');
        const sql = neon(process.env.DATABASE_URL);
        
        const { limit = 100, offset = 0 } = req.query;
        const limitNum = parseInt(limit);
        const offsetNum = parseInt(offset);

        // Get all feedback
        const result = await sql(
            `SELECT id, feedback_text, page_url, created_at
             FROM feedback
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2`,
            [limitNum, offsetNum]
        );

        // Get total count
        const countResult = await sql(
            `SELECT COUNT(*) as total FROM feedback`
        );

        return res.status(200).json({
            feedback: result,
            total: parseInt(countResult[0].total),
            limit: limitNum,
            offset: offsetNum
        });

    } catch (error) {
        console.error('List feedback error:', error);
        return res.status(500).json({
            error: 'Failed to retrieve feedback',
            message: error.message
        });
    }
}


// Vercel Serverless Function to proxy Google Analytics events
// This avoids CORS issues when tracking from Chrome extensions

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

    const { client_id, events, measurement_id } = req.body;

    if (!client_id || !events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'Missing required fields: client_id, events' });
    }

    // Use provided measurement_id or default
    const gaMeasurementId = measurement_id || 'G-7KK7VYDR9D';

    try {
        // Add custom parameters to identify extension traffic
        const eventsWithSource = events.map(event => ({
            ...event,
            params: {
                ...event.params,
                source: event.params?.source || 'chrome_extension',
                platform: event.params?.platform || 'extension',
                // Add custom dimension for better filtering
                custom_parameter_1: 'extension'
            }
        }));

        // Forward to Google Analytics Measurement Protocol API
        const gaResponse = await fetch(
            `https://www.google-analytics.com/mp/collect?measurement_id=${gaMeasurementId}&_r=${Math.random()}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id,
                    events: eventsWithSource
                })
            }
        );

        // GA API doesn't return JSON, just status codes
        if (gaResponse.ok || gaResponse.status === 204) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(gaResponse.status).json({
                success: false,
                error: 'Failed to send to Google Analytics'
            });
        }

    } catch (error) {
        console.error('GA tracking proxy error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to proxy tracking request',
            message: error.message
        });
    }
}


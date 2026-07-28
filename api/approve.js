const axios = require('axios');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { paymentId } = req.body || {};
    const API_KEY = process.env.PI_API_KEY;

    console.log('🔍 [approve.js] paymentId:', paymentId);
    console.log('🔍 [approve.js] API_KEY exists:', !!API_KEY);

    if (!paymentId) {
        return res.status(400).json({ error: 'paymentId required' });
    }
    if (!API_KEY) {
        return res.status(500).json({ error: 'API Key missing' });
    }

    const MAX_ATTEMPTS = 5;
    const DELAY_MS = 2000;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const r = await axios.post(
                `https://api.minepi.com/v2/payments/${paymentId}/approve`,
                {},
                { headers: { Authorization: `Key ${API_KEY}` } }
            );
            console.log('✅ [approve.js] Approved on attempt ' + attempt + ':', r.data);
            return res.status(200).json(r.data);
        } catch (e) {
            lastError = e.response?.data || e.message;
            console.error('❌ [approve.js] Attempt ' + attempt + ' failed (status ' + (e.response?.status || 'n/a') + '):', lastError);

            if (attempt < MAX_ATTEMPTS) {
                console.log('⏳ [approve.js] Retrying in ' + DELAY_MS + 'ms...');
                await delay(DELAY_MS);
            }
        }
    }

    return res.status(400).json({ error: lastError, attempts: MAX_ATTEMPTS });
};

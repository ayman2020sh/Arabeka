const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { paymentId } = req.body || {};
    const API_KEY = process.env.PI_API_KEY;

    console.log('🔍 [approve.js] paymentId:', paymentId);
    console.log('🔍 [approve.js] API_KEY exists:', !!API_KEY);
    console.log('🔍 [approve.js] API_KEY prefix:', API_KEY ? API_KEY.substring(0, 10) : 'null');

    if (!paymentId) {
        return res.status(400).json({ error: 'paymentId required' });
    }

    if (!API_KEY) {
        return res.status(500).json({ error: 'API Key missing' });
    }

    // محاولة 1: Production
    try {
        console.log('🔍 [approve.js] Trying Production API...');
        const r = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            { headers: { Authorization: `Key ${API_KEY}` } }
        );
        console.log('✅ [approve.js] Production success:', r.data);
        return res.status(200).json(r.data);
    } catch (e1) {
        console.log('❌ [approve.js] Production failed:', e1.response?.data || e1.message);

        // محاولة 2: Sandbox
        try {
            console.log('🔍 [approve.js] Trying Sandbox API...');
            const r = await axios.post(
                `https://api.minepi.com/v2/payments/${paymentId}/approve`,
                {},
                { 
                    headers: { 
                        Authorization: `Key ${API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('✅ [approve.js] Sandbox success:', r.data);
            return res.status(200).json(r.data);
        } catch (e2) {
            console.error('❌ [approve.js] Both attempts failed:', e2.response?.data || e2.message);
            return res.status(400).json({ 
                error: e2.response?.data || e2.message,
                attempts: ['Production failed', 'Sandbox failed']
            });
        }
    }
};

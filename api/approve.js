const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { paymentId } = req.body || {};
    const API_KEY = process.env.PI_API_KEY;

    // 🔍 تشخيصي موسع
    console.log('🔍 [approve.js] paymentId received:', paymentId);
    console.log('🔍 [approve.js] API_KEY exists:', !!API_KEY);
    console.log('🔍 [approve.js] API_KEY length:', API_KEY ? API_KEY.length : 0);
    console.log('🔍 [approve.js] Full req.body:', JSON.stringify(req.body));

    if (!paymentId) {
        console.error('❌ [approve.js] paymentId missing');
        return res.status(400).json({ error: 'paymentId required' });
    }

    if (!API_KEY) {
        console.error('❌ [approve.js] API_KEY missing in environment');
        return res.status(500).json({ error: 'API Key missing' });
    }

    try {
        console.log('🔍 [approve.js] Sending approve request to Pi API...');
        const r = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            { headers: { Authorization: `Key ${API_KEY}` } }
        );
        console.log('✅ [approve.js] Pi API response:', r.data);
        return res.status(200).json(r.data);
    } catch (e) {
        console.error('❌ [approve.js] Error:', e.response?.data || e.message);
        return res.status(400).json({ error: e.response?.data || e.message });
    }
};

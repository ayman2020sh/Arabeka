const axios = require('axios');

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

    try {
        // ملاحظة: التطبيق مسجّل على شبكة Testnet، فلازم نستخدم
        // api.testnet.minepi.com بدل api.minepi.com العادي (بتاع Mainnet)
        const r = await axios.post(
            `https://api.testnet.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            { headers: { Authorization: `Key ${API_KEY}` } }
        );
        console.log('✅ [approve.js] Approved:', r.data);
        return res.status(200).json(r.data);
    } catch (e) {
        console.error('❌ [approve.js] Failed:', e.response?.data || e.message);
        return res.status(400).json({ error: e.response?.data || e.message });
    }
};

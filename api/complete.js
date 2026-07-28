const axios = require('axios');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let { paymentId, txid } = req.body || {};
    const API_KEY = process.env.PI_API_KEY;

    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });
    if (!API_KEY) return res.status(500).json({ error: 'API Key missing' });

    const MAX_ATTEMPTS = 4;
    const DELAY_MS = 1500;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            if (!txid) {
                const info = await axios.get(
                    `https://api.minepi.com/v2/payments/${paymentId}`,
                    { headers: { Authorization: `Key ${API_KEY}` } }
                );
                txid = info.data?.transaction?.txid;
                if (!txid) return res.status(400).json({ error: 'no txid yet' });
            }

            const r = await axios.post(
                `https://api.minepi.com/v2/payments/${paymentId}/complete`,
                { txid },
                { headers: { Authorization: `Key ${API_KEY}` } }
            );
            console.log('✅ [complete.js] Completed on attempt ' + attempt + ':', r.data);
            return res.status(200).json(r.data);
        } catch (e) {
            const errData = e.response?.data || e.message;
            console.error('❌ [complete.js] Attempt ' + attempt + ' failed:', errData);

            const isNotFound = e.response?.status === 400 &&
                JSON.stringify(errData).includes('not_found');

            if (isNotFound && attempt < MAX_ATTEMPTS) {
                console.log('⏳ [complete.js] Retrying in ' + DELAY_MS + 'ms...');
                await delay(DELAY_MS);
                continue;
            }

            return res.status(500).json({ error: errData, attempts: attempt });
        }
    }
};

const axios = require('axios');

// دالة مساعدة لتحليل جسم الطلب يدويًا
async function parseBody(req) {
    return new Promise((resolve) => {
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            resolve(req.body);
        } else {
            let rawBody = '';
            req.on('data', chunk => { rawBody += chunk.toString(); });
            req.on('end', () => {
                try {
                    resolve(JSON.parse(rawBody || '{}'));
                } catch (e) {
                    resolve({});
                }
            });
        }
    });
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = await parseBody(req);
    let { paymentId, txid } = body;
    const API_KEY = process.env.PI_API_KEY;

    if (!paymentId) {
        return res.status(400).json({ error: 'paymentId missing' });
    }

    if (!API_KEY) {
        return res.status(500).json({ error: 'API Key missing' });
    }

    try {
        if (!txid) {
            const info = await axios.get(
                `https://api.minepi.com/v2/payments/${paymentId}`,
                { headers: { Authorization: `Key ${API_KEY}` } }
            );
            txid = info.data?.transaction?.txid;
            if (!txid) {
                return res.status(400).json({ error: 'no txid found' });
            }
        }

        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/complete`,
            { txid },
            { headers: { Authorization: `Key ${API_KEY}` } }
        );
        return res.status(200).json(response.data);
    } catch (error) {
        return res.status(500).json({ 
            error: "complete failed", 
            details: error.response?.data || error.message 
        });
    }
};

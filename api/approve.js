const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { paymentId } = req.body;
    const API_KEY = process.env.PI_API_KEY;

    if (!paymentId) {
        return res.status(400).json({ error: 'paymentId missing' });
    }

    if (!API_KEY) {
        return res.status(500).json({ error: 'API Key missing' });
    }

    try {
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            { headers: { Authorization: `Key ${API_KEY}`, 'Content-Type': 'application/json' } }
        );
        return res.status(200).json(response.data);
    } catch (error) {
        console.error(error.response?.data || error.message);
        return res.status(400).json({ error: 'approve failed', details: error.response?.data || error.message });
    }
};

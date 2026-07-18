const axios = require('axios');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // قراءة جسم الطلب بشكل صحيح (حل مشكلة Vercel)
    let body = req.body;
    if (!body || (typeof body === 'string' && body.length === 0)) {
        return res.status(400).json({ error: 'جسم الطلب فارغ' });
    }

    const paymentId = body.paymentId;
    const API_KEY = process.env.PI_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: "API Key missing in Vercel" });
    }

    if (!paymentId) {
        return res.status(400).json({ error: 'معرف الدفع (paymentId) مطلوب' });
    }

    try {
        console.log(`محاولة الموافقة على الدفعة: ${paymentId}`);
        
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            { headers: { Authorization: `Key ${API_KEY}` } }
        );

        console.log(`تمت الموافقة على الدفعة: ${paymentId}`);
        return res.status(200).json(response.data);

    } catch (error) {
        const piError = error.response?.data || error.message;
        console.error("فشل الموافقة:", piError);
        return res.status(400).json({ error: "رفضت شبكة Pi الموافقة", details: piError });
    }
};

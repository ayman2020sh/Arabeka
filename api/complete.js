const axios = require('axios');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let body = req.body;
    if (!body || (typeof body === 'string' && body.length === 0)) {
        return res.status(400).json({ error: 'جسم الطلب فارغ' });
    }

    let { paymentId, txid } = body;
    const API_KEY = process.env.PI_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: "API Key missing in Vercel" });
    }

    if (!paymentId) {
        return res.status(400).json({ error: 'معرف الدفع (paymentId) مطلوب' });
    }

    try {
        if (!txid) {
            const paymentInfo = await axios.get(
                `https://api.minepi.com/v2/payments/${paymentId}`,
                { headers: { Authorization: `Key ${API_KEY}` } }
            );
            txid = paymentInfo.data?.transaction?.txid || null;
            if (!txid) {
                return res.status(400).json({ error: 'لم يتم العثور على معاملة بلوكشين' });
            }
        }

        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/complete`,
            { txid: txid },
            { headers: { Authorization: `Key ${API_KEY}` } }
        );

        console.log(`تم إكمال الدفعة: ${paymentId}`);
        return res.status(200).json(response.data);

    } catch (error) {
        const piError = error.response?.data || error.message;
        console.error("فشل الإكمال:", piError);
        return res.status(500).json({ error: "فشلت عملية إكمال الدفع", details: piError });
    }
};

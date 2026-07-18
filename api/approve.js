const axios = require('axios');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { paymentId } = req.body;
    const API_KEY = process.env.PI_API_KEY;

    if (!API_KEY) {
        console.error("المفتاح PI_API_KEY غير موجود في إعدادات Vercel");
        return res.status(400).json({ error: "API Key missing in Vercel" });
    }

    try {
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            {
                headers: {
                    Authorization: `Key ${API_KEY}`
                }
            }
        );

        return res.status(200).json(response.data);

    } catch (error) {
        const piErrorDetails = error.response && error.response.data 
            ? error.response.data 
            : error.message;
            
        console.error("سبب رفض شبكة Pi:", piErrorDetails);

        return res.status(400).json({ 
            error: "رفضت شبكة Pi الموافقة على الدفع", 
            details: piErrorDetails 
        });
    }
};

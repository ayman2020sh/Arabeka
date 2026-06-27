const axios = require('axios');

module.exports = async function handler(req, res) {
    // السماح بطلبات POST فقط
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { paymentId } = req.body;

    // التأكد من وصول الـ paymentId من المتصفح
    if (!paymentId) {
        return res.status(400).json({ error: 'Missing paymentId' });
    }

    try {
        // إرسال طلب الموافقة الرسمي إلى سيرفرات Pi Network
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            {
                headers: {
                    Authorization: `Key ${process.env.PI_API_KEY}`
                }
            }
        );

        // إرجاع رد ناجح للمتصفح ليفتح المحفظة فوراً
        return res.status(200).json(response.data);
    } catch (error) {
        console.error("Approve Error:", error.response ? error.response.data : error.message);
        return res.status(500).json({ 
            error: "فشلت عملية الموافقة", 
            details: error.response ? error.response.data : error.message 
        });
    }
};

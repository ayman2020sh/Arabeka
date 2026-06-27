const axios = require('axios');

module.exports = async function handler(req, res) {
    // السماح بطلبات POST فقط
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { paymentId, txid } = req.body;

    // التأكد من إرسال البيانات المطلوبة من المتصفح
    if (!paymentId || !txid) {
        return res.status(400).json({ error: 'Missing paymentId or txid' });
    }

    try {
        // إرسال المعاملة ورقم الـ txid لشبكة Pi لتأكيد اكتمال الدفع على البلوكشين
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/complete`,
            { txid: txid },
            {
                headers: {
                    Authorization: `Key ${process.env.PI_API_KEY}`
                }
            }
        );

        // رد نجاح نهائي للتطبيق
        return res.status(200).json(response.data);
    } catch (error) {
        console.error("Complete Error:", error.response ? error.response.data : error.message);
        return res.status(500).json({ 
            error: "فشلت عملية إكمال الدفع على البلوكشين", 
            details: error.response ? error.response.data : error.message 
        });
    }
};

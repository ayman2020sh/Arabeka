const axios = require('axios');

module.exports = async function handler(req, res) {
    // السماح بطلبات POST فقط
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { paymentId } = req.body;
    const API_KEY = process.env.PI_API_KEY;

    // التأكد من أن مفتاح التطبيق موجود في Vercel
    if (!API_KEY) {
        console.error("المفتاح PI_API_KEY غير موجود في إعدادات Vercel");
        return res.status(400).json({ error: "API Key missing in Vercel" });
    }

    try {
        // إرسال طلب الموافقة لشبكة Pi
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            {
                headers: {
                    Authorization: `Key ${API_KEY}`
                }
            }
        );

        // إذا وافقت شبكة Pi، نرجع النجاح
        return res.status(200).json(response.data);

    } catch (error) {
        // التقاط السبب الحقيقي لرفض شبكة Pi لعملية الموافقة
        const piErrorDetails = error.response && error.response.data 
            ? error.response.data 
            : error.message;
            
        console.error("سبب رفض شبكة Pi:", piErrorDetails);

        // إرجاع الخطأ الدقيق للواجهة الأمامية لكي يظهر لنا
        return res.status(400).json({ 
            error: "رفضت شبكة Pi الموافقة على الدفع", 
            details: piErrorDetails 
        });
    }
};

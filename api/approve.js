const axios = require('axios');

module.exports = async function handler(req, res) {
    console.log("=== approve.js تم استدعاؤه ===");
    console.log("طريقة الطلب:", req.method);
    console.log("جسم الطلب:", JSON.stringify(req.body));

    if (req.method !== 'POST') {
        console.log("تم رفض الطلب: الطريقة ليست POST");
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { paymentId } = req.body;
    const API_KEY = process.env.PI_API_KEY;

    console.log("paymentId المستلم:", paymentId);
    console.log("هل مفتاح API موجود؟", !!API_KEY);

    if (!API_KEY) {
        console.error("المفتاح PI_API_KEY غير موجود");
        return res.status(500).json({ error: "API Key missing in Vercel" });
    }

    if (!paymentId) {
        console.error("paymentId مفقود من الطلب");
        return res.status(400).json({ error: 'معرف الدفع (paymentId) مطلوب' });
    }

    try {
        console.log(`جاري إرسال طلب الموافقة إلى Pi للمعاملة: ${paymentId}`);
        
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            { headers: { Authorization: `Key ${API_KEY}` } }
        );

        console.log("تمت الموافقة بنجاح من Pi:", JSON.stringify(response.data));
        return res.status(200).json(response.data);

    } catch (error) {
        const piErrorDetails = error.response?.data || error.message;
        console.error("فشل من Pi:", JSON.stringify(piErrorDetails));
        return res.status(400).json({ 
            error: "رفضت شبكة Pi الموافقة على الدفع", 
            details: piErrorDetails 
        });
    }
};

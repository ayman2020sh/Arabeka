const axios = require('axios');

module.exports = async function handler(req, res) {
    console.log("=== complete.js تم استدعاؤه ===");
    console.log("طريقة الطلب:", req.method);
    console.log("جسم الطلب:", JSON.stringify(req.body));

    if (req.method !== 'POST') {
        console.log("تم رفض الطلب: الطريقة ليست POST");
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let { paymentId, txid } = req.body;
    const API_KEY = process.env.PI_API_KEY;

    console.log("paymentId المستلم:", paymentId);
    console.log("txid المستلم:", txid);
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
        if (!txid) {
            console.log(`txid غير موجود، جاري جلبه من Pi للمعاملة: ${paymentId}`);
            
            const paymentInfo = await axios.get(
                `https://api.minepi.com/v2/payments/${paymentId}`,
                { headers: { Authorization: `Key ${API_KEY}` } }
            );
            
            txid = paymentInfo.data?.transaction?.txid || null;
            console.log("txid بعد الجلب:", txid);
            
            if (!txid) {
                console.error("لا يوجد txid، لا يمكن إكمال الدفع");
                return res.status(400).json({ 
                    error: 'لم يتم العثور على معاملة بلوكشين لهذه الدفعة' 
                });
            }
        }

        console.log(`جاري إرسال طلب الإكمال إلى Pi للمعاملة: ${paymentId}`);
        
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/complete`,
            { txid: txid },
            { headers: { Authorization: `Key ${API_KEY}` } }
        );

        console.log("تم الإكمال بنجاح:", JSON.stringify(response.data));
        return res.status(200).json(response.data);

    } catch (error) {
        const piErrorDetails = error.response?.data || error.message;
        console.error("فشل الإكمال:", JSON.stringify(piErrorDetails));
        return res.status(500).json({ 
            error: "فشلت عملية إكمال وتسوية الدفع", 
            details: piErrorDetails 
        });
    }
};

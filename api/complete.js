const axios = require('axios');

module.exports = async function handler(req, res) {
    // السماح بطلبات POST فقط
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let { paymentId, txid } = req.body;

    // التأكد على الأقل من وجود معرف الدفع
    if (!paymentId) {
        return res.status(400).json({ error: 'Missing paymentId' });
    }

    try {
        // ⭐ حل سحري: إذا لم يرسل المتصفح txid (حالة الدفع المعلق)
        if (!txid) {
            console.log(`جاري جلب الـ txid المفقود للمعاملة المعلقة: ${paymentId}`);
            
            // الاتصال بشبكة Pi لمعرفة تفاصيل المعاملة المعلقة وجلب الـ txid الخاص بها
            const paymentInfo = await axios.get(
                `https://api.minepi.com/v2/payments/${paymentId}`,
                {
                    headers: { Authorization: `Key ${process.env.PI_API_KEY}` }
                }
            );
            
            // استخراج الـ txid إذا كان متاحاً في البلوكشين
            txid = paymentInfo.data.transaction ? paymentInfo.data.transaction.txid : null;
            
            if (!txid) {
                return res.status(400).json({ error: 'هذه المعاملة لم تقم بالدفع على البلوكشين بعد، لا يمكن إغلاقها.' });
            }
        }

        // إرسال المعاملة ورقم الـ txid لشبكة Pi لتأكيد اكتمال الدفع وإغلاقها نهائياً
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
            error: "فشلت عملية إكمال وتسوية الدفع", 
            details: error.response ? error.response.data : error.message 
        });
    }
};

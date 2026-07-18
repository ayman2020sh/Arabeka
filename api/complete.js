const axios = require('axios');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let { paymentId, txid } = req.body;
    const API_KEY = process.env.PI_API_KEY;

    if (!API_KEY) {
        console.error("المفتاح PI_API_KEY غير موجود في إعدادات Vercel");
        return res.status(500).json({ error: "API Key missing in Vercel" });
    }

    if (!paymentId) {
        return res.status(400).json({ error: 'معرف الدفع (paymentId) مطلوب' });
    }

    try {
        if (!txid) {
            console.log(`جاري جلب الـ txid للمعاملة: ${paymentId}`);
            
            const paymentInfo = await axios.get(
                `https://api.minepi.com/v2/payments/${paymentId}`,
                { headers: { Authorization: `Key ${API_KEY}` } }
            );
            
            txid = paymentInfo.data.transaction ? paymentInfo.data.transaction.txid : null;
            
            if (!txid) {
                return res.status(400).json({ 
                    error: 'لم يتم العثور على معاملة بلوكشين لهذه الدفعة',
                    details: 'لم يقم المستخدم بالدفع بعد أو المعاملة لم تكتمل'
                });
            }
        }

        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/complete`,
            { txid: txid },
            { headers: { Authorization: `Key ${API_KEY}` } }
        );

        console.log(`تم إكمال الدفعة بنجاح: ${paymentId}`);
        
        return res.status(200).json({
            success: true,
            message: 'تم إكمال الدفع وإغلاق نافذة الدفع بنجاح',
            data: response.data
        });

    } catch (error) {
        const piErrorDetails = error.response && error.response.data 
            ? error.response.data 
            : error.message;
            
        console.error("فشل إكمال الدفع:", piErrorDetails);
        
        return res.status(500).json({ 
            error: "فشلت عملية إكمال وتسوية الدفع", 
            details: piErrorDetails
        });
    }
};

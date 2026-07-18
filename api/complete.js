const axios = require('axios');

module.exports = async function handler(req, res) {
    // ========== 1. السماح بطلبات POST فقط ==========
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ========== 2. استخراج البيانات من الطلب ==========
    let { paymentId, txid, userId } = req.body;
    const API_KEY = process.env.PI_API_KEY;

    // ========== 3. التحقق من وجود مفتاح Pi ==========
    if (!API_KEY) {
        console.error("المفتاح PI_API_KEY غير موجود في إعدادات Vercel");
        return res.status(500).json({ error: "API Key missing in Vercel" });
    }

    // ========== 4. التحقق من وجود Payment ID ==========
    if (!paymentId) {
        return res.status(400).json({ error: 'معرف الدفع (paymentId) مطلوب' });
    }

    try {
        // ========== 5. جلب الـ txid تلقائيًا إذا لم يُرسل ==========
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

        // ========== 6. التحقق من ملكية الدفعة (اختياري لكن موصى به) ==========
        if (userId) {
            try {
                const paymentInfo = await axios.get(
                    `https://api.minepi.com/v2/payments/${paymentId}`,
                    { headers: { Authorization: `Key ${API_KEY}` } }
                );

                const paymentUserId = paymentInfo.data.user_uid;
                
                if (paymentUserId !== userId) {
                    console.error(`تلاعب محتمل: المستخدم ${userId} يحاول إكمال دفعة ${paymentId} المملوكة لـ ${paymentUserId}`);
                    return res.status(403).json({ 
                        error: 'أنت لست صاحب هذه الدفعة',
                        details: 'تلاعب مرفوض'
                    });
                }
            } catch (error) {
                console.error("خطأ في التحقق من ملكية الدفعة:", error.message);
                return res.status(500).json({ 
                    error: "فشل التحقق من ملكية الدفعة",
                    details: error.message
                });
            }
        }

        // ========== 7. إرسال تأكيد الإكمال لشبكة Pi ==========
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/complete`,
            { txid: txid },
            { headers: { Authorization: `Key ${API_KEY}` } }
        );

        // ========== 8. نجاح الإكمال ==========
        console.log(`تم إكمال الدفعة بنجاح: ${paymentId}`);
        
        return res.status(200).json({
            success: true,
            message: 'تم إكمال الدفع وإغلاق نافذة الدفع بنجاح',
            data: response.data
        });

    } catch (error) {
        // ========== 9. فشل الإكمال ==========
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

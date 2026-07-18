const axios = require('axios');

module.exports = async function handler(req, res) {
    // ========== 1. السماح بطلبات POST فقط ==========
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ========== 2. استخراج البيانات من الطلب ==========
    const { paymentId, userId, productId, amount } = req.body;
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

    // ========== 5. التحقق من هوية المستخدم (اختياري لكن موصى به) ==========
    // إذا أرسلت الواجهة الأمامية userId، نتحقق منه مع Pi
    if (userId) {
        try {
            const paymentInfo = await axios.get(
                `https://api.minepi.com/v2/payments/${paymentId}`,
                { headers: { Authorization: `Key ${API_KEY}` } }
            );

            const paymentUserId = paymentInfo.data.user_uid;
            
            // هل المستخدم الذي يطلب الموافقة هو نفسه صاحب الدفعة؟
            if (paymentUserId !== userId) {
                console.error(`تلاعب محتمل: المستخدم ${userId} يحاول الموافقة على دفعة ${paymentId} المملوكة لـ ${paymentUserId}`);
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

    // ========== 6. التحقق من المبلغ المطلوب (اختياري لكن موصى به) ==========
    if (amount && productId) {
        // يمكنك هنا إضافة التحقق من سعر المنتج من قاعدة بيانات
        // مثال: const expectedAmount = await getProductPrice(productId);
        // if (expectedAmount !== amount) { return error; }
        console.log(`طلب شراء منتج ${productId} بسعر ${amount}`);
    }

    // ========== 7. محاولة الموافقة على الدفع ==========
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

        // ========== 8. نجاح الموافقة ==========
        console.log(`تمت الموافقة على الدفعة: ${paymentId}`);
        
        return res.status(200).json({
            success: true,
            message: 'تمت الموافقة على الدفع',
            data: response.data
        });

    } catch (error) {
        // ========== 9. فشل الموافقة ==========
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

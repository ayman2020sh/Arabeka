const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());

// ⚠️ استبدل هذا بالمفتاح السري الخاص بك من Pi Developer Portal لاحقاً
const PI_API_KEY = "YOUR_PI_API_KEY"; 

// تشغيل واجهة المتجر عند الدخول للرابط الرئيسي
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pi-payment.html'));
});

// هذا هو المسار الذي سيتلقى طلبات الموافقة على الدفع من المتجر
app.post('/approve-payment', async (req, res) => {
    const { paymentId } = req.body;

    try {
        // الاتصال بسيرفرات Pi لإعطاء الموافقة الرسمية
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            {
                headers: { Authorization: `Key ${PI_API_KEY}` }
            }
        );
        
        console.log("تمت الموافقة على الدفعة بنجاح:", paymentId);
        res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error("خطأ أثناء الموافقة:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// تشغيل السيرفر على المنفذ 3000 أو المنفذ المتاح
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`السيرفر يعمل الآن بنجاح على المنفذ ${PORT}`);
});

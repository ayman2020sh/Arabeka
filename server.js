const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// مفتاح المطور الخاص بـ Pi Network (تأكد من وضعه في إعدادات فيرسل لاحقاً أو اتركه للتجربة)
const PI_API_KEY = process.env.PI_API_KEY || "lblpyyemmskpmb1uqatuzfrueofkioh3operkym17j6pzwldslbsnu2hfrwm2vqj"; 

// 1. نقطة الموافقة على الدفع (تستقبل الطلب وتوافق عليه فوراً دون البحث عن منتجات)
app.post('/api/approve', async (req, res) => {
    const { paymentId } = req.body;
    try {
        await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            { headers: { Authorization: `Key ${PI_API_KEY}` } }
        );
        res.json({ message: "تمت الموافقة على الدفع بنجاح" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "فشل في الموافقة على الدفع في السيرفر" });
    }
});

// 2. نقطة إتمام الدفع بعد تحويل الحساب
app.post('/api/complete', async (req, res) => {
    const { paymentId, txid } = req.body;
    try {
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/complete`,
            { txid: txid },
            { headers: { Authorization: `Key ${PI_API_KEY}` } }
        );
        res.json({ message: "تم إكمال الدفع بنجاح", data: response.data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "فشل في إتمام الدفع في السيرفر" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

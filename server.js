const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());

// ⚠️ ضع مفتاح الـ API الحقيقي الخاص بك بين علامات التنصيص بالأسفل:
const PI_API_KEY = "xziegrolwbg8zylxvvklgq8ycjxigdavexcmgoo1cup0kjktx2wxflfb9trmbshy"; 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pi-payment.html'));
});

app.post('/approve-payment', async (req, res) => {
    const { paymentId } = req.body;
    try {
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            { headers: { Authorization: `Key ${PI_API_KEY}` } }
        );
        res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// الإصلاح: جعل السيرفر يستمع للمنفذ بشكل صحيح متوافق مع Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

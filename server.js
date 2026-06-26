const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());

// ملاحظة: تأكد من وضع مفتاح Pi API الصحيح هنا لاحقاً
const PI_API_KEY = "YOUR_PI_API_KEY"; 

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

module.exports = app;

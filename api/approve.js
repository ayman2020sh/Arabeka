import axios from 'axios';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { paymentId } = req.body;

    try {
        // الاتصال بخوادم Pi لإرسال الموافقة الرسمية
        const response = await axios.post(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            {},
            {
                headers: {
                    Authorization: `Key ${process.env.PI_API_KEY}`
                }
            }
        );

        return res.status(200).json(response.data);
    } catch (error) {
        console.error("Approve Error:", error.response ? error.response.data : error.message);
        return res.status(500).json({ error: "فشلت عملية الموافقة من السيرفر الخلفي" });
    }
}

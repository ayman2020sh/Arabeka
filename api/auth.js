const admin = require('firebase-admin');
const axios = require('axios'); // نستخدم axios للتحقق من سيرفر Pi

// 1. تهيئة Firebase Admin
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error);
    }
}

module.exports = async (req, res) => {
    // إعدادات CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // نستقبل اسم المستخدم والـ accessToken الخاص به من Pi SDK
    const { username, accessToken } = req.body;

    if (!username || !accessToken) {
        return res.status(400).json({ error: 'Username and accessToken are required' });
    }

    try {
        // 2. التحقق الحقيقي من Pi Platform API
        const piVerifyRes = await axios.get('https://api.minepi.com/v2/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        // التأكد من أن التوكن يخص نفس المستخدم المذكور في الطلب
        if (!piVerifyRes.data || piVerifyRes.data.username !== username) {
            return res.status(401).json({ error: 'Unauthorized: Invalid Pi authentication' });
        }

        // 3. إصدار Custom Token أمني فقط بعد نجاح التحقق
        const customToken = await admin.auth().createCustomToken(username);
        res.status(200).json({ token: customToken });

    } catch (error) {
        console.error("Pi Authentication Verification Error:", error.response?.data || error.message);
        res.status(401).json({ error: 'Failed to verify Pi authentication token' });
    }
};

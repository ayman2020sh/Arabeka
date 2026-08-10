const admin = require('firebase-admin');

// 1. تهيئة Firebase Admin باستخدام المفتاح السري الذي سنضعه في Vercel لاحقاً
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

// 2. نقطة الاتصال الرئيسية (Endpoint)
module.exports = async (req, res) => {
    
    // السماح بالاتصال من واجهة التطبيق
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

    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    // 3. إنشاء التوكن المخصص (Custom Token)
    try {
        const customToken = await admin.auth().createCustomToken(username);
        res.status(200).json({ token: customToken });
    } catch (error) {
        console.error("Error creating custom token:", error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
};

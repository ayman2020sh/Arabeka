const admin = require('firebase-admin');
const axios = require('axios');

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error);
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { username, accessToken } = req.body || {};
    if (!username || !accessToken) return res.status(400).json({ error: 'username and accessToken required' });

    try {
        const piVerifyRes = await axios.get('https://api.minepi.com/v2/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!piVerifyRes.data || piVerifyRes.data.username !== username) {
            return res.status(401).json({ error: 'التحقق من Pi فشل' });
        }

        const customToken = await admin.auth().createCustomToken(username);

        // حفظ Pi UID لاستخدامه لاحقًا في تحويلات A2U (تحرير المبالغ للبائعين)
        const piUid = piVerifyRes.data.uid;
        if (admin.apps.length && piUid) {
            admin.firestore().collection('users').doc(username).set(
                { piUid, ownerUid: username },
                { merge: true }
            ).catch(e => console.error('Failed to save piUid:', e.message));
        }

        res.status(200).json({ token: customToken });
    } catch (error) {
        console.error('Auth error:', error.response?.data || error.message);
        res.status(500).json({ error: 'فشل التحقق من الحساب' });
    }
};

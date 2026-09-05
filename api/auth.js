const axios = require('axios');
const { admin, db } = require('./_lib/firebase');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { accessToken } = req.body || {};
    if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

    try {
        const { data: me } = await axios.get('https://api.minepi.com/v2/me', {
            headers: { Authorization: `Bearer ${accessToken}` }, timeout: 8000
        });
        if (!me?.username || !me?.uid) return res.status(401).json({ error: 'Invalid Pi token' });

        await db.collection('users').doc(me.username).set(
            { piUid: me.uid, ownerUid: me.username, lastLoginAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );
        const token = await admin.auth().createCustomToken(me.username);
        return res.status(200).json({ token, username: me.username });
    } catch (e) {
        const status = e.response?.status === 401 ? 401 : 500;
        console.error('auth error', e.response?.data || e.message);
        return res.status(status).json({ error: status === 401 ? 'انتهت الجلسة، سجّل الدخول مجدداً' : 'فشل التحقق' });
    }
};

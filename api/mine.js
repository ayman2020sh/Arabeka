const { admin, db } = require('./_lib/firebase');
const requireUser = require('./_lib/requireUser');

const ARA_REWARD = 3.14;
const COOLDOWN_MS = 24 * 3600 * 1000;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const username = await requireUser(req);
        const ref = db.collection('users').doc(username);

        const result = await db.runTransaction(async t => {
            const snap = await t.get(ref);
            const data = snap.exists ? snap.data() : {};
            const last = data.lastMineAt ? data.lastMineAt.toMillis() : 0;
            const now = Date.now();

            if (now - last < COOLDOWN_MS) {
                const err = new Error('جلسة تعدين كل 24 ساعة فقط');
                err.code = 'COOLDOWN';
                err.nextAt = last + COOLDOWN_MS;
                throw err;
            }

            t.set(ref, {
                ownerUid: username,
                lastMineAt: admin.firestore.FieldValue.serverTimestamp(),
                araBalance: admin.firestore.FieldValue.increment(ARA_REWARD)
            }, { merge: true });

            return { balance: Math.round(((data.araBalance || 0) + ARA_REWARD) * 100) / 100 };
        });

        console.log('⛏️ mine:', username, '+', ARA_REWARD, '→', result.balance);
        return res.status(200).json({ ok: true, reward: ARA_REWARD, balance: result.balance });
    } catch (e) {
        if (e.code === 'COOLDOWN') {
            return res.status(429).json({ error: e.message, nextAt: e.nextAt });
        }
        const status = e.status || 500;
        console.error('❌ mine:', e.message);
        return res.status(status).json({ error: e.message });
    }
};

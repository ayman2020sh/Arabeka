const { admin, db } = require('./_lib/firebase');
const { releaseOrder, recoverIncomplete, getPi } = require('./_lib/payout');

const BATCH = 5;

module.exports = async (req, res) => {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`)
        return res.status(401).json({ error: 'Unauthorized' });

    const stats = { checked: 0, released: 0, failed: 0 };
    try {
        await recoverIncomplete(getPi());

        // استبدال الاستعلام (لا فهرس مركب ولا ترحيل)
        const snap = await db.collection('orders')
            .where('status', '==', 'held')
            .where('releaseDeadline', '<=', admin.firestore.Timestamp.now())
            .limit(20).get();
        
        const due = snap.docs.filter(d => (d.data().payoutAttempts || 0) < 5).slice(0, BATCH);
        stats.checked = due.length;
        
        for (const doc of due) {
            try { await releaseOrder(doc.id, { auto: true }); stats.released++; }
            catch (e) { stats.failed++; console.error('cron release failed', doc.id, e.message); }
        }
        return res.status(200).json({ ok: true, ...stats });
    } catch (e) {
        console.error('check-orders fatal', e.message);
        return res.status(500).json({ error: e.message, ...stats });
    }
};

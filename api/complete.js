const { admin, db } = require('./_lib/firebase');
const { getPayment, completePayment, errBody } = require('./_lib/pi');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { paymentId } = req.body || {};
    let { txid } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

    const orderRef = db.collection('orders').doc(paymentId);
    try {
        const payment = await getPayment(paymentId);
        txid = txid || payment.transaction?.txid;
        if (!txid) return res.status(400).json({ error: 'no txid yet' });

        const productId = payment.metadata?.productId;
        if (!productId) return res.status(400).json({ error: 'productId missing' });
        const productSnap = await db.collection('products').doc(productId).get();
        if (!productSnap.exists) return res.status(400).json({ error: 'Product not found' });
        const product = productSnap.data();

        // المشتري: من Pi (موثوق) → اسم المستخدم عبر users.piUid
        const q = await db.collection('users').where('piUid', '==', payment.user_uid).limit(1).get();
        const buyerUsername = q.empty ? (payment.metadata?.buyerUsername || null) : q.docs[0].id;
        const buyerVerified = !q.empty;

        let isNew = true;
        try {
            await orderRef.create({
                productId,
                productName: product.name || '',
                buyerUid: buyerUsername,          // == username (نموذج Firebase Auth عندك)
                buyerUsername,
                buyerPiUid: payment.user_uid,      // لأي استرداد مستقبلي
                buyerVerified,
                sellerUid: product.ownerUid,       // == username
                sellerUsername: product.ownerUid,
                amount: payment.amount,
                paymentId, txid,
                status: 'completing',
                payoutAttempts: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                releaseDeadline: admin.firestore.Timestamp.fromMillis(Date.now() + 48 * 3600 * 1000)
            });
        } catch (e) {
            if (e.code !== 6) throw e; // 6 = ALREADY_EXISTS
            isNew = false;
        }

        if (!isNew) {
            const existing = (await orderRef.get()).data();
            if (existing.status !== 'completing')
                return res.status(200).json({ ok: true, alreadyCompleted: true, status: existing.status });
        }

        const data = payment.status?.developer_completed
            ? { alreadyCompleted: true }
            : await completePayment(paymentId, txid);

        await orderRef.update({ status: 'held', completedAt: admin.firestore.FieldValue.serverTimestamp() });
        
        // خصم الكمية (null/غير موجود = غير محدود)
        await db.runTransaction(async t => {
            const s = await t.get(productSnap.ref);
            if (!s.exists) return;
            const qty = s.data().quantity;
            if (typeof qty === 'number') {
                t.update(productSnap.ref, { quantity: Math.max(0, qty - 1) });
            }
        });

        console.log('✅ [complete] held:', paymentId);
        return res.status(200).json(data);
    } catch (e) {
        console.error('❌ [complete]', paymentId, errBody(e));
        return res.status(e.response?.status >= 500 ? 502 : 400).json({ error: errBody(e) });
    }
};

const { db } = require('./_lib/firebase');
const { getPayment, errBody } = require('./_lib/pi');
const { releaseOrder } = require('./_lib/payout');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { paymentId } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

    try {
        const payment = await getPayment(paymentId);
        
        if (!payment.status?.developer_approved) {
            return res.status(400).json({ error: 'Payment not approved yet' });
        }
        if (payment.status?.completed) {
            return res.status(200).json({ ok: true, alreadyCompleted: true });
        }

        const productId = payment.metadata?.productId;
        if (!productId) return res.status(400).json({ error: 'productId missing in metadata' });

        const productSnap = await db.collection('products').doc(productId).get();
        if (!productSnap.exists) return res.status(400).json({ error: 'Product not found' });

        // خصم الكمية (null/غير موجود = غير محدود)
        await db.runTransaction(async t => {
            const s = await t.get(productSnap.ref);
            if (!s.exists) return;
            const q = s.data().quantity;
            if (typeof q === 'number') {
                t.update(productSnap.ref, { quantity: Math.max(0, q - 1) });
            }
        });

        // إنشاء طلب وإطلاقه تلقائياً
        const orderId = await db.collection('orders').add({
            productId: productId,
            buyerUid: payment.user_uid,
            amount: payment.amount,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentId: paymentId
        }).then(ref => ref.id);

        await releaseOrder(orderId, { auto: true });

        return res.status(200).json({ ok: true, orderId });

    } catch (e) {
        console.error('❌ [complete]', paymentId, errBody(e));
        return res.status(400).json({ error: errBody(e) });
    }
};

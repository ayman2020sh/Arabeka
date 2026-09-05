const { db } = require('./_lib/firebase');
const { getPayment, approvePayment, errBody } = require('./_lib/pi');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { paymentId } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

    try {
        // 1) جلب الدفعة من Pi (المصدر الموثوق)
        const payment = await getPayment(paymentId);

        if (payment.status?.developer_approved) {
            return res.status(200).json({ ok: true, alreadyApproved: true });
        }
        if (payment.status?.cancelled || payment.status?.user_cancelled) {
            return res.status(400).json({ error: 'Payment cancelled' });
        }

        // 2) التحقق من المنتج — لا نثق إلا بـ productId من metadata
        const productId = payment.metadata?.productId;
        if (!productId) return res.status(400).json({ error: 'productId missing in metadata' });

        const snap = await db.collection('products').doc(productId).get();
        if (!snap.exists) return res.status(400).json({ error: 'Product not found' });
        const product = snap.data();

        if (product.status && product.status !== 'available') {
            return res.status(400).json({ error: 'Product not available' });
        }
        if (typeof product.price !== 'number' || Math.abs(product.price - payment.amount) > 0.0000001) {
            console.error(`[approve] PRICE MISMATCH ${paymentId}: paid=${payment.amount} expected=${product.price}`);
            return res.status(400).json({ error: 'Amount does not match product price' });
        }

        // بدل: if (product.sellerUid && product.sellerUid === payment.user_uid)
        const q = await db.collection('users').where('piUid', '==', payment.user_uid).limit(1).get();
        const buyerUsername = q.empty ? null : q.docs[0].id;
        if (buyerUsername && buyerUsername === product.ownerUid) {
            return res.status(400).json({ error: 'Cannot buy your own product' });
        }

        // 3) كل شيء سليم → الموافقة
        const data = await approvePayment(paymentId);
        console.log('✅ [approve]', paymentId);
        return res.status(200).json(data);

    } catch (e) {
        console.error('❌ [approve]', paymentId, errBody(e));
        return res.status(e.response?.status >= 500 ? 502 : 400).json({ error: errBody(e) });
    }
};

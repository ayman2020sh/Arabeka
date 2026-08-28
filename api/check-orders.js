// 🔴 ملف حساس - أمان عالي (بيستخدم مفتاح المحفظة)
const admin = require('firebase-admin');
const PiNetworkModule = require('pi-backend');
const PiNetwork = PiNetworkModule.default || PiNetworkModule;

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error);
    }
}
const db = admin.apps.length ? admin.firestore() : null;

module.exports = async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Firestore not initialized' });

    const API_KEY = process.env.PI_API_KEY;
    const WALLET_SEED = process.env.PI_WALLET_PRIVATE_SEED;
    if (!API_KEY || !WALLET_SEED) return res.status(500).json({ error: 'Server misconfiguration' });

    const pi = new PiNetwork(API_KEY, WALLET_SEED);
    const now = admin.firestore.Timestamp.now();
    let released = 0;
    let failed = 0;

    try {
        const snap = await db.collection('orders')
            .where('status', '==', 'held')
            .where('releaseDeadline', '<=', now)
            .get();

        for (const doc of snap.docs) {
            const order = doc.data();
            try {
                const sellerDoc = await db.collection('users').doc(order.sellerUsername).get();
                const sellerPiUid = sellerDoc.exists ? sellerDoc.data().piUid : null;
                if (!sellerPiUid) {
                    console.error(`check-orders: no piUid for seller ${order.sellerUsername}, order ${doc.id}`);
                    failed++;
                    continue;
                }

                const paymentId = await pi.createPayment({
                    amount: order.amount,
                    memo: `تحويل مبيعات (تلقائي): ${order.productName || ''}`.slice(0, 28),
                    metadata: { orderId: doc.id, type: 'order_release_auto' },
                    uid: sellerPiUid
                });
                const txid = await pi.submitPayment(paymentId);
                await pi.completePayment(paymentId, txid);

                await doc.ref.update({
                    status: 'released',
                    releasedAt: admin.firestore.FieldValue.serverTimestamp(),
                    releasedAutomatically: true,
                    payoutPaymentId: paymentId,
                    payoutTxid: txid
                });
                released++;
            } catch (orderError) {
                console.error(`check-orders: failed to release order ${doc.id}:`, orderError.message);
                if (orderError.response?.data) {
                    console.error(`check-orders: Pi API response details for ${doc.id}:`, JSON.stringify(orderError.response.data));
                }
                failed++;
            }
        }

        return res.status(200).json({ status: 'ok', checked: snap.size, released, failed });
    } catch (e) {
        console.error('check-orders error:', e.message);
        return res.status(500).json({ error: e.message });
    }
};

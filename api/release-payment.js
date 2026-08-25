// 🔴 ملف حساس - أمان عالي
// بيستخدم PI_WALLET_PRIVATE_SEED لتحويل فلوس حقيقية. لازم يكون Environment Variable بس،
// وممنوع أي حد يرفعه أو يطبعه في الـlogs.

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

async function releaseOrder(orderId, expectedBuyerUsername) {
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) throw new Error('الطلب غير موجود');
    const order = orderDoc.data();

    if (order.buyerUsername !== expectedBuyerUsername) throw new Error('غير مصرح لك بهذا الطلب');
    if (order.status !== 'held') throw new Error('الطلب مش في حالة قابلة للتحرير (الحالة الحالية: ' + order.status + ')');

    // جلب uid صاحب الحساب (Pi User UID) المخزّن وقت تسجيل دخوله
    const sellerDoc = await db.collection('users').doc(order.sellerUsername).get();
    const sellerPiUid = sellerDoc.exists ? sellerDoc.data().piUid : null;
    if (!sellerPiUid) throw new Error('لا يمكن العثور على معرف محفظة البائع (لازم يكون سجّل دخول مرة على الأقل)');

    const API_KEY = process.env.PI_API_KEY;
    const WALLET_SEED = process.env.PI_WALLET_PRIVATE_SEED;
    if (!API_KEY || !WALLET_SEED) throw new Error('إعدادات السيرفر ناقصة (مفتاح المحفظة)');

    const pi = new PiNetwork(API_KEY, WALLET_SEED);

    const paymentData = {
        amount: order.amount,
        memo: `تحويل مبيعات: ${order.productName || ''}`.slice(0, 28),
        metadata: { orderId, type: 'order_release' },
        uid: sellerPiUid
    };

    const payoutPaymentId = await pi.createPayment(paymentData);
    const txid = await pi.submitPayment(payoutPaymentId);
    await pi.completePayment(payoutPaymentId, txid);

    await orderRef.update({
        status: 'released',
        releasedAt: admin.firestore.FieldValue.serverTimestamp(),
        payoutPaymentId,
        payoutTxid: txid
    });

    return { payoutPaymentId, txid };
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!db) {
        return res.status(500).json({ error: 'Server misconfiguration (Firestore)' });
    }

    const { orderId, buyerUsername } = req.body || {};
    if (!orderId || !buyerUsername) {
        return res.status(400).json({ error: 'orderId and buyerUsername are required' });
    }

    try {
        const result = await releaseOrder(orderId, buyerUsername);
        console.log('✅ Order released:', orderId, result);
        return res.status(200).json({ success: true, ...result });
    } catch (e) {
        console.error('❌ release-payment error:', e.message);
        return res.status(400).json({ error: e.message });
    }
};

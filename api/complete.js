const axios = require('axios');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error);
    }
}
const db = admin.apps.length ? admin.firestore() : null;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// إنشاء سجل الطلب المحجوز بعد التأكد الفعلي من نجاح الدفعة
async function createHeldOrder(paymentId, txid, API_KEY) {
    if (!db) {
        console.error('createHeldOrder: Firestore not initialized, skipping order creation');
        return;
    }
    try {
        const info = await axios.get(
            `https://api.minepi.com/v2/payments/${paymentId}`,
            { headers: { Authorization: `Key ${API_KEY}` } }
        );
        const payment = info.data;
        const metadata = payment.metadata || {};
        const { productId, sellerUsername, buyerUsername } = metadata;
        const amount = payment.amount;

        if (!productId || !sellerUsername || !buyerUsername) {
            console.error('createHeldOrder: missing metadata, cannot create order', metadata);
            return;
        }

        // التحقق من تطابق السعر مع سعر المنتج الفعلي الحالي (حماية من التلاعب)
        let priceMismatch = false;
        let expectedPrice = null;
        try {
            const productDoc = await db.collection('products').doc(productId).get();
            if (productDoc.exists) {
                expectedPrice = productDoc.data().price;
                if (typeof expectedPrice === 'number' && Math.abs(expectedPrice - amount) > 0.0001) {
                    priceMismatch = true;
                    console.error(`createHeldOrder: PRICE MISMATCH! paid=${amount}, expected=${expectedPrice}, paymentId=${paymentId}`);
                }
            }
        } catch (e) {
            console.error('createHeldOrder: product price check failed:', e.message);
        }

        const releaseDeadline = admin.firestore.Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);

        await db.collection('orders').doc(paymentId).set({
            productId,
            productName: metadata.productName || '',
            buyerUsername,
            buyerUid: buyerUsername,
            sellerUsername,
            sellerUid: sellerUsername,
            amount,
            paymentId,
            txid,
            status: 'held',
            priceMismatch,
            expectedPrice,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            releaseDeadline
        });
        console.log('✅ Order created (held):', paymentId);
    } catch (e) {
        console.error('createHeldOrder failed:', e.response?.data || e.message);
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let { paymentId, txid } = req.body || {};
    const API_KEY = process.env.PI_API_KEY;

    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });
    if (!API_KEY) return res.status(500).json({ error: 'API Key missing' });

    const MAX_ATTEMPTS = 5;
    const DELAY_MS = 2000;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            if (!txid) {
                const info = await axios.get(
                    `https://api.minepi.com/v2/payments/${paymentId}`,
                    { headers: { Authorization: `Key ${API_KEY}` } }
                );
                txid = info.data?.transaction?.txid;
                if (!txid) return res.status(400).json({ error: 'no txid yet' });
            }

            const r = await axios.post(
                `https://api.minepi.com/v2/payments/${paymentId}/complete`,
                { txid },
                { headers: { Authorization: `Key ${API_KEY}` } }
            );
            console.log('✅ [complete.js] Completed on attempt ' + attempt + ':', r.data);

            await createHeldOrder(paymentId, txid, API_KEY);

            return res.status(200).json(r.data);
        } catch (e) {
            lastError = e.response?.data || e.message;
            console.error('❌ [complete.js] Attempt ' + attempt + ' failed (status ' + (e.response?.status || 'n/a') + '):', lastError);

            if (attempt < MAX_ATTEMPTS) {
                console.log('⏳ [complete.js] Retrying in ' + DELAY_MS + 'ms...');
                await delay(DELAY_MS);
            }
        }
    }

    return res.status(500).json({ error: lastError, attempts: MAX_ATTEMPTS });
};

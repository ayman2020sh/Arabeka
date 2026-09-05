const { admin, db } = require('./firebase');
const PiNetworkModule = require('pi-backend');
const PiNetwork = PiNetworkModule.default || PiNetworkModule;

const PLATFORM_FEE = 0.1;

function getPi() {
    const seed = process.env.PI_WALLET_PRIVATE_SEED;
    if (!seed) throw new Error('PI_WALLET_PRIVATE_SEED not set');
    return new PiNetwork(process.env.PI_API_KEY, seed);
}

// pi-backend قد يُرجع الشكل بطرق مختلفة حسب الإصدار — نتعامل مع كل الاحتمالات
function extractIncompleteList(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.incomplete_server_payments)) return result.incomplete_server_payments;
    if (result && Array.isArray(result.data)) return result.data;
    if (result && Array.isArray(result.payments)) return result.payments;
    if (result) console.warn('recoverIncomplete: unrecognized shape from getIncompleteServerPayments:', JSON.stringify(result).slice(0, 300));
    return [];
}

// إكمال أي دفعة A2U عالقة قبل إنشاء جديدة (وإلا ترفض Pi كل ما بعدها)
async function recoverIncomplete(pi) {
    let raw;
    try {
        raw = await pi.getIncompleteServerPayments();
    } catch (e) {
        console.error('recoverIncomplete: fetch failed:', e.response?.data || e.message);
        throw e;
    }

    const list = extractIncompleteList(raw);
    if (list.length === 0) return;

    console.log(`♻️ recoverIncomplete: found ${list.length} incomplete payment(s)`);

    for (const p of list) {
        try {
            let txid = p.transaction?.txid;
            if (!txid) txid = await pi.submitPayment(p.identifier);
            await pi.completePayment(p.identifier, txid);

            const orderId = p.metadata?.orderId;
            if (orderId) {
                await db.collection('orders').doc(orderId).set({
                    status: 'released',
                    payoutPaymentId: p.identifier,
                    payoutTxid: txid,
                    releasedAt: admin.firestore.FieldValue.serverTimestamp(),
                    recovered: true
                }, { merge: true });
            }
            console.log('♻️ recovered payout', p.identifier);
        } catch (e) {
            console.error('recover failed', p.identifier, e.response?.data || e.message);
            throw e; // لا نكمل: أي إنشاء جديد سيفشل على أي حال
        }
    }
}

// حجز الطلب ذرّياً: held → releasing
async function claimOrder(orderId, { requireBuyer } = {}) {
    const ref = db.collection('orders').doc(orderId);
    return db.runTransaction(async t => {
        const snap = await t.get(ref);
        if (!snap.exists) throw Object.assign(new Error('الطلب غير موجود'), { code: 'NOT_FOUND' });
        const o = snap.data();
        if (requireBuyer && o.buyerUid !== requireBuyer && o.buyerUsername !== requireBuyer)
            throw Object.assign(new Error('غير مصرح'), { code: 'FORBIDDEN' });
        if (o.status !== 'held')
            throw Object.assign(new Error(`الحالة الحالية: ${o.status}`), { code: 'NOT_HELD' });
        t.update(ref, { status: 'releasing', releaseStartedAt: admin.firestore.FieldValue.serverTimestamp() });
        return { ref, order: o };
    });
}

// التحرير الكامل مع خصم رسوم المنصة وتسجيل كل خطوة
async function releaseOrder(orderId, opts = {}) {
    const pi = getPi();
    await recoverIncomplete(pi);
    const { ref, order } = await claimOrder(orderId, opts);

    const sellerUsername = order.sellerUsername || order.sellerUid;
    const seller = await db.collection('users').doc(sellerUsername).get();
    const sellerPiUid = seller.exists ? seller.data().piUid : null;

    if (!sellerPiUid) {
        await ref.update({
            status: 'held',
            payoutAttempts: admin.firestore.FieldValue.increment(1),
            lastPayoutError: 'seller has no piUid'
        });
        throw new Error('البائع لم يسجّل دخوله بعد');
    }

    const payoutAmount = Math.round((order.amount - PLATFORM_FEE) * 1e7) / 1e7;
    if (payoutAmount <= 0) {
        await ref.update({
            status: 'held',
            payoutAttempts: admin.firestore.FieldValue.increment(1),
            lastPayoutError: 'amount too small after fee'
        });
        throw new Error('المبلغ أقل من رسوم المنصة');
    }

    let paymentId;
    try {
        paymentId = await pi.createPayment({
            amount: payoutAmount,
            memo: `Arabeka payout ${orderId.slice(0, 8)}`,
            metadata: { orderId, type: opts.auto ? 'order_release_auto' : 'order_release' },
            uid: sellerPiUid
        });
    } catch (e) {
        await ref.update({
            status: 'held',
            payoutAttempts: admin.firestore.FieldValue.increment(1),
            lastPayoutError: JSON.stringify(e.response?.data || e.message)
        });
        throw e;
    }

    // من هنا فصاعداً لا نُعيد الحالة إلى held أبداً — recoverIncomplete هو من يُكمل عند أي فشل لاحق
    await ref.update({ payoutPaymentId: paymentId });
    const txid = await pi.submitPayment(paymentId);
    await ref.update({ payoutTxid: txid });
    await pi.completePayment(paymentId, txid);
    await ref.update({
        status: 'released',
        releasedAt: admin.firestore.FieldValue.serverTimestamp(),
        releasedAutomatically: !!opts.auto,
        platformFee: PLATFORM_FEE,
        payoutAmount
    });

    return { payoutPaymentId: paymentId, txid, payoutAmount };
}

module.exports = { releaseOrder, recoverIncomplete, getPi };

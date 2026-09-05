// داخل releaseOrder في payout.js
const PLATFORM_FEE = 0.1;
const payoutAmount = Math.round((order.amount - PLATFORM_FEE) * 1e7) / 1e7;
if (payoutAmount <= 0) {
    await ref.update({ 
        status: 'held', 
        payoutAttempts: admin.firestore.FieldValue.increment(1), 
        lastPayoutError: 'amount too small' 
    });
    throw new Error('المبلغ أقل من رسوم المنصة');
}
// ثم في createPayment:
amount: payoutAmount,
// وفي التحديث الأخير أضف:
platformFee: PLATFORM_FEE, 
payoutAmount,

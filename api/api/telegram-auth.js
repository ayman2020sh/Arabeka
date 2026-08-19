// api/telegram-auth.js
// [أنا Claude] — 2026-08-19
// توثيق حقيقي لزوار تليجرام: بيتحقق من توقيع Telegram (HMAC) باستخدام BOT_TOKEN،
// وبعد التأكد إن الطلب جاي فعلاً من تليجرام (مش أي حد بيدّعي)، بيطلع Firebase
// Custom Token بنفس منطق api/auth.js — يعني uid = "tg_" + رقم المستخدم دايمًا،
// ثابت في كل مرة، مضمون رياضيًا زي حسابات Pi بالظبط.
//
// لا يحتاج أي خطة مدفوعة: دالة سيرفر عادية (نفس نوع api/auth.js)، بدون Cron
// وبدون أي استدعاء خارجي مكرر — استهلاك أقل من api/auth.js حتى.

const admin = require('firebase-admin');
const crypto = require('crypto');

// 1. تهيئة Firebase Admin (نفس الطريقة المستخدمة في api/auth.js)
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error);
    }
}

// 2. التحقق من توقيع Telegram — الخوارزمية الرسمية من توثيق Telegram Mini Apps
function validateTelegramInitData(initData, botToken) {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const pairs = [];
    for (const [key, value] of params.entries()) pairs.push([key, value]);
    pairs.sort((a, b) => a[0].localeCompare(b[0]));
    const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (computedHash !== hash) return null;

    // حماية إضافية: رفض بيانات قديمة جدًا (أكتر من 24 ساعة) لمنع إعادة استخدام توقيع قديم مسروق
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (!authDate || ageSeconds > 86400) return null;

    const userStr = params.get('user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        return null;
    }
}

module.exports = async (req, res) => {
    // إعدادات CORS (نفس الموجودة في باقي ملفات api/)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { initData } = req.body || {};
    if (!initData) {
        return res.status(400).json({ error: 'initData is required' });
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
        console.error('BOT_TOKEN environment variable is missing on this Vercel project');
        return res.status(500).json({ error: 'Server misconfiguration: BOT_TOKEN missing' });
    }

    const tgUser = validateTelegramInitData(initData, BOT_TOKEN);
    if (!tgUser || !tgUser.id) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired Telegram signature' });
    }

    const guestId = 'tg_' + tgUser.id;

    try {
        // uid = guestId دايمًا — بالظبط نفس منطق api/auth.js (uid = username)
        const customToken = await admin.auth().createCustomToken(guestId);
        res.status(200).json({ token: customToken, guestId: guestId });
    } catch (error) {
        console.error("Telegram Custom Token Creation Error:", error);
        res.status(500).json({ error: 'Failed to create session token' });
    }
};

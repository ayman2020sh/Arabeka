 const admin = require('firebase-admin');

if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
        console.error("❌ CRITICAL: FIREBASE_SERVICE_ACCOUNT environment variable is missing!");
        throw new Error('FIREBASE_SERVICE_ACCOUNT is not set in Vercel Environment Variables');
    }

    let serviceAccount;
    try {
        serviceAccount = typeof raw === 'object' ? raw : JSON.parse(raw);
    } catch (e) {
        console.error("❌ CRITICAL: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON!", e.message);
        throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    }

    if (!serviceAccount.project_id) {
        console.error("❌ CRITICAL: FIREBASE_SERVICE_ACCOUNT JSON is missing 'project_id'!");
        throw new Error('FIREBASE_SERVICE_ACCOUNT JSON missing project_id');
    }

    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase Admin initialized successfully for project:", serviceAccount.project_id);
    } catch (e) {
        console.error("❌ Firebase Admin initializeApp failed:", e.message);
        throw e;
    }
}

module.exports = { admin, db: admin.firestore() };

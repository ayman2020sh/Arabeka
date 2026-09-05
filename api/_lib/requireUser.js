const { admin } = require('./firebase');

// يتحقق من Firebase ID Token في هيدر Authorization
// يُرجع اسم المستخدم (uid) عند النجاح، أو يرمي خطأ له خاصية status عند الفشل
module.exports = async function requireUser(req) {
    const authHeader = req.headers.authorization || '';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const err = new Error('Unauthorized: No token provided');
        err.status = 401;
        throw err;
    }

    const idToken = authHeader.slice(7); // إزالة "Bearer "

    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        return decoded.uid; // = اسم مستخدم Pi (حسب نموذج المشروع)
    } catch (e) {
        console.error('requireUser: token verification failed:', e.message);
        const err = new Error('Unauthorized: Invalid or expired token');
        err.status = 401;
        throw err;
    }
};

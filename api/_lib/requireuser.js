const { admin } = require('./firebase');

module.exports = async function requireUser(req) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid; // = اسم مستخدم Pi حسب نموذجك
};

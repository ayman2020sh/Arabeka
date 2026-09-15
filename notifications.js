//==== الإشعارات =====
// التخزين: users/{username}/notifications/{id}
// الحقول: type (like/comment/purchase/released/dispute) · actor (اسم المرسل) · extra · read · createdAt
let notifSnapshotCache = null;

// بدء الاستماع (تُستدعى من loginSuccess)
function initNotifications() {
    if (!currentUser) return;
    const unsub = db.collection('users').doc(currentUser).collection('notifications')
        .orderBy('createdAt', 'desc').limit(30)
        .onSnapshot(snap => {
            notifSnapshotCache = snap;
            updateNotifBadge();
            if (document.getElementById('notif-modal') && document.getElementById('notif-modal').style.display === 'flex') renderNotifList();
        }, e => console.error('initNotifications:', e.message));
    unsubscribeFunctions.push(unsub);
}

function resetNotifications() {
    notifSnapshotCache = null;
    updateNotifBadge();
}

function unreadNotifCount() {
    if (!notifSnapshotCache) return 0;
    let n = 0;
    notifSnapshotCache.forEach(d => { if (!d.data().read) n++; });
    return n;
}

function updateNotifBadge() {
    const el = document.getElementById('notif-badge');
    if (!el) return;
    const n = unreadNotifCount();
    el.style.display = n > 0 ? 'block' : 'none';
    el.textContent = n > 99 ? '99+' : String(n);
}

// إنشاء إشعار لطرف آخر (لا يُشعر النفس أبداً)
function pushNotification(to, type, extra) {
    if (!currentUser || !to || to === currentUser) return;
    const data = {
        type: String(type || 'generic').slice(0, 20),
        actor: currentUser,
        extra: extra || {},
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('users').doc(to).collection('notifications').add(data)
        .catch(e => console.error('pushNotification:', e.message));
}

// إشعار البائع بحدث على أوردر (يقرأ بيانات الأوردر ويتسامح مع فشل القراءة)
function notifyOrderEvent(orderId, type) {
    db.collection('orders').doc(orderId).get().then(doc => {
        if (!doc.exists) return;
        const o = doc.data();
        pushNotification(o.sellerUid, type, { orderId: orderId, productName: o.productName });
    }).catch(e => console.error('notifyOrderEvent:', e.message));
}

// نص الإشعار للعرض
function notifText(n) {
    const actor = sanitizeHTML(n.actor || '');
    const extra = n.extra || {};
    const prod = extra.productName ? ': ' + sanitizeHTML(String(extra.productName)) : '';
    switch (n.type) {
        case 'like': return `❤️ ${actor} أعجب بمنشورك`;
        case 'comment': return `💬 ${actor} علّق على منشورك`;
        case 'purchase': return `🛒 ${actor} اشترى منتجك${prod}`;
        case 'released': return `💰 ${actor} أكد استلام الأوردر${prod} — تم تحويل الفلوس`;
        case 'dispute': return `⚠️ ${actor} فتح نزاع على الأوردر${prod}`;
        default: return `🔔 إشعار جديد`;
    }
}

function formatNotifTime(date) {
    if (!date) return '';
    const pad = x => (x < 10 ? '0' + x : '' + x);
    return pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear() + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function renderNotifList() {
    const el = document.getElementById('notif-list');
    if (!el) return;
    if (!notifSnapshotCache || notifSnapshotCache.empty) {
        el.innerHTML = '<p style="color:var(--text-muted); text-align:center; margin:0;">لا توجد إشعارات بعد</p>';
        return;
    }
    const items = [];
    notifSnapshotCache.forEach(d => {
        const n = d.data();
        const when = formatNotifTime(n.createdAt ? n.createdAt.toDate() : null);
        items.push(`<div style="padding:8px 6px; border-bottom:1px solid #333; ${n.read ? 'opacity:0.55;' : 'font-weight:bold;'}">
            <div>${notifText(n)}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;" data-no-i18n>${when}</div>
        </div>`);
    });
    el.innerHTML = items.join('');
}

function markAllNotifsRead() {
    if (!notifSnapshotCache || !db) return;
    const batch = db.batch();
    let changed = 0;
    notifSnapshotCache.forEach(d => {
        if (!d.data().read) { batch.update(d.ref, { read: true }); changed++; }
    });
    if (changed) batch.commit().catch(e => console.error('markAllNotifsRead:', e.message));
}

function openNotificationsPanel() {
    if (!currentUser) { showError('سجّل الدخول الأول'); return; }
    renderNotifList();
    document.getElementById('notif-modal').style.display = 'flex';
    markAllNotifsRead();
}

function closeNotifPanel() { document.getElementById('notif-modal').style.display = 'none'; }

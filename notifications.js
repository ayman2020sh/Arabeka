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
        case 'chat_message': return `💬 ${actor} أرسل رسالة جديدة في الطلب${prod}`;
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
        items.push(`<div onclick="openNotification('${escapeAttr(d.id)}')" style="padding:8px 6px; border-bottom:1px solid #333; cursor:pointer; ${n.read ? 'opacity:0.55;' : 'font-weight:bold;'}">
            <div>${notifText(n)}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;" data-no-i18n>${when}</div>
            <button onclick="event.stopPropagation(); deleteNotification('${escapeAttr(d.id)}')" style="margin-top:6px; background:none; border:0; color:var(--danger); cursor:pointer; font-size:12px;">🗑️ حذف</button>
        </div>`);
    });
    el.innerHTML = items.join('');
}

function deleteNotification(notifId) {
    if (!currentUser || !notifId) return;
    db.collection('users').doc(currentUser).collection('notifications').doc(notifId).delete()
        .catch(e => console.error('deleteNotification:', e.message));
}

function deleteAllNotifications() {
    if (!currentUser || !notifSnapshotCache || notifSnapshotCache.empty) return;
    const batch = db.batch();
    notifSnapshotCache.forEach(d => batch.delete(d.ref));
    batch.commit().catch(e => console.error('deleteAllNotifications:', e.message));
}

function openNotification(notifId) {
    if (!notifSnapshotCache) return;
    const doc = notifSnapshotCache.docs.find(d => d.id === notifId);
    if (!doc) return;
    const n = doc.data();
    if (!n.read) doc.ref.update({ read: true }).catch(e => console.error('openNotification read:', e.message));
    closeNotifPanel();
    if (n.type === 'chat_message' && n.extra && n.extra.orderId) {
        switchPage('orders');
        setTimeout(() => openOrderChat(n.extra.orderId, n.actor || 'الطرف الآخر'), 350);
    } else if (['purchase', 'released', 'dispute'].indexOf(n.type) !== -1) {
        switchPage('orders');
    } else {
        switchPage('feed');
        if ((n.type === 'like' || n.type === 'comment') && n.extra && n.extra.postId) {
            setTimeout(() => {
                const postEl = document.getElementById('post-' + n.extra.postId);
                if (!postEl) return;
                postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                postEl.style.outline = '2px solid var(--gold)';
                setTimeout(() => { postEl.style.outline = ''; }, 2500);
            }, 350);
        }
    }
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
    const list = document.getElementById('notif-list');
    if (list && !document.getElementById('delete-all-notifs-btn')) {
        const btn = document.createElement('button');
        btn.id = 'delete-all-notifs-btn';
        btn.className = 'btn';
        btn.style.cssText = 'background:var(--danger); margin:0 0 10px 0;';
        btn.textContent = '🗑️ حذف كل الإشعارات';
        btn.onclick = deleteAllNotifications;
        list.parentNode.insertBefore(btn, list);
    }
    markAllNotifsRead();
}

function closeNotifPanel() { document.getElementById('notif-modal').style.display = 'none'; }

// ===== محادثة الطلب بين المشتري والبائع =====
let activeChatOrderId = null;
let chatMessagesUnsub = null;

function ensureChatModal() {
    if (document.getElementById('order-chat-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'order-chat-modal';
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content" style="max-height:85vh; display:flex; flex-direction:column; text-align:right;">
        <h4 id="order-chat-title" style="margin-top:0; color:var(--primary);">💬 محادثة الطلب</h4>
        <div id="order-chat-messages" style="min-height:180px; max-height:45vh; overflow-y:auto; margin:8px 0; padding:8px; background:#0b0b0c; border-radius:10px;"></div>
        <textarea id="order-chat-input" rows="2" maxlength="1000" placeholder="اكتب رسالتك..."></textarea>
        <button class="btn" id="order-chat-send" onclick="sendOrderMessage()">إرسال</button>
        <button class="btn" style="background:#444;" onclick="closeOrderChat()">إغلاق</button>
    </div>`;
    document.body.appendChild(modal);
}

function openOrderChat(orderId, otherParty) {
    if (!currentUser) { showError('سجّل الدخول الأول'); return; }
    ensureChatModal();
    activeChatOrderId = orderId;
    document.getElementById('order-chat-title').textContent = '💬 محادثة الطلب مع ' + (otherParty || 'الطرف الآخر');
    document.getElementById('order-chat-input').value = '';
    document.getElementById('order-chat-modal').style.display = 'flex';
    listenToOrderMessages(orderId);
}

function listenToOrderMessages(orderId) {
    if (chatMessagesUnsub) chatMessagesUnsub();
    chatMessagesUnsub = db.collection('orders').doc(orderId).collection('messages')
        .orderBy('createdAt', 'asc').limit(100)
        .onSnapshot(snap => {
            const el = document.getElementById('order-chat-messages');
            if (!el) return;
            if (snap.empty) {
                el.innerHTML = '<p style="color:var(--text-muted); text-align:center;">لا توجد رسائل بعد</p>';
                return;
            }
            el.innerHTML = snap.docs.map(d => {
                const m = d.data();
                const mine = m.senderUsername === currentUser;
                const when = m.createdAt && m.createdAt.toDate ? formatNotifTime(m.createdAt.toDate()) : '';
                return `<div style="text-align:${mine ? 'left' : 'right'}; margin:7px 0;">
                    <div style="display:inline-block; max-width:85%; padding:8px 10px; border-radius:10px; background:${mine ? 'var(--primary-dark)' : '#25252a'};">
                        <strong style="font-size:11px; color:var(--gold);">${sanitizeHTML(m.senderUsername || '')}</strong>
                        <div style="white-space:pre-wrap; word-break:break-word;">${sanitizeHTML(m.text || '')}</div>
                        <small style="color:var(--text-muted);">${when}</small>
                    </div>
                </div>`;
            }).join('');
            el.scrollTop = el.scrollHeight;
        }, e => {
            console.error('listenToOrderMessages:', e.message);
            const el = document.getElementById('order-chat-messages');
            if (el) el.innerHTML = '<p style="color:var(--danger); text-align:center;">تعذر تحميل المحادثة</p>';
        });
}

async function sendOrderMessage() {
    const input = document.getElementById('order-chat-input');
    const btn = document.getElementById('order-chat-send');
    const text = input && input.value.trim();
    if (!activeChatOrderId || !text || !currentUser) return;
    btn.disabled = true;
    try {
        const orderRef = db.collection('orders').doc(activeChatOrderId);
        const orderDoc = await orderRef.get();
        if (!orderDoc.exists) throw new Error('الطلب غير موجود');
        const order = orderDoc.data();
        if (order.buyerUid !== currentUser && order.sellerUid !== currentUser) throw new Error('غير مصرح لك بهذا الطلب');
        const recipient = order.buyerUid === currentUser ? order.sellerUsername : order.buyerUsername;
        await orderRef.collection('messages').add({
            senderUsername: currentUser,
            recipientUsername: recipient || '',
            text: text.slice(0, 1000),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        input.value = '';
        pushNotification(recipient, 'chat_message', { orderId: activeChatOrderId, productName: order.productName || '' });
    } catch (e) {
        console.error('sendOrderMessage:', e.message);
        showError('تعذر إرسال الرسالة: ' + e.message);
    } finally { btn.disabled = false; }
}

function closeOrderChat() {
    const modal = document.getElementById('order-chat-modal');
    if (modal) modal.style.display = 'none';
    if (chatMessagesUnsub) { chatMessagesUnsub(); chatMessagesUnsub = null; }
    activeChatOrderId = null;
}

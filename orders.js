// ===== طلباتي (حالات + نزاعات) ===== 
// ================= الطلبات =================
function formatOrderStatus(status) {
    switch (status) {
        case 'completing': return { text: '🔄 جارٍ تأكيد الدفع', color: 'var(--text-muted)' };
        case 'held': return { text: '⏳ محجوز - في انتظار التأكيد', color: 'var(--gold)' };
        case 'releasing': return { text: '🔄 جارٍ التحويل للبائع', color: 'var(--text-muted)' };
        case 'released': return { text: '✅ تم التحويل للبائع', color: 'var(--success)' };
        case 'disputed': return { text: '⚠️ نزاع مفتوح', color: 'var(--danger)' };
        case 'refunded': return { text: '↩️ تم الاسترداد للمشتري', color: 'var(--success)' };
        default: return { text: status || '—', color: 'var(--text-muted)' };
    }
}

function renderOrderCard(order, orderId, isBuyer) {
    const st = formatOrderStatus(order.status);
    const otherParty = isBuyer ? order.sellerUsername : order.buyerUsername;
    const otherLabel = isBuyer ? 'البائع' : 'المشتري';
    const amount = Number(order.amount) || 0;
    const net = Math.round((amount - PLATFORM_FEE) * 1e7) / 1e7;
    const sellerNet = !isBuyer ? `<p style="margin:0 0 4px 0; font-size:12px; color:var(--text-muted);">صافي بعد رسوم المنصة (${PLATFORM_FEE}): <strong style="color:var(--gold);">${net} Pi</strong></p>` : '';
    let actionsHtml = '';
    if (isBuyer && order.status === 'held') {
        actionsHtml = `
            <div style="display:flex; gap:8px; margin-top:10px;">
                <button class="btn" style="margin:0; flex:1; background: var(--success);" onclick="confirmOrderReceipt('${escapeAttr(orderId)}', this)">✅ تأكيد الاستلام</button>
                <button class="btn" style="margin:0; flex:1; background:#444;" onclick="openOrderDispute('${escapeAttr(orderId)}')">⚠️ فتح نزاع</button>
            </div>`;
    }
    return `
        <div class="card">
            <p style="margin:0 0 4px 0; font-weight:bold; color:var(--text-color);">${sanitizeHTML(order.productName || 'منتج')}</p>
            <p style="margin:0 0 4px 0; font-size:13px; color:var(--text-muted);">${otherLabel}: ${sanitizeHTML(otherParty || '—')}</p>
            <p style="margin:0 0 4px 0; font-size:13px; color:var(--primary); font-weight:bold;">${amount} Pi</p>
            ${sellerNet}
            <p style="margin:0; font-size:13px; color:${st.color}; font-weight:bold;">${st.text}</p>
            ${actionsHtml}
        </div>`;
}

function sortByCreated(docs) {
    return docs.slice().sort((a, b) => (b.data().createdAt ? b.data().createdAt.toMillis() : 0) - (a.data().createdAt ? a.data().createdAt.toMillis() : 0));
}

function loadMyOrders() {
    const purchasesEl = document.getElementById('my-purchases-list');
    const salesEl = document.getElementById('my-sales-list');
    if (!purchasesEl || !salesEl) return;

    const unsubBuy = db.collection('orders').where('buyerUid', '==', currentUser).onSnapshot(snap => {
        purchasesEl.innerHTML = snap.empty
            ? '<p style="color:var(--text-muted); text-align:center; margin:0;">لا توجد مشتريات بعد</p>'
            : sortByCreated(snap.docs).map(d => renderOrderCard(d.data(), d.id, true)).join('');
    }, e => {
        console.error('loadMyOrders (purchases):', e.message);
        purchasesEl.innerHTML = `<p style="color:var(--danger); font-size:12px; text-align:center;">تعذر تحميل المشتريات (${sanitizeHTML(e.code || e.message)})</p>`;
    });

    const unsubSell = db.collection('orders').where('sellerUid', '==', currentUser).onSnapshot(snap => {
        salesEl.innerHTML = snap.empty
            ? '<p style="color:var(--text-muted); text-align:center; margin:0;">لا توجد مبيعات بعد</p>'
            : sortByCreated(snap.docs).map(d => renderOrderCard(d.data(), d.id, false)).join('');
    }, e => {
        console.error('loadMyOrders (sales):', e.message);
        salesEl.innerHTML = `<p style="color:var(--danger); font-size:12px; text-align:center;">تعذر تحميل المبيعات (${sanitizeHTML(e.code || e.message)})</p>`;
    });

    unsubscribeFunctions.push(unsubBuy, unsubSell);
}

async function confirmOrderReceipt(orderId, btnEl) {
    if (!confirm('تأكيد إنك استلمت المنتج/الخدمة؟ الفلوس هتتحول للبائع (بعد خصم رسوم المنصة ' + PLATFORM_FEE + ' Pi) وده إجراء نهائي.')) return;
    if (btnEl) { btnEl.disabled = true; btnEl.innerText = '⏳ جارٍ التحويل...'; }
    try {
        const idToken = await getIdToken();
        const res = await fetch('/api/release-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
            body: JSON.stringify({ orderId })
        });
        const data = await res.json().catch(() => ({ error: 'رد غير متوقع من الخادم (' + res.status + ')' }));
        if (!res.ok) throw new Error(data.error || 'فشل التحرير');
        alert('تم تأكيد الاستلام وتحويل الفلوس للبائع ✅');
    } catch (e) {
        console.error('confirmOrderReceipt error:', e.message);
        showError('تعذر إتمام العملية: ' + e.message);
        if (btnEl) { btnEl.disabled = false; btnEl.innerText = '✅ تأكيد الاستلام'; }
    }
}

function openOrderDispute(orderId) {
    const reason = prompt('اكتب سبب فتح النزاع بإيجاز:');
    if (!reason || !reason.trim()) return;
    db.collection('orders').doc(orderId).update({
        status: 'disputed',
        disputeReason: reason.trim().slice(0, 1000),
        disputedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => alert('تم فتح النزاع، هيتم مراجعته من فريق الدعم.'))
      .catch(e => showError('تعذر فتح النزاع: ' + e.message));
}


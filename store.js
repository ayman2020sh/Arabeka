// ===== المتجر + الشراء (Pi Payments) ===== 
// ================= المتجر =================
function getCategoryNameArabic(cat) {
    switch (cat) {
        case 'tech': return '💻 تقني';
        case 'entertainment': return '🎮 ترفيهي';
        case 'services': return '🛠️ خدمي';
        case 'industrial': return '🏭 صناعي';
        default: return '🛒 منتج';
    }
}

// null/undefined = غير محدود
function qtyLabel(q) { return (typeof q === 'number') ? (q > 0 ? 'متوفر: ' + q : 'نفذت الكمية') : 'متوفر'; }
function isOutOfStock(q) { return typeof q === 'number' && q <= 0; }

function showMyProducts() {
    window.showOnlyMyProducts = true;
    window.storeFilterOwner = currentUser;
    const banner = document.getElementById('store-filter-banner');
    banner.querySelector('span').innerText = '📌 بيتم عرض منتجاتك بس';
    banner.style.display = 'flex';
    switchPage('store', true);
    filterStoreProducts(window.currentCategoryFilter);
}
function clearStoreFilter() {
    window.showOnlyMyProducts = false;
    window.storeFilterOwner = null;
    document.getElementById('store-filter-banner').style.display = 'none';
    filterStoreProducts(window.currentCategoryFilter);
}

function filterStoreProducts(category) {
    window.currentCategoryFilter = category;
    document.querySelectorAll('#page-store .category-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`#page-store .category-btn[onclick="filterStoreProducts('${category}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    document.querySelectorAll('#store-products .product-card').forEach(card => {
        const categoryMatch = (category === 'all' || card.getAttribute('data-category') === category);
        const ownerMatch = (!window.showOnlyMyProducts || card.getAttribute('data-owner') === (window.storeFilterOwner || currentUser));
        card.style.display = (categoryMatch && ownerMatch) ? 'block' : 'none';
    });
}

function readProductForm(prefix) {
    const name = document.getElementById(prefix + '-name').value.trim();
    const price = Math.round(parseFloat(document.getElementById(prefix + '-price').value) * 1e7) / 1e7;
    const qtyRaw = document.getElementById(prefix + '-qty').value.trim();
    const quantity = qtyRaw === '' ? null : parseInt(qtyRaw, 10);
    const category = document.getElementById(prefix + '-category').value;
    const imageUrl = document.getElementById(prefix + '-image').value.trim();
    const description = document.getElementById(prefix + '-description').value.trim();
    if (!name) { showError("اكتب اسم المنتج"); return null; }
    if (isNaN(price) || price <= PLATFORM_FEE) { showError("السعر يجب أن يكون أكبر من " + PLATFORM_FEE + " Pi (رسوم المنصة)"); return null; }
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) { showError("الكمية يجب أن تكون رقماً صحيحاً"); return null; }
    if (imageUrl && !sanitizeURL(imageUrl)) { showError("رابط الصورة غير صالح"); return null; }
    return { name, price, quantity, category, imageUrl: imageUrl || null, description: description || null };
}

function clearProductForm(prefix, defaultCat) {
    ['-name', '-price', '-qty', '-image', '-description'].forEach(s => document.getElementById(prefix + s).value = '');
    document.getElementById(prefix + '-category').value = defaultCat || 'tech';
}

function addNewProduct() {
    if (!authUid) { showError("لسه بيجهز الاتصال الآمن، حاول تاني بعد ثانية"); return; }
    const data = readProductForm('new-prod');
    if (!data) return;
    const btn = document.getElementById('add-prod-btn');
    btn.disabled = true;
    db.collection("products").add({
        ...data, owner: currentUser, ownerUid: authUid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => { clearProductForm('new-prod'); alert('تم عرض منتجك للبيع ✅'); })
    .catch(e => showError("تعذر إضافة المنتج: " + e.message))
    .finally(() => btn.disabled = false);
}

function loadProducts() {
    const unsubscribe = db.collection("products").orderBy("timestamp", "desc").limit(30).onSnapshot(snapshot => {
        lastProductsSnapshot = snapshot;
        renderProductsFeed();
    }, e => console.error('loadProducts:', e.message));
    unsubscribeFunctions.push(unsubscribe);
}

function renderProductsFeed() {
    if (!lastProductsSnapshot) return;
    const store = document.getElementById('store-products');
    const fragments = [];
    window.productsMap = {};

    lastProductsSnapshot.forEach(doc => {
        const prod = doc.data();
        const prodId = doc.id;
        window.productsMap[prodId] = { ...prod, id: prodId };

        const safeImg = sanitizeURL(prod.imageUrl);
        const prodCategory = prod.category || 'tech';
        const imgHtml = safeImg ? `<img src="${safeImg}" class="prod-image" onerror="this.style.display='none'">` : '';
        const badgeHtml = isKnownAdmin(prod.owner) ? `<span class="official-badge">⚜️ ارابيكا</span>` : '';
        fetchAdminStatusAndRerender(prod.owner);
        const out = isOutOfStock(prod.quantity);
        const isMine = prod.owner === currentUser;

        const ownerBtns = isMine ? `
            <button class="btn" onclick="openEditProductModal('${escapeAttr(prodId)}')" style="background-color: #eab308; color: black; padding: 8px; flex: 1; font-size: 13px; margin: 0;">تعديل</button>
            <button class="btn" onclick="deleteProduct('${escapeAttr(prodId)}')" style="background-color: var(--danger); padding: 8px; flex: 1; font-size: 13px; margin: 0;">حذف</button>` : '';
        const buyBtn = isMine ? '' : `<button class="btn" onclick="buyProduct('${escapeAttr(prodId)}')" ${out ? 'disabled' : ''} style="background: ${out ? '#444' : 'linear-gradient(90deg, var(--primary-dark), var(--primary))'}; padding: 8px; flex: 1.5; font-size: 13px; margin: 0;">${out ? 'نفذت' : 'شراء'}</button>`;

        fragments.push(`
            <div class="product-card" data-category="${escapeAttr(prodCategory)}" data-owner="${escapeAttr(prod.owner)}">
                <span class="product-category-tag">${getCategoryNameArabic(prodCategory)}</span>
                ${imgHtml}
                <h4 style="margin: 10px 0 5px 0; font-size: 18px;">${sanitizeHTML(prod.name)}</h4>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">بواسطة: ${sanitizeHTML(prod.owner)} <br>${badgeHtml}</p>
                <p style="color: var(--primary); font-weight: bold; font-size: 16px; margin: 5px 0;">${Number(prod.price)} Pi</p>
                <p style="font-size: 12px; color: ${out ? 'var(--danger)' : 'var(--text-muted)'}; margin: 0 0 5px 0;">${qtyLabel(prod.quantity)}</p>
                <div style="display: flex; gap: 5px; margin-top: 10px; width: 100%;">
                    <button class="btn" onclick="openProductDetails('${escapeAttr(prodId)}')" style="background: #3b82f6; padding: 8px; flex: 1.5; font-size: 13px; margin: 0;">تفاصيل</button>
                    ${buyBtn}
                    ${ownerBtns}
                </div>
            </div>`);
    });
    store.innerHTML = fragments.join('') || '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted);">لا توجد منتجات بعد</p>';
    filterStoreProducts(window.currentCategoryFilter);
}

function openProductDetails(id) {
    const p = window.productsMap[id];
    if (!p) return;
    const img = document.getElementById('det-img');
    img.src = sanitizeURL(p.imageUrl) || '';
    img.style.display = sanitizeURL(p.imageUrl) ? 'block' : 'none';
    document.getElementById('det-name').innerText = p.name || '';
    document.getElementById('det-price').innerText = Number(p.price) + ' Pi';
    document.getElementById('det-cat').innerText = getCategoryNameArabic(p.category || 'tech');
    document.getElementById('det-owner').innerText = p.owner || '';
    document.getElementById('det-qty').innerText = typeof p.quantity === 'number' ? p.quantity : 'غير محدود';
    const descWrap = document.getElementById('det-desc-wrap');
    if (p.description) { document.getElementById('det-desc').innerText = p.description; descWrap.style.display = 'block'; }
    else descWrap.style.display = 'none';

    const buyBtn = document.getElementById('det-buy-btn');
    const out = isOutOfStock(p.quantity);
    const mine = p.owner === currentUser;
    buyBtn.disabled = out || mine;
    buyBtn.innerText = mine ? 'هذا منتجك' : (out ? 'نفذت الكمية' : 'إتمام الشراء');
    buyBtn.onclick = () => { closeProductDetails(); buyProduct(id); };
    document.getElementById('productDetailsModal').style.display = 'flex';
}
function closeProductDetails() { document.getElementById('productDetailsModal').style.display = 'none'; }

function openEditProductModal(id) {
    const p = window.productsMap[id];
    if (!p) return;
    editingStoreProdId = id;
    document.getElementById('edit-prod-name').value = p.name || '';
    document.getElementById('edit-prod-price').value = p.price;
    document.getElementById('edit-prod-qty').value = typeof p.quantity === 'number' ? p.quantity : '';
    document.getElementById('edit-prod-category').value = p.category || 'tech';
    document.getElementById('edit-prod-image').value = p.imageUrl || '';
    document.getElementById('edit-prod-description').value = p.description || '';
    document.getElementById('editProductModal').style.display = 'flex';
}
function closeEditProductModal() { document.getElementById('editProductModal').style.display = 'none'; editingStoreProdId = null; }

function saveEditedProduct() {
    if (!editingStoreProdId) return;
    const data = readProductForm('edit-prod');
    if (!data) return;
    db.collection("products").doc(editingStoreProdId).update(data)
        .then(closeEditProductModal)
        .catch(e => showError("خطأ في تعديل المنتج: " + e.message));
}

function deleteProduct(id) {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج نهائياً؟")) return;
    db.collection("products").doc(id).delete().catch(e => showError("تعذر الحذف: " + e.message));
}

// ================= الشراء (Pi Payments) =================
// المعامل الوحيد هو المعرّف — بقية البيانات تُقرأ من productsMap (حماية من XSS)
function buyProduct(productId) {
    const p = window.productsMap[productId];
    if (!p) { showError("المنتج غير متاح"); return; }
    const { name, price, owner: sellerUsername } = p;

    if (typeof Pi === 'undefined') { showError("نظام Pi غير متاح هنا"); return; }
    if (sellerUsername === currentUser) { showError("مينفعش تشتري منتجك بنفسك"); return; }
    if (isOutOfStock(p.quantity)) { showError("نفذت الكمية"); return; }
    if (!piReady) {
        try { Pi.init({ version: "2.0", sandbox: false }); piReady = true; }
        catch (e) { showError("جاري الاتصال بشبكة Pi، يرجى المحاولة بعد ثانية..."); return; }
    }

    const post = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(res => res.json().catch(() => ({})).then(data => ({ ok: res.ok, status: res.status, data })));

    try {
        Pi.createPayment({
            amount: Number(price),
            memo: ('Arabeka: ' + name).slice(0, 28),
            metadata: { productId, productName: name, sellerUsername, buyerUsername: currentUser }
        }, {
            onReadyForServerApproval: function (paymentId) {
                post('/api/approve', { paymentId }).then(({ ok, data }) => {
                    if (!ok) {
                        const msg = typeof data.error === 'string' ? data.error : (data.error && data.error.message) || 'رفض السيرفر الطلب';
                        console.error('approve rejected:', msg);
                        showError("لم تتم الموافقة على الدفع: " + msg);
                    }
                }).catch(e => showError("فشل الاتصال للموافقة: " + e.message));
            },
            onReadyForServerCompletion: function (paymentId, txid) {
                post('/api/complete', { paymentId, txid }).then(({ ok, data }) => {
                    if (ok) alert("تم الدفع بنجاح! الفلوس محجوزة لحد ما تأكد استلامك من صفحة \"طلباتي\".");
                    else {
                        const msg = typeof data.error === 'string' ? data.error : (data.error && data.error.message) || '';
                        console.error('complete failed:', msg);
                        showError("تم الدفع لكن تعذر تأكيده الآن، سيُستكمل تلقائياً عند فتح التطبيق. " + msg);
                    }
                }).catch(e => showError("خطأ السيرفر: " + e.message));
            },
            onCancel: function (paymentId) { console.log("إلغاء:", paymentId); },
            onError: function (error, payment) {
                console.error('Pi payment error:', error && error.message, payment && payment.identifier);
                showError("خطأ في الدفع: " + (error && error.message ? error.message : 'خطأ في الشبكة'));
            }
        });
    } catch (e) { showError("خطأ: " + e.message); }
}


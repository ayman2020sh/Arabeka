// ====== الدوال المفقودة من index.html ======

// تنسيق عنوان المحفظة
function formatWalletAddress(addr) {
    if (!addr) return 'لم يتم تعيين';
    if (addr.length <= 16) return addr;
    return addr.substring(0, 8) + '...' + addr.substring(addr.length - 8);
}

// الحصول على شارة الولاء بناءً على النقاط
function getLoyaltyBadge(points) {
    if (points >= 500) return '🏆 ماسي';
    if (points >= 300) return '💎 ذهبي';
    if (points >= 100) return '🥈 فضي';
    if (points >= 50) return '🥉 برونزي';
    if (points >= 10) return '⭐ نجم';
    return '';
}

// التنقل بين الصفحات
function switchPage(pageName, skipNavUpdate) {
    document.querySelectorAll('#main-app .page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + pageName);
    if (page) page.classList.add('active');
    
    if (!skipNavUpdate) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        const navBtn = document.querySelector(`.nav-item[data-page="${pageName}"]`);
        if (navBtn) navBtn.classList.add('active');
    }
}

// تحميل المنشورات
function loadPosts() {
    const unsubscribe = db.collection('posts').orderBy('timestamp', 'desc').onSnapshot(snap => {
        lastPostsSnapshot = snap;
        renderPostsFeed();
    }, error => {
        console.error('loadPosts error:', error);
    });
    unsubscribeFunctions.push(unsubscribe);
}

// عرض المنشورات بناءً على الفلتر
function renderPostsFeed() {
    const el = document.getElementById('posts-feed');
    if (!el || !lastPostsSnapshot) return;
    
    let docs = lastPostsSnapshot.docs;
    
    // تطبيق فلتر التصنيف
    if (window.currentFeedCategoryFilter !== 'all') {
        docs = docs.filter(d => d.data().category === window.currentFeedCategoryFilter);
    }
    
    // تطبيق فلتر "منشوراتي فقط"
    if (showOnlyMyPosts) {
        docs = docs.filter(d => d.data().author === currentUser);
    }
    
    if (docs.length === 0) {
        el.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">لا توجد منشورات</p>';
        return;
    }
    
    const frags = [];
    docs.forEach(doc => {
        const p = doc.data();
        const safeImg = sanitizeURL(p.imageUrl);
        const isAuthor = p.author === currentUser;
        const adminIcon = isKnownAdmin(p.author) ? ' ⚜️' : '';
        
        frags.push(`
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="cursor:pointer;" onclick="viewUserProfile('${escapeAttr(p.author)}')">
                        <strong style="color:var(--primary);">${sanitizeHTML(p.author)}${adminIcon}</strong>
                    </div>
                    ${isAuthor ? `<button class="small-btn" onclick="deletePost('${doc.id}')">🗑️</button>` : ''}
                </div>
                <div class="card-content">${sanitizeHTML(p.content || '')}</div>
                ${safeImg ? `<img src="${safeImg}" class="post-image" style="width:100%; border-radius:8px; margin:8px 0;" onerror="this.style.display='none';">` : ''}
                <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">
                    ${p.timestamp ? new Date(p.timestamp.toMillis()).toLocaleDateString('ar') : 'حديث'}
                </div>
            </div>
        `);
    });
    
    el.innerHTML = frags.join('');
}

// نشر منشور جديد
function publishPost() {
    const content = document.getElementById('post-text').value.trim();
    const category = document.getElementById('post-category').value;
    const imageUrl = document.getElementById('post-image-url').value.trim();
    
    if (!content) {
        showError('الرجاء كتابة المنشور');
        return;
    }
    
    const safeImage = imageUrl ? sanitizeURL(imageUrl) : '';
    
    db.collection('posts').add({
        author: currentUser,
        content: content,
        category: category,
        imageUrl: safeImage,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ownerUid: authUid
    }).then(() => {
        document.getElementById('post-text').value = '';
        document.getElementById('post-image-url').value = '';
        document.getElementById('post-category').value = 'general';
        showError('✓ تم نشر المنشور');
        awardTaskOnce('firstPost', 10);
    }).catch(e => showError('خطأ: ' + e.message));
}

// حذف منشور
function deletePost(postId) {
    if (!confirm('هل متأكد من حذف المنشور؟')) return;
    db.collection('posts').doc(postId).delete()
        .catch(e => showError('خطأ بالحذف'));
}

// تحميل المنتجات
function loadProducts() {
    const unsubscribe = db.collection('products').onSnapshot(snap => {
        window.allProducts = snap.docs;
        renderStoreProducts('all');
    }, error => console.error('loadProducts error:', error));
    unsubscribeFunctions.push(unsubscribe);
}

// عرض المنتجات بناءً على الفلتر
function renderStoreProducts(category) {
    const el = document.getElementById('store-products');
    if (!el) return;
    
    let docs = window.allProducts || [];
    
    if (category !== 'all') {
        docs = docs.filter(d => d.data().category === category);
    }
    
    if (window.showOnlyMyProducts) {
        docs = docs.filter(d => d.data().owner === window.storeFilterOwner);
    }
    
    if (docs.length === 0) {
        el.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted);">لا توجد منتجات</p>';
        return;
    }
    
    const frags = [];
    docs.forEach(doc => {
        const p = doc.data();
        const safeImg = sanitizeURL(p.imageUrl);
        const isOwner = p.owner === currentUser;
        
        frags.push(`
            <div class="product-card" onclick="showProductDetails('${doc.id}', '${escapeAttr(p.name)}', '${escapeAttr(p.price)}', '${escapeAttr(p.category)}', '${escapeAttr(p.owner)}', '${safeImg}', '${escapeAttr(p.description)}')">
                <div class="product-image" style="background-image: url('${safeImg}'); background-size: cover; background-position: center; width:100%; height:120px; border-radius:8px;"></div>
                <h4 style="margin:8px 0; color:var(--text-color);">${sanitizeHTML(p.name)}</h4>
                <p style="margin:0; color:var(--gold); font-weight:bold;">${p.price} Pi</p>
                <p style="margin:4px 0; font-size:12px; color:var(--text-muted);">${sanitizeHTML(p.owner)}</p>
                ${isOwner ? `<button class="small-btn" onclick="event.stopPropagation(); editProduct('${doc.id}')">✏️</button>` : ''}
            </div>
        `);
    });
    
    el.innerHTML = frags.join('');
}

// تصفية منتجات المتجر
function filterStoreProducts(category) {
    window.currentCategoryFilter = category;
    document.querySelectorAll('#page-store .category-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`#page-store .category-btn[onclick="filterStoreProducts('${category}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    renderStoreProducts(category);
}

// إضافة منتج جديد
function addNewProduct() {
    const name = document.getElementById('new-prod-name').value.trim();
    const price = parseFloat(document.getElementById('new-prod-price').value);
    const category = document.getElementById('new-prod-category').value;
    const image = document.getElementById('new-prod-image').value.trim();
    const description = document.getElementById('new-prod-description').value.trim();
    
    if (!name || !price || price <= 0) {
        showError('الرجاء ملء البيانات المطلوبة');
        return;
    }
    
    const safeImage = image ? sanitizeURL(image) : '';
    
    db.collection('products').add({
        owner: currentUser,
        name: name,
        price: price,
        category: category,
        imageUrl: safeImage,
        description: description,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ownerUid: authUid
    }).then(() => {
        document.getElementById('new-prod-name').value = '';
        document.getElementById('new-prod-price').value = '';
        document.getElementById('new-prod-category').value = 'tech';
        document.getElementById('new-prod-image').value = '';
        document.getElementById('new-prod-description').value = '';
        showError('✓ تم إضافة المنتج');
    }).catch(e => showError('خطأ: ' + e.message));
}

// عرض تفاصيل المنتج
function showProductDetails(id, name, price, category, owner, img, desc) {
    document.getElementById('det-name').innerText = name;
    document.getElementById('det-img').src = img || '';
    document.getElementById('det-price').innerText = price + ' Pi';
    document.getElementById('det-cat').innerText = category;
    document.getElementById('det-owner').innerText = owner;
    document.getElementById('det-buy-btn').innerText = currentUser === owner ? 'هذا منتجك' : 'إتمام الشراء';
    document.getElementById('det-buy-btn').style.pointerEvents = currentUser === owner ? 'none' : 'auto';
    
    if (desc) {
        document.getElementById('det-desc').innerText = desc;
        document.getElementById('det-desc-wrap').style.display = 'block';
    } else {
        document.getElementById('det-desc-wrap').style.display = 'none';
    }
    
    document.getElementById('productDetailsModal').style.display = 'flex';
}

// إغلاق تفاصيل المنتج
function closeProductDetails() {
    document.getElementById('productDetailsModal').style.display = 'none';
}

// تحميل قائمة الطلبات
function loadMyOrders() {
    // سيتم تنفيذها عند الحاجة
}

// تحميل طلبات الصداقة الواردة
function loadIncomingFriendRequests() {
    const unsubscribe = db.collection('friendRequests')
        .where('recipient', '==', currentUser)
        .where('status', '==', 'pending')
        .onSnapshot(snap => {
            const listEl = document.getElementById('incoming-requests-list');
            if (!listEl) return;
            
            if (snap.empty) {
                listEl.innerHTML = '<p style="color: var(--text-muted); font-size:13px; text-align:center; margin:0;">لا توجد طلبات حالياً</p>';
                return;
            }
            
            const frags = [];
            snap.forEach(doc => {
                const req = doc.data();
                frags.push(`
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border);">
                        <span onclick="viewUserProfile('${escapeAttr(req.sender)}')" style="cursor:pointer; color:var(--primary);">${sanitizeHTML(req.sender)}</span>
                        <div style="gap:8px; display:flex;">
                            <button class="small-btn" onclick="respondFriendRequest('${doc.id}', 'accept')">✓</button>
                            <button class="small-btn" onclick="respondFriendRequest('${doc.id}', 'reject')">✗</button>
                        </div>
                    </div>
                `);
            });
            listEl.innerHTML = frags.join('');
        });
    
    unsubscribeFunctions.push(unsubscribe);
}

// الرد على طلب صداقة
function respondFriendRequest(reqId, response) {
    const status = response === 'accept' ? 'accepted' : 'rejected';
    db.collection('friendRequests').doc(reqId).update({ status })
        .catch(e => showError('خطأ: ' + e.message));
}

// إظهار المتابعين
function showFollowers() {
    db.collection('follows').where('target', '==', currentUser).get()
        .then(snap => openListModal('المتابعين', snap.docs.map(d => d.data().follower)))
        .catch(() => showError('خطأ بالتحميل'));
}

// إظهار من أتابعهم
function showFollowing() {
    db.collection('follows').where('follower', '==', currentUser).get()
        .then(snap => openListModal('الحسابات اللي بتتابعها', snap.docs.map(d => d.data().target)))
        .catch(() => showError('خطأ بالتحميل'));
}

// إظهار منتجاتي
function showMyProducts() {
    window.showOnlyMyProducts = true;
    window.storeFilterOwner = currentUser;
    const banner = document.getElementById('store-filter-banner');
    if (banner) {
        banner.querySelector('span').innerText = '📌 منتجاتك فقط';
        banner.style.display = 'flex';
    }
    switchPage('store', true);
    renderStoreProducts('all');
}

// مسح فلتر المنتجات
function clearStoreFilter() {
    window.showOnlyMyProducts = false;
    const banner = document.getElementById('store-filter-banner');
    if (banner) banner.style.display = 'none';
    renderStoreProducts(window.currentCategoryFilter || 'all');
}

// مسح فلتر المنشورات
function clearPostsFilter() {
    showOnlyMyPosts = false;
    document.getElementById('posts-filter-banner').style.display = 'none';
    renderPostsFeed();
}

// فتح نافذة قائمة
function openListModal(title, usernames) {
    document.getElementById('list-modal-title').innerText = title;
    const body = document.getElementById('list-modal-body');
    body.innerHTML = usernames.map(u => 
        `<div style="padding:8px; border-bottom:1px solid var(--border); cursor:pointer;" onclick="viewUserProfile('${escapeAttr(u)}')">${sanitizeHTML(u)}</div>`
    ).join('');
    document.getElementById('list-modal').style.display = 'flex';
}

// إغلاق نافذة القائمة
function closeListModal() {
    document.getElementById('list-modal').style.display = 'none';
}

// البحث عن المستخدمين
function searchUsers() {
    const input = document.getElementById('user-search-input').value.trim();
    if (!input) {
        document.getElementById('search-results').style.display = 'none';
        return;
    }
    
    db.collection('users').orderBy('__name__').startAt(input).endAt(input + '\uf8ff').limit(10).get()
        .then(snap => {
            const resultsEl = document.getElementById('search-results');
            if (snap.empty) {
                resultsEl.innerHTML = '<p style="color:var(--text-muted);">لا توجد نتائج</p>';
                resultsEl.style.display = 'block';
                return;
            }
            
            const frags = [];
            snap.forEach(doc => {
                const u = doc.id;
                frags.push(`
                    <div style="padding:12px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                        <div onclick="viewUserProfile('${escapeAttr(u)}')" style="cursor:pointer; flex:1;">
                            <strong style="color:var(--primary);">${sanitizeHTML(u)}</strong>
                        </div>
                        <button class="small-btn" onclick="sendFriendRequest('${escapeAttr(u)}')">➕</button>
                    </div>
                `);
            });
            resultsEl.innerHTML = frags.join('');
            resultsEl.style.display = 'block';
        })
        .catch(e => showError('خطأ بالبحث'));
}

// إرسال طلب صداقة
function sendFriendRequest(recipient) {
    if (recipient === currentUser) {
        showError('لا يمكنك إضافة نفسك');
        return;
    }
    
    const reqId = friendRequestId(currentUser, recipient);
    db.collection('friendRequests').doc(reqId).set({
        sender: currentUser,
        recipient: recipient,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        showError('✓ تم إرسال طلب الصداقة');
    }).catch(e => showError('خطأ: ' + e.message));
}

// دعوة الأصدقاء
function inviteFriends() {
    const link = window.location.href;
    const text = `انضم معي على أرابيكا - مجتمع التجارة الرقمية! ${link}`;
    
    if (navigator.share) {
        navigator.share({ title: 'أرابيكا', text });
    } else {
        alert('رابط الدعوة:\n' + link);
    }
}

// متابعة/إلغاء متابعة
function toggleFollow(targetUser, followEl, onResult) {
    const followId = `${currentUser}_${targetUser}`;
    db.collection('follows').doc(followId).get().then(doc => {
        if (doc.exists) {
            db.collection('follows').doc(followId).delete()
                .then(() => {
                    if (onResult) onResult(false);
                })
                .catch(e => showError('خطأ'));
        } else {
            db.collection('follows').doc(followId).set({
                follower: currentUser,
                target: targetUser,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                awardTaskOnce('firstFollow', 5);
                if (onResult) onResult(true);
            }).catch(e => showError('خطأ'));
        }
    });
}

// تحديث الواجبة التدريبية
function awardTaskOnce(taskKey, points) {
    db.collection('users').doc(currentUser).get().then(doc => {
        const tasks = (doc.exists ? doc.data().tasksCompleted : {}) || {};
        if (!tasks[taskKey]) {
            tasks[taskKey] = true;
            const loyaltyPoints = (doc.exists ? doc.data().loyaltyPoints : 0) || 0;
            db.collection('users').doc(currentUser).set({
                tasksCompleted: tasks,
                loyaltyPoints: loyaltyPoints + points,
                ownerUid: authUid
            }, { merge: true });
        }
    });
}

// تحرير منتج للتعديل
function editProduct(productId) {
    db.collection('products').doc(productId).get().then(doc => {
        if (!doc.exists) return;
        const p = doc.data();
        document.getElementById('edit-prod-name').value = p.name;
        document.getElementById('edit-prod-price').value = p.price;
        document.getElementById('edit-prod-category').value = p.category;
        document.getElementById('edit-prod-image').value = p.imageUrl || '';
        document.getElementById('edit-prod-description').value = p.description || '';
        window.editingProductId = productId;
        document.getElementById('editProductModal').style.display = 'flex';
    });
}

// حفظ تعديل المنتج
function saveEditedProduct() {
    const name = document.getElementById('edit-prod-name').value.trim();
    const price = parseFloat(document.getElementById('edit-prod-price').value);
    const category = document.getElementById('edit-prod-category').value;
    const image = document.getElementById('edit-prod-image').value.trim();
    const description = document.getElementById('edit-prod-description').value.trim();
    
    if (!name || !price || price <= 0) {
        showError('البيانات غير صحيحة');
        return;
    }
    
    db.collection('products').doc(window.editingProductId).update({
        name, price, category, imageUrl: image, description
    }).then(() => {
        showError('✓ تم تحديث المنتج');
        closeEditProductModal();
    }).catch(e => showError('خطأ: ' + e.message));
}

// إغلاق نافذة تعديل المنتج
function closeEditProductModal() {
    document.getElementById('editProductModal').style.display = 'none';
    window.editingProductId = null;
}

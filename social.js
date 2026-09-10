// ===== ملفات الأعضاء: متابعة + أصدقاء + بحث ===== 
// ================= الملف الشخصي العام =================
let viewedProfileUser = null;
let previousPageBeforeProfile = 'feed';

function friendRequestId(userA, userB) { return [userA, userB].sort().join('__'); }

function viewUserProfile(username) {
    if (!username || username === currentUser) { switchPage('profile'); return; }
    viewedProfileUser = username;
    const navActive = document.querySelector('.nav-item.active');
    previousPageBeforeProfile = navActive ? navActive.getAttribute('data-page') : 'feed';

    document.getElementById('uprofile-name-text').innerText = username;
    const av = document.getElementById('uprofile-avatar');
    av.style.backgroundImage = 'none';
    av.innerText = username.charAt(0).toUpperCase();
    document.getElementById('uprofile-bio').innerText = '—';
    document.getElementById('uprofile-loyalty-badge').innerText = '';
    document.getElementById('uprofile-verified-badge').style.display = 'none';
    document.getElementById('uprofile-posts').innerHTML = '';

    db.collection('users').doc(username).get().then(doc => {
        if (!doc.exists) return;
        const d = doc.data();
        if (d.avatarUrl) {
            const safe = sanitizeURL(d.avatarUrl);
            if (safe) { av.style.backgroundImage = `url('${safe}')`; av.innerText = ''; }
        }
        if (d.bio) document.getElementById('uprofile-bio').innerText = d.bio;
        const points = d.loyaltyPoints || 0;
        const badge = getLoyaltyBadge(points);
        document.getElementById('uprofile-loyalty-badge').innerText = badge ? (badge + ' · ' + points + ' نقطة') : (points + ' نقطة');
        if (d.isAdmin === true) document.getElementById('uprofile-verified-badge').style.display = 'inline-block';
    }).catch(() => {});

    db.collection('follows').where('follower', '==', username).get().then(s => document.getElementById('uprofile-following-count').innerText = s.size).catch(() => {});
    db.collection('follows').where('target', '==', username).get().then(s => document.getElementById('uprofile-followers-count').innerText = s.size).catch(() => {});
    db.collection('products').where('owner', '==', username).get().then(s => document.getElementById('uprofile-products-count').innerText = s.size).catch(() => {});
    db.collection('posts').where('author', '==', username).get().then(s => {
        document.getElementById('uprofile-posts-count').innerText = s.size;
        const frags = [];
        s.forEach(d => {
            const p = d.data();
            const safeImg = sanitizeURL(p.imageUrl);
            frags.push(`<div class="card"><div class="card-content">${sanitizeHTML(p.content || '')}</div>${safeImg ? `<img src="${safeImg}" class="post-image" onerror="this.style.display='none'">` : ''}</div>`);
        });
        document.getElementById('uprofile-posts').innerHTML = frags.join('') || '<p style="color:var(--text-muted); text-align:center;">لا توجد منشورات بعد</p>';
    }).catch(() => {});

    db.collection('follows').doc(`${currentUser}_${username}`).get().then(doc => {
        document.getElementById('uprofile-follow-btn').innerText = doc.exists ? '✓ متابَع' : '➕ متابعة';
    }).catch(e => console.error('follow-status read error:', e.message));

    refreshFriendButtonState();

    document.querySelectorAll('#main-app .page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-user-profile').classList.add('active');
    window.scrollTo(0, 0);
}

function closeUserProfile() { viewedProfileUser = null; switchPage(previousPageBeforeProfile || 'feed'); }

function uprofileToggleFollow() {
    if (!viewedProfileUser) return;
    toggleFollow(viewedProfileUser, null, isNow => {
        document.getElementById('uprofile-follow-btn').innerText = isNow ? '✓ متابَع' : '➕ متابعة';
    });
}

function showUserFollowing() {
    if (!viewedProfileUser) return;
    db.collection('follows').where('follower', '==', viewedProfileUser).get()
        .then(snap => openListModal('الحسابات اللي بيتابعها', snap.docs.map(d => d.data().target)))
        .catch(() => showError('تعذر تحميل القائمة'));
}
function showUserFollowers() {
    if (!viewedProfileUser) return;
    db.collection('follows').where('target', '==', viewedProfileUser).get()
        .then(snap => openListModal('المتابعين', snap.docs.map(d => d.data().follower)))
        .catch(() => showError('تعذر تحميل القائمة'));
}
function showUserProducts() {
    if (!viewedProfileUser) return;
    window.showOnlyMyProducts = true;
    window.storeFilterOwner = viewedProfileUser;
    const banner = document.getElementById('store-filter-banner');
    if (banner) { banner.querySelector('span').innerText = '📌 بيتم عرض منتجات ' + viewedProfileUser + ' فقط'; banner.style.display = 'flex'; }
    switchPage('store', true);
    filterStoreProducts(window.currentCategoryFilter || 'all');
}

function refreshFriendButtonState() {
    if (!viewedProfileUser) return;
    const btn = document.getElementById('uprofile-friend-btn');
    const reqId = friendRequestId(currentUser, viewedProfileUser);
    const resetBtn = () => { btn.innerText = '🤝 إضافة صديق'; btn.onclick = uprofileHandleFriendAction; btn.className = 'btn'; btn.style.background = ''; };
    db.collection('friendRequests').doc(reqId).get().then(doc => {
        if (!doc.exists) { resetBtn(); return; }
        const d = doc.data();
        if (d.status === 'accepted') {
            btn.innerText = '✅ أصدقاء'; btn.style.background = 'var(--success)'; btn.onclick = null;
        } else if (d.status === 'pending' && d.from === currentUser) {
            btn.innerText = '⏳ تم إرسال الطلب'; btn.style.background = '#444';
            btn.onclick = () => db.collection('friendRequests').doc(reqId).delete().then(refreshFriendButtonState).catch(e => showError('تعذر إلغاء الطلب: ' + e.message));
        } else if (d.status === 'pending' && d.to === currentUser) {
            btn.innerText = '✔️ قبول طلب الصداقة'; btn.style.background = 'var(--success)';
            btn.onclick = () => db.collection('friendRequests').doc(reqId).update({ status: 'accepted' }).then(refreshFriendButtonState).catch(e => showError('تعذر قبول الطلب: ' + e.message));
        }
    }).catch(e => { console.error('refreshFriendButtonState:', e.message); resetBtn(); });
}

function uprofileHandleFriendAction() {
    if (!viewedProfileUser || !authUid) { showError('لسه بيجهز الاتصال الآمن، حاول تاني بعد ثانية'); return; }
    const reqId = friendRequestId(currentUser, viewedProfileUser);
    db.collection('friendRequests').doc(reqId).set({
        from: currentUser, to: viewedProfileUser, fromUid: authUid, status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(refreshFriendButtonState).catch(e => showError('تعذر إرسال طلب الصداقة: ' + e.message));
}

function loadIncomingFriendRequests() {
    const unsub = db.collection('friendRequests').where('to', '==', currentUser).where('status', '==', 'pending').onSnapshot(snap => {
        const list = document.getElementById('incoming-requests-list');
        if (!list) return;
        if (snap.empty) { list.innerHTML = '<p style="color: var(--text-muted); font-size:13px; text-align:center; margin:0;">لا توجد طلبات حالياً</p>'; return; }
        list.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            return `
                <div class="friend-request-row">
                    <span style="flex:1; cursor:pointer;" onclick="viewUserProfile('${escapeAttr(d.from)}')">${sanitizeHTML(d.from)}</span>
                    <button class="small-action-btn accept" onclick="respondFriendRequest('${escapeAttr(doc.id)}', true)">قبول</button>
                    <button class="small-action-btn outline" onclick="respondFriendRequest('${escapeAttr(doc.id)}', false)">رفض</button>
                </div>`;
        }).join('');
    }, (error) => {
        console.error('loadIncomingFriendRequests:', error.message);
        const list = document.getElementById('incoming-requests-list');
        if (list) list.innerHTML = `<p style="color: var(--danger); font-size:12px; text-align:center; margin:0;">تعذر تحميل الطلبات (${sanitizeHTML(error.code || error.message)})</p>`;
    });
    unsubscribeFunctions.push(unsub);
}

function respondFriendRequest(reqId, accept) {
    const ref = db.collection('friendRequests').doc(reqId);
    (accept ? ref.update({ status: 'accepted' }) : ref.delete())
        .catch(e => showError((accept ? 'تعذر قبول الطلب: ' : 'تعذر رفض الطلب: ') + e.message));
}

function searchUsers() {
    const term = document.getElementById('user-search-input').value.trim();
    const resultsEl = document.getElementById('search-results');
    if (!term) { resultsEl.style.display = 'none'; return; }
    db.collection('users').orderBy(firebase.firestore.FieldPath.documentId()).startAt(term).endAt(term + '\uf8ff').limit(20).get()
        .then(snap => {
            resultsEl.style.display = 'block';
            const frags = [];
            snap.forEach(doc => {
                if (doc.id === currentUser) return;
                const d = doc.data();
                const safeAvatar = d.avatarUrl ? sanitizeURL(d.avatarUrl) : '';
                const initial = safeAvatar ? '' : doc.id.charAt(0).toUpperCase();
                frags.push(`
                    <div class="user-result-row">
                        <div class="user-result-avatar" style="${safeAvatar ? `background-image:url('${safeAvatar}');` : ''}" onclick="viewUserProfile('${escapeAttr(doc.id)}')">${initial}</div>
                        <span class="user-result-name" onclick="viewUserProfile('${escapeAttr(doc.id)}')">${sanitizeHTML(doc.id)}</span>
                        <button class="small-action-btn" onclick="viewUserProfile('${escapeAttr(doc.id)}')">عرض الملف</button>
                    </div>`);
            });
            resultsEl.innerHTML = frags.join('') || '<p style="color: var(--text-muted); text-align:center; margin:0;">لا يوجد نتائج</p>';
        })
        .catch(() => showError('تعذر البحث حالياً'));
}

function inviteFriends() {
    const shareText = 'انضم لي على أرابيكا 🎗 — مجتمع تجارة وتواصل عبر شبكة Pi Network';
    const shareUrl = window.location.origin;
    if (navigator.share) navigator.share({ title: 'أرابيكا', text: shareText, url: shareUrl }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(shareText + '\n' + shareUrl).then(() => alert('تم نسخ رابط الدعوة!')).catch(() => showError('تعذر النسخ'));
    else showError('المشاركة غير مدعومة على هذا المتصفح');
}

function toggleFollow(author, btnEl, callback) {
    if (!author || author === currentUser) return;
    const ref = db.collection('follows').doc(`${currentUser}_${author}`);
    ref.get().then(doc => {
        if (doc.exists) return ref.delete().then(() => false);
        return ref.set({
            follower: currentUser, followerUid: authUid, target: author,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => { awardTaskOnce('firstFollow', 5); return true; });
    }).then(isNow => {
        if (btnEl) btnEl.innerText = isNow ? '✓ متابَع' : '➕ متابعة';
        if (typeof callback === 'function') callback(isNow);
    }).catch(e => showError('خطأ في المتابعة: ' + e.message));
}

function openListModal(title, list) {
    document.getElementById('list-modal-title').innerText = title;
    const body = document.getElementById('list-modal-body');
    body.innerHTML = list.length
        ? list.map(u => `<div class="comment" style="cursor:pointer;" onclick="closeListModal(); viewUserProfile('${escapeAttr(u)}')">${sanitizeHTML(u)}</div>`).join('')
        : '<p style="color: var(--text-muted); text-align:center;">لا يوجد بيانات بعد</p>';
    document.getElementById('list-modal').style.display = 'flex';
}
function closeListModal() { document.getElementById('list-modal').style.display = 'none'; }

function showFollowing() {
    db.collection('follows').where('follower', '==', currentUser).get()
        .then(snap => openListModal('الحسابات اللي بتتابعها', snap.docs.map(d => d.data().target)))
        .catch(() => showError('تعذر تحميل القائمة'));
}
function showFollowers() {
    db.collection('follows').where('target', '==', currentUser).get()
        .then(snap => openListModal('المتابعين', snap.docs.map(d => d.data().follower)))
        .catch(() => showError('تعذر تحميل القائمة'));
}


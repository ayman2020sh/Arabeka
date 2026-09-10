// ===== الملف الشخصي (بياناتي + مهامي) ===== 
// ================= الملف الشخصي =================
const TASKS_LIST = [
    { key: 'completeBio', label: 'أكمل نبذتك الشخصية', points: 5 },
    { key: 'firstPost', label: 'انشر أول منشور', points: 10 },
    { key: 'firstFollow', label: 'تابع أول شخص', points: 5 }
];

function renderTasksList(tasksCompleted) {
    const el = document.getElementById('tasks-list');
    if (!el) return;
    const done = tasksCompleted || {};
    el.innerHTML = TASKS_LIST.map(t => {
        const isDone = !!done[t.key];
        const style = isDone ? 'color: var(--text-muted); text-decoration: line-through;' : '';
        return '<div style="' + style + '">' + (isDone ? '✅' : '⬜') + ' ' + sanitizeHTML(t.label) + ' (+' + t.points + ')</div>';
    }).join('');
}

function getLoyaltyBadge(points) {
    const p = points || 0;
    if (p >= 500) return '🥇 عضو أساسي';
    if (p >= 200) return '🥈 عضو مميز';
    if (p >= 50) return '🥉 عضو نشط';
    return '';
}

function loadUserBio() {
    const unsubscribe = db.collection("users").doc(currentUser).onSnapshot(doc => {
        const d = doc.exists ? doc.data() : {};
        if (d.bio) document.getElementById('user-bio').innerText = d.bio;
        applyAvatarToCircle(d.avatarUrl || null);
        applyNavAvatar(d.avatarUrl || null);
        const points = d.loyaltyPoints || 0;
        const badge = getLoyaltyBadge(points);
        const badgeEl = document.getElementById('user-loyalty-badge');
        if (badgeEl) badgeEl.innerText = badge ? (badge + ' · ' + points + ' نقطة') : (points + ' نقطة');
        renderTasksList(d.tasksCompleted);
        const isAdminUser = d.isAdmin === true;
        const vb = document.getElementById('user-verified-badge');
        if (vb) vb.style.display = isAdminUser ? 'inline-block' : 'none';
        if (isAdminUser) adminStatusCache[currentUser] = true;
    }, e => console.error('loadUserBio error:', e.message));
    unsubscribeFunctions.push(unsubscribe);
}

let activeCallback = null;
function openCustomModal(title, val1, cb) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-input-1').value = val1 || '';
    document.getElementById('custom-modal').style.display = 'flex';
    activeCallback = cb;
}
function closeModal() { document.getElementById('custom-modal').style.display = 'none'; activeCallback = null; }
function saveModal() {
    const v1 = document.getElementById('modal-input-1').value.trim();
    if (!v1) { showError("الحقل مطلوب"); return; }
    if (activeCallback) activeCallback(v1);
    closeModal();
}

function editBio() {
    const currentBio = document.getElementById('user-bio').innerText;
    openCustomModal("تعديل النبذة", currentBio === 'user-unknown' ? '' : currentBio, (newBio) => {
        document.getElementById('user-bio').innerText = newBio;
        db.collection("users").doc(currentUser).set({ bio: newBio, ownerUid: authUid }, { merge: true })
            .then(() => awardTaskOnce('completeBio', 5))
            .catch(e => showError("خطأ بالحفظ: " + e.message));
    });
}

function applyAvatarToCircle(url) {
    const circle = document.getElementById('user-avatar-circle');
    if (!circle) return;
    const safeUrl = sanitizeURL(url);
    if (safeUrl) { circle.style.backgroundImage = `url('${safeUrl}')`; circle.childNodes[0].nodeValue = ''; }
    else { circle.style.backgroundImage = 'none'; circle.childNodes[0].nodeValue = 'A'; }
}

function applyNavAvatar(url) {
    const el = document.getElementById('nav-avatar-circle');
    if (!el) return;
    const safeUrl = sanitizeURL(url);
    if (safeUrl) { el.style.backgroundImage = `url('${safeUrl}')`; el.innerText = ''; }
    else { el.style.backgroundImage = 'none'; el.innerText = currentUser ? currentUser.charAt(0).toUpperCase() : 'A'; }
}

function editAvatar() {
    openCustomModal("رابط صورة الحساب", "", (newUrl) => {
        const safeUrl = sanitizeURL(newUrl);
        if (!safeUrl) { showError("الرابط غير صالح — لازم يبدأ بـ http:// أو https://"); return; }
        applyAvatarToCircle(newUrl);
        db.collection("users").doc(currentUser).set({ avatarUrl: newUrl, ownerUid: authUid }, { merge: true })
            .catch(e => showError("خطأ بحفظ الصورة: " + e.message));
    });
}

function loadProfileStats() {
    const unsubFollowing = db.collection('follows').where('follower', '==', currentUser).onSnapshot(snap => {
        document.getElementById('following-count').innerText = snap.size;
    }, e => console.error('following listen:', e.message));
    const unsubFollowers = db.collection('follows').where('target', '==', currentUser).onSnapshot(snap => {
        document.getElementById('followers-count').innerText = snap.size;
    }, e => console.error('followers listen:', e.message));
    const unsubPostsCount = db.collection('posts').where('author', '==', currentUser).onSnapshot(snap => {
        document.getElementById('posts-count').innerText = snap.size;
        const listEl = document.getElementById('my-posts-list');
        if (!listEl) return;
        if (snap.empty) { listEl.innerHTML = '<p style="color:var(--text-muted); text-align:center; margin:0;">لا توجد منشورات بعد</p>'; return; }
        const docs = snap.docs.slice().sort((a, b) => (b.data().timestamp ? b.data().timestamp.toMillis() : 0) - (a.data().timestamp ? a.data().timestamp.toMillis() : 0));
        listEl.innerHTML = docs.map(doc => {
            const p = doc.data();
            const safeImg = sanitizeURL(p.imageUrl);
            return `<div class="card"><div class="card-content">${sanitizeHTML(p.content || '')}</div>${safeImg ? `<img src="${safeImg}" class="post-image" onerror="this.style.display='none'">` : ''}</div>`;
        }).join('');
    }, (error) => {
        console.error('my-posts listen error:', error.message);
        const listEl = document.getElementById('my-posts-list');
        if (listEl) listEl.innerHTML = `<p style="color: var(--danger); font-size:12px; text-align:center;">تعذر تحميل المنشورات (${sanitizeHTML(error.code || error.message)})</p>`;
    });
    const unsubMyProducts = db.collection('products').where('owner', '==', currentUser).onSnapshot(snap => {
        const el = document.getElementById('my-products-count');
        if (el) el.innerText = snap.size;
    }, e => console.error('my-products listen:', e.message));
    unsubscribeFunctions.push(unsubFollowing, unsubFollowers, unsubPostsCount, unsubMyProducts);
}


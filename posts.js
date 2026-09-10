// ===== المنشورات ===== 
// ================= المنشورات =================
function filterFeedPosts(category) {
    window.currentFeedCategoryFilter = category;
    document.querySelectorAll('#page-feed .category-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`#page-feed .category-btn[onclick="filterFeedPosts('${category}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    renderPostsFeed();
}
function showMyPosts() { showOnlyMyPosts = true; document.getElementById('posts-filter-banner').style.display = 'flex'; switchPage('feed'); renderPostsFeed(); }
function clearPostsFilter() { showOnlyMyPosts = false; document.getElementById('posts-filter-banner').style.display = 'none'; renderPostsFeed(); }

function publishPost() {
    if (!authUid) { showError("لسه بيجهز الاتصال الآمن، حاول تاني بعد ثانية"); return; }
    const text = document.getElementById('post-text').value.trim();
    const imageUrl = document.getElementById('post-image-url').value.trim();
    const category = document.getElementById('post-category').value;
    if (!text && !imageUrl) { showError("أضف نصاً أو صورة"); return; }
    const btn = document.getElementById('publish-btn');
    btn.disabled = true;
    db.collection("posts").add({
        author: currentUser, authorUid: authUid, content: text, imageUrl: imageUrl || null,
        category: category || 'general', likes: 0, likedBy: [], comments: [], edited: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        document.getElementById('post-text').value = "";
        document.getElementById('post-text').style.height = 'auto';
        document.getElementById('post-image-url').value = "";
        document.getElementById('post-category').value = "general";
        awardLoyaltyPoints(2);
        awardTaskOnce('firstPost', 10);
    }).catch(e => showError("خطأ النشر: " + e.message))
    .finally(() => btn.disabled = false);
}

function awardLoyaltyPoints(amount) {
    if (!authUid || !currentUser) return;
    db.collection("users").doc(currentUser).set({
        loyaltyPoints: firebase.firestore.FieldValue.increment(amount), ownerUid: authUid
    }, { merge: true }).catch(e => console.error("Loyalty points error:", e.message));
}

function awardTaskOnce(taskKey, points) {
    if (!authUid || !currentUser) return;
    const userRef = db.collection("users").doc(currentUser);
    userRef.get().then(doc => {
        if (doc.exists && doc.data().tasksCompleted && doc.data().tasksCompleted[taskKey]) return;
        const update = { ownerUid: authUid, loyaltyPoints: firebase.firestore.FieldValue.increment(points) };
        update['tasksCompleted.' + taskKey] = true;
        return userRef.set(update, { merge: true });
    }).catch(e => console.error("Task award error:", e.message));
}

function loadPosts() {
    const unsubscribe = db.collection("posts").orderBy("timestamp", "desc").limit(30).onSnapshot(snapshot => {
        lastPostsSnapshot = snapshot;
        renderPostsFeed();
    }, e => console.error('loadPosts:', e.message));
    unsubscribeFunctions.push(unsubscribe);
}

function renderPostsFeed() {
    if (!lastPostsSnapshot) return;
    const feed = document.getElementById('posts-feed');
    const fragments = [];

    lastPostsSnapshot.forEach(doc => {
        const post = doc.data();
        const postId = doc.id;
        if (showOnlyMyPosts && post.author !== currentUser) return;
        if (window.currentFeedCategoryFilter !== 'all' && (post.category || 'general') !== window.currentFeedCategoryFilter) return;

        const safeImg = sanitizeURL(post.imageUrl);
        const imgHtml = safeImg ? `<img src="${safeImg}" class="post-image" onerror="this.style.display='none'">` : '';
        const commentsHtml = (post.comments || []).map(c => `<div class="comment"><strong>${sanitizeHTML(c.user)}:</strong> ${sanitizeHTML(c.text)}</div>`).join('');
        const isMine = post.author === currentUser;
        const delBtn = isMine ? `<button class="action-btn danger" onclick="deletePost('${escapeAttr(postId)}')">🗑️</button>` : '';
        const followBtn = post.author && !isMine ? `<button class="action-btn follow-author-btn" data-author="${escapeAttr(post.author)}">➕ متابعة</button>` : '';
        const escText = escapeAttr(post.content || '');
        const escImg = escapeAttr(post.imageUrl || '');
        const editBtn = isMine ? `<button class="action-btn edit-post-btn" data-post-id="${escapeAttr(postId)}" data-post-text="${escText}" data-post-image="${escImg}">✏️ تعديل</button>` : '';
        const editedTag = post.edited ? ' <span style="color:var(--text-muted); font-size:12px;">(معدّل)</span>' : '';

        const authorIsGuest = post.author && post.author.indexOf('tg_') === 0;
        const authorDisplay = authorIsGuest ? ('زائر تلجرام #' + post.author.slice(3)) : (post.author || 'مجهول');
        const guestBadge = authorIsGuest ? ' <span style="background:#0088cc; color:#fff; font-size:10px; padding:2px 6px; border-radius:8px;">TG</span>' : '';
        const authorVerifiedBadge = (!authorIsGuest && isKnownAdmin(post.author)) ? ' <span class="official-badge">⚜️ ارابيكا</span>' : '';

        fetchAdminStatusAndRerender(post.author);
        fetchAvatarAndRerender(post.author);
        const authorAvatarHtml = `<div class="post-avatar-circle" style="${avatarStyleFor(post.author)}">${authorIsGuest && !avatarCache[post.author] ? '🫥' : avatarInitialFor(post.author)}</div>`;
        const liked = post.likedBy && post.likedBy.indexOf(authUid) !== -1;

        fragments.push(`
            <div class="card">
                <div class="post-header">
                    <span class="post-author-link" onclick="viewUserProfile('${escapeAttr(post.author)}')">
                        ${authorAvatarHtml}
                        <span class="post-author">${sanitizeHTML(authorDisplay)}${guestBadge}${authorVerifiedBadge}</span>
                    </span>
                    <div style="display:flex; gap:8px; align-items:center;">${followBtn}${delBtn}</div>
                </div>
                <div class="card-content">${sanitizeHTML(post.content)}${editedTag}</div>
                ${imgHtml}
                <div class="post-actions">
                    <button class="action-btn" onclick="likePost('${escapeAttr(postId)}')">${liked ? '❤️' : '🤍'} ${post.likes || 0}</button>
                    <button class="action-btn" onclick="toggleComments('comments-${escapeAttr(postId)}')">💬 تعليقات (${(post.comments || []).length})</button>
                    <button class="action-btn share-post-btn" data-post-text="${escText}">🔗 مشاركة</button>
                    ${editBtn}
                </div>
                <div id="comments-${escapeAttr(postId)}" class="comments-section">
                    ${commentsHtml}
                    <div style="display:flex; gap:5px; margin-top:10px;">
                        <input type="text" id="new-comment-${escapeAttr(postId)}" placeholder="اكتب تعليقاً..." maxlength="500" style="margin-bottom:0;">
                        <button class="btn" style="width:auto; margin:0; padding:10px;" onclick="addComment('${escapeAttr(postId)}')">إرسال</button>
                    </div>
                </div>
            </div>`);
    });
    feed.innerHTML = fragments.join('') || '<p style="color:var(--text-muted); text-align:center; padding:20px;">لا توجد منشورات</p>';
    attachPostButtonListeners();
}

function attachPostButtonListeners() {
    document.querySelectorAll('.share-post-btn').forEach(btn => btn.addEventListener('click', function () { sharePost(this.dataset.postText); }));
    document.querySelectorAll('.edit-post-btn').forEach(btn => btn.addEventListener('click', function () { openEditPost(this.dataset.postId, this.dataset.postText, this.dataset.postImage); }));
    document.querySelectorAll('.follow-author-btn').forEach(btn => btn.addEventListener('click', function () { toggleFollow(this.dataset.author, this); }));
}

function sharePost(text) {
    const shareText = text || '';
    if (navigator.share) navigator.share({ title: 'أرابيكا', text: shareText, url: window.location.href }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(shareText + '\n' + window.location.href).then(() => alert('تم نسخ المنشور')).catch(() => showError('تعذر النسخ'));
    else showError('المشاركة مش مدعومة');
}

function openEditPost(postId, currentText, currentImage) {
    editingPostId = postId;
    document.getElementById('edit-post-text').value = currentText || '';
    document.getElementById('edit-post-image').value = currentImage || '';
    document.getElementById('edit-post-modal').style.display = 'flex';
}
function closeEditPostModal() { document.getElementById('edit-post-modal').style.display = 'none'; editingPostId = null; }
function saveEditPost() {
    const text = document.getElementById('edit-post-text').value.trim();
    const imageUrl = document.getElementById('edit-post-image').value.trim();
    if (!text && !imageUrl) { showError("أضف نصاً أو صورة"); return; }
    if (!editingPostId) return;
    db.collection("posts").doc(editingPostId).update({ content: text, imageUrl: imageUrl || null, edited: true })
        .then(closeEditPostModal).catch(e => showError("خطأ في التعديل: " + e.message));
}

function deletePost(id) {
    if (!confirm("حذف المنشور؟")) return;
    db.collection("posts").doc(id).delete().catch(e => showError("تعذر الحذف: " + e.message));
}

function likePost(id) {
    if (!authUid) { showError("لسه بيجهز الاتصال الآمن، حاول تاني بعد ثانية"); return; }
    const postRef = db.collection("posts").doc(id);
    postRef.get().then(doc => {
        if (!doc.exists) return;
        const alreadyLiked = (doc.data().likedBy || []).indexOf(authUid) !== -1;
        return postRef.update({
            likes: firebase.firestore.FieldValue.increment(alreadyLiked ? -1 : 1),
            likedBy: alreadyLiked ? firebase.firestore.FieldValue.arrayRemove(authUid) : firebase.firestore.FieldValue.arrayUnion(authUid)
        });
    }).catch(e => showError("خطأ في الإعجاب: " + e.message));
}

function toggleComments(id) { const el = document.getElementById(id); el.style.display = el.style.display === 'block' ? 'none' : 'block'; }

function addComment(id) {
    const input = document.getElementById(`new-comment-${id}`);
    const text = input.value.trim();
    if (!text) return;
    db.collection("posts").doc(id).update({
        comments: firebase.firestore.FieldValue.arrayUnion({ user: currentUser, text: text, at: Date.now() })
    }).then(() => { input.value = ''; }).catch(e => showError("تعذر إضافة التعليق: " + e.message));
}


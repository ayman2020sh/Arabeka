
// ===== الملف الشخصي (بياناتي + تعدين ARA) ===== 
// ================= الملف الشخصي =================
// ================= تعدين ARA (محاكاة — إنفاذ الـ24 ساعة من الخادم /api/mine) =================
const MINE_REWARD = 3.14;
const MINE_COOLDOWN_MS = 24 * 3600 * 1000;
let mineLastMs = 0;
let mineTimer = null;

function fmtMineRemaining(ms) {
    if (ms <= 0) return '';
    const totalMin = Math.ceil(ms / 60000);
    if (totalMin < 1) return 'أقل من دقيقة';
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    return h > 0 ? (h + ' س ' + m + ' د') : (m + ' د');
}

function renderMineState(d) {
    const btn = document.getElementById('mine-btn');
    const balEl = document.getElementById('mine-balance');
    const stEl = document.getElementById('mine-status');
    if (!btn || !balEl || !stEl) return;
    const balance = Math.round((d.araBalance || 0) * 100) / 100;
    balEl.textContent = '⛏️ رصيدك: ' + balance + ' ARA';
    mineLastMs = d.lastMineAt ? d.lastMineAt.toMillis() : 0;
    const remain = mineLastMs ? (mineLastMs + MINE_COOLDOWN_MS - Date.now()) : 0;
    if (remain <= 0) {
        btn.disabled = false;
        btn.textContent = '⛏️ عدّن الآن';
        stEl.textContent = '+' + MINE_REWARD + ' ARA كل 24 ساعة';
        if (mineTimer) { clearInterval(mineTimer); mineTimer = null; }
        return;
    }
    btn.disabled = true;
    stEl.textContent = '⏳ جاهز بعد ' + fmtMineRemaining(remain);
    if (!mineTimer) {
        mineTimer = setInterval(() => {
            const b = document.getElementById('mine-btn');
            const el = document.getElementById('mine-status');
            if (!b || !el) return;
            const left = mineLastMs + MINE_COOLDOWN_MS - Date.now();
            if (left <= 0) {
                b.disabled = false;
                b.textContent = '⛏️ عدّن الآن';
                el.textContent = '+' + MINE_REWARD + ' ARA كل 24 ساعة';
                clearInterval(mineTimer); mineTimer = null;
            } else {
                el.textContent = '⏳ جاهز بعد ' + fmtMineRemaining(left);
            }
        }, 30000);
    }
}

async function startMining() {
    const btn = document.getElementById('mine-btn');
    if (!btn || btn.disabled || !authUid) return;
    btn.disabled = true;
    btn.textContent = '⛏️ جارٍ التعدين...';
    try {
        const idToken = await getIdToken();
        const res = await fetch('/api/mine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'فشل التعدين');
        const balEl = document.getElementById('mine-balance');
        const stEl = document.getElementById('mine-status');
        if (balEl) balEl.textContent = '⛏️ رصيدك: ' + (Math.round((data.balance || 0) * 100) / 100) + ' ARA';
        if (stEl) stEl.textContent = '✅ تم التعدين: +' + data.reward + ' ARA';
        btn.textContent = '✅ تم';
        // الحالة النهائية تتحدث تلقائياً من onSnapshot (lastMineAt/araBalance)
    } catch (e) {
        console.error('startMining error:', e.message);
        showError('تعذر التعدين: ' + e.message);
        btn.disabled = false;
        btn.textContent = '⛏️ عدّن الآن';
    }
}

// اختصار عنوان المحفظة للعرض
function shortenWallet(addr) {
    if (!addr) return '';
    if (addr.length <= 14) return addr;
    return addr.slice(0, 6) + '…' + addr.slice(-4);
}

// صف المحفظة — يُنشأ تلقائياً (يستبدل سطر «تاريخ الانضمام» القديم)
const WALLET_ROW_HTML =
    'المحفظة: <span id="user-wallet" style="color: var(--text-muted); direction: ltr; display: inline-block;">غير مرتبطة</span>' +
    ' <a href="javascript:void(0)" id="wallet-link" onclick="linkWalletNow();return false;" style="color: var(--primary); font-size: 13px; text-decoration: underline; margin-inline-start: 6px;">🔗 ربط المحفظة</a>' +
    ' <a href="javascript:void(0)" id="wallet-manual" onclick="manualWalletEntry();return false;" style="color: var(--primary); font-size: 13px; text-decoration: underline; margin-inline-start: 6px;">✍️ إدخال يدوي</a>' +
    ' <span id="wallet-note" style="display: none; font-size: 12px; margin-inline-start: 6px;"></span>';

let walletNoticeTimer = null;

function ensureWalletRow() {
    const existing = document.getElementById('user-wallet');
    if (existing) {
        // الصف موجود مسبقاً في index.html (بدون أزرار) — نُكمل الأزرار فقط
        if (!document.getElementById('wallet-link') && existing.parentElement) {
            existing.parentElement.innerHTML = WALLET_ROW_HTML;
        }
        return;
    }
    const ps = document.querySelectorAll('#page-profile p');
    for (let i = 0; i < ps.length; i++) {
        if (ps[i].textContent && ps[i].textContent.indexOf('تاريخ الانضمام') !== -1) {
            ps[i].innerHTML = WALLET_ROW_HTML;
            return;
        }
    }
    // احتياط: لو لم يوجد سطر تاريخ الانضمام، نضيف الصف بعد النبذة
    const bio = document.getElementById('user-bio');
    if (bio && bio.parentElement) {
        const p = document.createElement('p');
        p.style.cssText = 'color: var(--text-muted); font-size: 14px; margin: 6px 0 0 0;';
        p.innerHTML = WALLET_ROW_HTML;
        bio.parentElement.appendChild(p);
    }
}

function renderUserWallet(wallet) {
    ensureWalletRow();
    const el = document.getElementById('user-wallet');
    const link = document.getElementById('wallet-link');
    if (!el) return;
    if (wallet) {
        el.textContent = shortenWallet(wallet);
        el.title = wallet;
        el.style.color = 'var(--success, #22c55e)';
        if (link) link.style.display = 'none';
        const manual = document.getElementById('wallet-manual');
        if (manual) manual.style.display = 'none';
    } else {
        el.textContent = 'غير مرتبطة';
        el.title = '';
        el.style.color = 'var(--text-muted)';
        if (link) link.style.display = 'inline';
        const manual2 = document.getElementById('wallet-manual');
        if (manual2) manual2.style.display = 'inline';
    }
}

// رسالة قصيرة بجانب صف المحفظة (نجاح/خطأ)
function walletNotice(message, ok) {
    const el = document.getElementById('wallet-note');
    if (!el) return;
    el.textContent = message;
    el.style.color = ok ? 'var(--success, #22c55e)' : 'var(--danger)';
    el.style.display = 'inline';
    if (walletNoticeTimer) clearTimeout(walletNoticeTimer);
    walletNoticeTimer = setTimeout(() => { el.style.display = 'none'; }, 9000);
}

// إدخال عنوان المحفظة يدوياً (احتياطي عندما لا يمنح Pi الإذن)
function manualWalletEntry() {
    const el = document.getElementById('user-wallet');
    const current = (el && el.title) ? el.title : '';
    const input = prompt('أدخل عنوان محفظتك (56 حرفاً يبدأ بحرف G):', current);
    if (input === null || input === undefined) return;
    const addr = String(input).trim();
    if (!addr) return;
    if (!/^G[A-Z2-7]{55}$/.test(addr)) {
        walletNotice('العنوان غير صحيح — لازم يبدأ بحرف G ويكون 56 حرفاً', false);
        return;
    }
    if (!currentUser) { walletNotice('لازم تسجل الدخول الأول', false); return; }
    db.collection('users').doc(currentUser).set({ walletAddress: addr, walletAddressSource: 'manual' }, { merge: true })
        .then(() => {
            renderUserWallet(addr);
            walletNotice('✅ تم حفظ عنوان المحفظة', true);
        })
        .catch(e => walletNotice('فشل حفظ المحفظة: ' + e.message, false));
}
window.manualWalletEntry = manualWalletEntry;

function loadUserBio() {
    const unsubscribe = db.collection("users").doc(currentUser).onSnapshot(doc => {
        const d = doc.exists ? doc.data() : {};
        if (d.bio) document.getElementById('user-bio').innerText = d.bio;
        applyAvatarToCircle(d.avatarUrl || null);
        applyNavAvatar(d.avatarUrl || null);
        renderUserWallet(d.walletAddress || null);
        renderMineState(d);
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


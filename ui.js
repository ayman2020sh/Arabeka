// ===== أدوات عامة + التنقل بين الصفحات ===== 
// ================= أدوات عامة =================
function autoResizeTextarea(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

function sanitizeHTML(text) { const d = document.createElement('div'); d.textContent = text == null ? '' : text; return d.innerHTML; }

function escapeAttr(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeURL(url) {
    if (!url) return '';
    try {
        const u = new URL(url, window.location.href);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
        return escapeAttr(u.href);
    } catch (e) { return ''; }
}

function comingSoon() { alert('الإعداد قيد التطوير 🤌'); }

function showError(message) {
    const el = document.getElementById('login-error');
    if (!el) return;
    el.innerHTML = sanitizeHTML(message);
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 8000);
}

function cleanupListeners() {
    unsubscribeFunctions.forEach(unsub => { try { unsub(); } catch (e) {} });
    unsubscribeFunctions = [];
}

// تجميع إعادة الرندر في إطار واحد بدل عشرات المرات عند وصول بيانات المؤلفين
let rerenderScheduled = false;
function scheduleRerender() {
    if (rerenderScheduled) return;
    rerenderScheduled = true;
    requestAnimationFrame(() => { rerenderScheduled = false; renderPostsFeed(); renderProductsFeed(); });
}

function isKnownAdmin(username) { return adminStatusCache[username] === true; }

function fetchAdminStatusAndRerender(username) {
    if (!username || adminStatusCache.hasOwnProperty(username)) return;
    adminStatusCache[username] = false; // منع الطلبات المتكررة أثناء الانتظار
    db.collection("users").doc(username).get().then(doc => {
        adminStatusCache[username] = doc.exists && doc.data().isAdmin === true;
        if (adminStatusCache[username]) scheduleRerender();
    }).catch(e => console.error("Admin status check error:", e.message));
}

function fetchAvatarAndRerender(username) {
    if (!username || avatarCache.hasOwnProperty(username)) return;
    avatarCache[username] = null;
    db.collection("users").doc(username).get().then(doc => {
        avatarCache[username] = (doc.exists && doc.data().avatarUrl) ? doc.data().avatarUrl : null;
        if (avatarCache[username]) scheduleRerender();
    }).catch(e => console.error("Avatar fetch error:", e.message));
}

function avatarStyleFor(username) {
    const safe = avatarCache[username] ? sanitizeURL(avatarCache[username]) : '';
    return safe ? `background-image:url('${safe}');` : '';
}
function avatarInitialFor(username) {
    return avatarCache[username] ? '' : (username ? sanitizeHTML(username.charAt(0).toUpperCase()) : '?');
}

async function getIdToken() {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('انتهت الجلسة، سجّل الدخول من جديد');
    return user.getIdToken();
}


// ================= التنقل =================
function handleAddButton() {
    const activePage = document.querySelector('#main-app .page.active');
    const pageId = activePage ? activePage.id : '';
    if (pageId === 'page-store') {
        switchPage('store', true);
        const f = document.getElementById('new-prod-name');
        if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.focus(); }
    } else {
        switchPage('feed');
        const f = document.getElementById('post-text');
        if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.focus(); }
    }
}

function switchPage(pageId, keepStoreFilter) {
    if (pageId === 'store' && !keepStoreFilter && window.showOnlyMyProducts) {
        window.showOnlyMyProducts = false;
        window.storeFilterOwner = null;
        const banner = document.getElementById('store-filter-banner');
        if (banner) banner.style.display = 'none';
        filterStoreProducts(window.currentCategoryFilter || 'all');
    }
    document.querySelectorAll('#main-app .page').forEach(page => page.classList.remove('active'));
    const activePage = document.getElementById('page-' + pageId) || document.getElementById('page-feed');
    if (activePage) activePage.classList.add('active');
    const navPage = (['settings', 'search', 'user-profile', 'orders'].indexOf(pageId) !== -1) ? 'profile' : pageId;
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-page') === navPage);
    });
    window.scrollTo(0, 0);
}

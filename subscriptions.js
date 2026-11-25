// ===== الاشتراكات: شارة ⭐ عبر عقد Pi للاشتراكات (Testnet) =====
// القراءة من البلوكشين مباشرة — لا قاعدة بيانات للشارة. الاشتراك يُدفع عبر Pi.SmartContract.
const SUB_SERVICE_ID = 473; // Arabeka Premium Badge — 1 Pi / 30 يوم
const SUB_BADGE_HTML = '<span class="premium-badge" title="عضو مميز ⭐">⭐</span>';
let premiumActive = false; // حالة اشتراك المستخدم الحالي (تُحدَّث بعد الدخول)

// فحص فعالية اشتراك عنوان على الخدمة الرسمية
function subIsActive(address, serviceId) {
    if (typeof Pi === 'undefined' || !Pi.SmartContract || !Pi.SmartContract.Subscription) return Promise.resolve(false);
    return Pi.SmartContract.Subscription.isSubscriptionActive(address, serviceId, { mode: 'simulate' })
        .then(r => r === true)
        .catch(e => { console.warn('subIsActive:', e && e.message); return false; });
}

// جلب عنوان محفظة اسم مستخدم من وثيقته
function subWalletOf(username) {
    return db.collection('users').doc(username).get()
        .then(d => (d.exists && d.data().walletAddress) || null)
        .catch(() => null);
}

// تحديث شارة الملف الشخصي (تُنادى من profile.js بعد renderUserWallet)
function updatePremiumBadge() {
    const el = document.getElementById('user-premium-badge');
    if (!el) return;
    el.style.display = premiumActive ? 'inline-block' : 'none';
    const btn = document.getElementById('premium-btn');
    if (btn) btn.textContent = premiumActive ? '⭐ اشتراكك فعّال' : '⭐ الاشتراك المميز — 1 Pi / 30 يوم';
}

// فحص اشتراك المستخدم الحالي بعد الدخول (عنوانه من وثيقته)
function initSubscription() {
    if (!currentUser) return;
    subWalletOf(currentUser).then(w => {
        if (!w) { updatePremiumBadge(); return; }
        return subIsActive(w, SUB_SERVICE_ID).then(active => {
            premiumActive = active;
            updatePremiumBadge();
            if (window.lastProductsSnapshot) renderProductsFeed();
        });
    });
}

// إضافة ⭐ لمنتجات المشتركين — تُنادى من store.js عند بناء بطاقة المنتج
function premiumBadgeForOwner(owner) {
    const elId = 'pb-' + owner;
    if (adminStatusCache[owner]) return ''; // ⚜️ كافية
    setTimeout(() => {
        subWalletOf(owner).then(w => {
            if (!w) return;
            return subIsActive(w, SUB_SERVICE_ID).then(active => {
                const el = document.getElementById(elId);
                if (el && active) el.innerHTML = SUB_BADGE_HTML;
            });
        });
    }, 0);
    return '<span id="' + elId + '" class="premium-slot"></span>';
}

// زر الاشتراك: تسجيل في الخدمة عبر العقد + شاشة محفظة Pi للدفع
function subscribePremium() {
    if (!currentUser) { showError('سجّل الدخول أولاً'); return; }
    if (typeof Pi === 'undefined') { showError('افتح التطبيق من متصفح Pi'); return; }
    const btn = document.getElementById('premium-btn');
    if (btn) btn.disabled = true;
    subWalletOf(currentUser).then(w => {
        if (!w) { showError('اربط محفظتك أولاً من صفحة حسابك'); throw new Error('no-wallet'); }
        if (premiumActive) { alert('اشتراكك فعّال بالفعل ⭐'); throw new Error('already'); }
        return Pi.SmartContract.Subscription.subscribe(w, SUB_SERVICE_ID, true, 3, { mode: 'submit' });
    }).then(r => {
        if (!r) return;
        alert('✅ تم إرسال الاشتراك — سيُفعَّل خلال ثوانٍ بعد تأكيد الشبكة');
        setTimeout(initSubscription, 12000);
    }).catch(e => {
        if (e && (e.message === 'no-wallet' || e.message === 'already')) return;
        showError('تعذر الاشتراك: ' + (e && e.message ? e.message : 'خطأ في الشبكة'));
    }).finally(() => { if (btn) btn.disabled = false; });
}

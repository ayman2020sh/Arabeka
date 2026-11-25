// ===== الاشتراكات: شارة ⭐ عبر عقد Pi للاشتراكات (Testnet) =====
// القراءة من البلوكشين مباشرة — لا قاعدة بيانات للشارة. الاشتراك يُدفع عبر Pi.SmartContract.
const SUB_SERVICE_ID = 473; // Arabeka Premium Badge — 1 Pi / 30 يوم
const SUB_BADGE_HTML = '<span class="premium-badge" title="عضو مميز ⭐">⭐</span>';
let premiumActive = false; // حالة اشتراك المستخدم الحالي
let premiumAutoRenew = false; // هل التجديد التلقائي مفعّل
let premiumEndDate = null; // تاريخ انتهاء الفترة الحالية

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
    if (!btn) return;
    if (premiumActive && premiumAutoRenew) {
        btn.textContent = '✖️ إلغاء الاشتراك المميز';
        btn.style.background = '#4b2230';
        btn.style.color = '#ffb3c0';
        btn.disabled = false;
    } else if (premiumActive && !premiumAutoRenew) {
        btn.textContent = '⭐ فعّال حتى ' + (premiumEndDate || 'نهاية الفترة') + ' (لن يُجدد)';
        btn.style.background = '#2b3350';
        btn.style.color = '#9aa3bb';
        btn.disabled = true;
    } else {
        btn.textContent = '⭐ الاشتراك المميز — 1 Pi / 30 يوم';
        btn.style.background = 'linear-gradient(90deg,#b8860b,#ffd700)';
        btn.style.color = '#1a1a1a';
        btn.disabled = false;
    }
}

// فحص اشتراك المستخدم الحالي بعد الدخول (عنوانه من وثيقته)
function initSubscription() {
    if (!currentUser) return;
    subWalletOf(currentUser).then(w => {
        if (!w) { updatePremiumBadge(); return; }
        return subIsActive(w, SUB_SERVICE_ID).then(active => {
            premiumActive = active;
            // نجلب تفاصيل الاشتراك (تجديد تلقائي؟ تاريخ انتهاء؟)
            if (active) {
                return Pi.SmartContract.Subscription.getSubscriberSubscriptions(w, { mode: 'simulate' })
                    .then(r => {
                        const subs = Array.isArray(r) ? r : (r && r.subscriptions) || [];
                        const mine = subs.find(x => parseInt(x.service_id) === SUB_SERVICE_ID);
                        if (mine) {
                            premiumAutoRenew = mine.auto_renew === true;
                            if (mine.service_end_ts) {
                                const d = new Date(parseInt(mine.service_end_ts) * 1000);
                                premiumEndDate = d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
                            }
                        }
                        updatePremiumBadge();
                        if (window.lastProductsSnapshot) renderProductsFeed();
                    });
            }
            updatePremiumBadge();
            if (window.lastProductsSnapshot) renderProductsFeed();
        });
    });
}

// إضافة ⭐ لمنتجات المشتركين — تُنادى من store.js عند بناء بطاقة المنتج
function premiumBadgeForOwner(owner) {
    const elId = 'pb-' + owner;
    // نجلب حالة الاشتراك من العقد مباشرة — تُظهر ⭐ إن كان البائع مشتركاً
    setTimeout(() => {
        const el = document.getElementById(elId);
        if (!el) return;
        subWalletOf(owner).then(w => {
            if (!w) return;
            return subIsActive(w, SUB_SERVICE_ID).then(active => {
                const el2 = document.getElementById(elId);
                if (el2 && active) el2.innerHTML = SUB_BADGE_HTML;
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

// زر ذكي: اشتراك للمشترك الجديد / إلغاء للمشترك الحالي
function premiumAction() { premiumActive ? cancelPremium() : subscribePremium(); }

function cancelPremium() {
    if (!currentUser) { showError('سجّل الدخول أولاً'); return; }
    if (typeof Pi === 'undefined') { showError('افتح التطبيق من متصفح Pi'); return; }
    if (!confirm('هل تريد إلغاء الاشتراك المميز؟ ستفقد الشارة ⭐ نهاية الفترة المدفوعة.')) return;
    const btn = document.getElementById('premium-btn');
    if (btn) btn.disabled = true;
    subWalletOf(currentUser).then(w => {
        if (!w) { showError('اربط محفظتك أولاً'); throw new Error('no-wallet'); }
        // نحتاج sub_id الحقيقي — نجلبه من العقد
        return Pi.SmartContract.Subscription.getSubscriberSubscriptions(w, { mode: 'simulate' })
            .then(r => {
                const subs = Array.isArray(r) ? r : (r && r.subscriptions) || [];
                const mine = subs.find(x => parseInt(x.service_id) === SUB_SERVICE_ID && x.auto_renew !== false);
                if (!mine) { alert('لا يوجد اشتراك فعّال بالتجديد التلقائي على هذه الخدمة'); throw new Error('no-sub'); }
                return Pi.SmartContract.Subscription.cancel(w, parseInt(mine.sub_id), { mode: 'submit' });
            });
    }).then(r => {
        if (!r) return;
        alert('✅ تم إرسال الإلغاء — لن يُجدد تلقائياً بعد الآن');
        setTimeout(initSubscription, 12000);
    }).catch(e => {
        if (e && (e.message === 'no-wallet' || e.message === 'no-sub')) return;
        showError('تعذر الإلغاء: ' + (e && e.message ? e.message : 'خطأ في الشبكة'));
    }).finally(() => { if (btn) btn.disabled = false; });
}

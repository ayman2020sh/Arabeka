// ===== تهيئة Pi SDK والمصادقة ===== 
// ================= Pi SDK =================
let piReady = false;
initializePiSDK();

function initializePiSDK(attemptsLeft) {
    if (attemptsLeft === undefined) attemptsLeft = 30;
    try {
        if (typeof Pi !== 'undefined') { Pi.init({ version: "2.0", sandbox: false }); piReady = true; return; }
    } catch (error) { console.error("Pi SDK Error:", error.message); }
    if (attemptsLeft > 0) setTimeout(() => initializePiSDK(attemptsLeft - 1), 500);
}

// استكمال دفعة معلّقة: نختار الخطوة الصحيحة حسب حالتها
function onIncompletePaymentFound(payment) {
    const paymentId = payment.identifier;
    const txid = payment.transaction && payment.transaction.txid ? payment.transaction.txid : '';
    const post = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    const approved = payment.status && payment.status.developer_approved;
    const step = approved ? post('/api/complete', { paymentId, txid }) : post('/api/approve', { paymentId });

    step.then(async res => {
        if (!approved && res.ok && txid) {
            // كانت مدفوعة على البلوكتشين لكن لم تُوافَق → أكملها الآن
            return post('/api/complete', { paymentId, txid });
        }
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            console.warn('incomplete payment not recovered:', paymentId, data.error || res.status);
        }
    }).catch(err => console.error('incomplete payment recovery:', err.message));
}

// ================= المصادقة =================
firebase.auth().onAuthStateChanged(function (user) {
    if (!user) return;
    const savedUsername = localStorage.getItem('arabeka_username');
    if (savedUsername && user.uid !== savedUsername) {
        console.error('Auth mismatch: uid=' + user.uid + ' saved=' + savedUsername + '. Forcing fresh sign-in.');
        firebase.auth().signOut().then(function () {
            localStorage.removeItem('arabeka_username');
            authUid = null; currentUser = null;
            showError('انتهت صلاحية جلستك القديمة، برجاء تسجيل الدخول من جديد.');
        });
        return;
    }
    authUid = user.uid;
    if (savedUsername && !currentUser) {
        loginSuccess(savedUsername);
        const trySilentPiAuth = function (attemptsLeft) {
            if (attemptsLeft === undefined) attemptsLeft = 20;
            if (typeof Pi !== 'undefined' && piReady) {
                
Pi.authenticate(['username', 'payments', 'wallet_address'], onIncompletePaymentFound)
                    .catch(e => console.warn("إعادة توثيق صامتة مع Pi فشلت:", e.message));
                return;
            }
            if (attemptsLeft > 0) setTimeout(() => trySilentPiAuth(attemptsLeft - 1), 500);
        };
        trySilentPiAuth();
    }
});

document.getElementById('login-btn').addEventListener('click', handleLogin);

function heroAction() { if (currentUser) switchPage('store'); else handleLogin(); }

function handleLogin() {
    if (typeof Pi === 'undefined') { showError("الرجاء فتح التطبيق من متصفح Pi"); return; }
    if (!piReady) {
        showError("لسه بيجهز الاتصال بـ Pi، بنحاول تاني تلقائياً...");
        initializePiSDK(10);
        setTimeout(() => { if (piReady) handleLogin(); }, 1600);
        return;
    }


Pi.authenticate(['username', 'payments', 'wallet_address'], onIncompletePaymentFound)
        .then(auth => {
            const piUsername = auth.user.username;
            return fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: piUsername, accessToken: auth.accessToken })
            })
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (!ok || !data.token) throw new Error(data.error || "فشل التوثيق الأمني مع الخادم");
                const username = data.username || piUsername;
                return firebase.auth().signInWithCustomToken(data.token).then(() => username);
            })
            .then(username => {
                localStorage.setItem('arabeka_username', username);
                loginSuccess(username);
            });
        })
        .catch(error => showError("خطأ تسجيل الدخول: " + error.message));
}

function loginSuccess(username) {
    currentUser = username;
    document.getElementById('login-view').classList.remove('active');
    document.getElementById('main-app').classList.add('active');
    document.getElementById('user-name').childNodes[0].nodeValue = username + ' ';
    document.getElementById('settings-username').innerText = username;
    const heroText = document.getElementById('hero-btn-text');
    if (heroText) heroText.innerText = 'تصفح المتجر';
    cleanupListeners();
    showOnlyMyPosts = false;
    document.getElementById('posts-filter-banner').style.display = 'none';
    loadUserBio();
    loadPosts();
    loadProducts();
    loadProfileStats();
    loadIncomingFriendRequests();
    loadMyOrders();
    switchPage('feed');
}

function logout() {
    if (!confirm("هل تريد تسجيل الخروج؟")) return;
    cleanupListeners();
    localStorage.removeItem('arabeka_username');
    firebase.auth().signOut().then(() => {
        currentUser = null; authUid = null;
        const heroText = document.getElementById('hero-btn-text');
        if (heroText) heroText.innerText = 'pi sign.in';
        document.getElementById('main-app').classList.remove('active');
        document.getElementById('login-view').classList.add('active');
        switchPage('feed');
    });
}


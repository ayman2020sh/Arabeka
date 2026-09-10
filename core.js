// ===== الإعداد الأساسي: Firebase + المتغيرات العامة =====
/* =====================================================================
   ملاحظة معمارية: Firebase UID == اسم مستخدم Pi (Custom Token).
   لذلك كل حقول *Uid في Firestore (ownerUid, authorUid, buyerUid...) تساوي اسم المستخدم.
   السيرفر وقواعد الأمان يعتمدان على هذا الافتراض — لا تغيّره دون مراجعة الطرفين.
   ===================================================================== */

const PLATFORM_FEE = 0.1; // رسوم المنصة لكل عملية بيع (تُخصم عند التحويل للبائع)

// إعدادات Firebase (مفاتيح الويب عامة بالتصميم — قيّدها بالـ referrer من Google Cloud Console)
const firebaseConfig = {
    apiKey: "AIzaSyARAFggPUeoPr7dmzpi_R_HLVeqobGclzo",
    authDomain: "arabeka-3336c.firebaseapp.com",
    projectId: "arabeka-3336c",
    storageBucket: "arabeka-3336c.firebasestorage.app",
    messagingSenderId: "244460272030",
    appId: "1:244460272030:web:c5aabfd0b396656721fe8f"
};

try { firebase.initializeApp(firebaseConfig); }
catch (error) { console.error("Firebase Init Error:", error); }

const db = firebase.firestore();
let currentUser = null;
let authUid = null;
let unsubscribeFunctions = [];
let lastPostsSnapshot = null;
let lastProductsSnapshot = null;
let showOnlyMyPosts = false;
let editingPostId = null;
let editingStoreProdId = null;
let adminStatusCache = {};
let avatarCache = {};
window.currentFeedCategoryFilter = 'all';
window.currentCategoryFilter = 'all';
window.showOnlyMyProducts = false;
window.storeFilterOwner = null;
window.productsMap = {};

// ================= لوحة التصحيح (تظهر فقط مع ?debug=1) =================
(function setupDebugPanel() {
    const enabled = location.search.indexOf('debug=1') !== -1 || localStorage.getItem('arabeka_debug') === '1';
    if (!enabled) return;

    const panel = document.createElement('div');
    panel.id = 'debug-log-panel';
    panel.style.cssText = 'display:none; position:fixed; bottom:60px; left:0; right:0; max-height:45vh; overflow-y:auto; background:#000; color:#0f0; font-family:monospace; font-size:11px; padding:10px; z-index:99999; border-top:2px solid #0f0; direction:ltr; text-align:left; white-space:pre-wrap;';
    document.body.appendChild(panel);

    const toggleBtn = document.createElement('button');
    toggleBtn.innerText = '🐞';
    toggleBtn.style.cssText = 'position:fixed; bottom:70px; right:10px; z-index:100000; width:40px; height:40px; border-radius:50%; background:#222; color:#0f0; border:1px solid #0f0; font-size:18px;';
    toggleBtn.onclick = function () { panel.style.display = (panel.style.display === 'none') ? 'block' : 'none'; };
    document.body.appendChild(toggleBtn);

    const clearBtn = document.createElement('button');
    clearBtn.innerText = 'مسح';
    clearBtn.style.cssText = 'position:fixed; bottom:118px; right:10px; z-index:100000; padding:6px 10px; border-radius:8px; background:#222; color:#f66; border:1px solid #f66; font-size:11px;';
    clearBtn.onclick = function () { panel.innerHTML = ''; };
    document.body.appendChild(clearBtn);

    function fmt(a) {
        if (a instanceof Error) return a.message + (a.stack ? '\n' + a.stack : '');
        if (typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
        return String(a);
    }
    function addLine(prefix, color, args) {
        const line = document.createElement('div');
        line.style.cssText = 'color:' + color + '; border-bottom:1px solid #333; padding-bottom:4px; margin-bottom:4px;';
        line.innerText = '[' + new Date().toLocaleTimeString() + '] ' + prefix + ' ' + args.map(fmt).join(' ');
        panel.appendChild(line);
        panel.scrollTop = panel.scrollHeight;
    }
    const oLog = console.log, oErr = console.error, oWarn = console.warn;
    console.log = function (...a) { addLine('LOG', '#0f0', a); oLog.apply(console, a); };
    console.error = function (...a) { addLine('ERROR', '#f44', a); oErr.apply(console, a); };
    console.warn = function (...a) { addLine('WARN', '#fa0', a); oWarn.apply(console, a); };
    window.addEventListener('error', e => addLine('UNCAUGHT', '#f44', [e.message + ' @ ' + e.filename + ':' + e.lineno]));
    window.addEventListener('unhandledrejection', e => addLine('UNHANDLED PROMISE', '#f44', [e.reason]));
})();


/* ============================================================
   محرك الترجمة — تبديل فوري عربي/إنجليزي بدون إعادة تحميل
   يعمل بمسح نصوص الصفحة (والنصوص المتغيرة التي تظهر لاحقاً تلقائياً).
   لا يترجم: محتوى المستخدمين (المنشورات، التعليقات، النبذة) ولا الأكواد.
   ============================================================ */

(function () {
    'use strict';

    var CONF = window.ARABEKA_LANG || { dict: {}, patterns: [] };
    var DICT = CONF.dict;
    var PATTERNS = CONF.patterns;
    var LANG_KEY = 'arabeka_lang';

    var lang = localStorage.getItem(LANG_KEY) || 'ar';
    var originalTitle = document.title;

    /* عناصر لا تُترجم: أكواد + محتوى المستخدمين */
    var SKIP_TEXT = '[data-no-i18n], script, style, textarea, code, pre, .card-content, .comment, #user-bio';
    var SKIP_ATTR = '[data-no-i18n], .card-content, .comment';
    var ATTRS = ['placeholder', 'title', 'aria-label'];

    /* تصحيح أخطاء النصوص الموجودة في النسخة القديمة من index.html
       (الكلمة المشوّهة -> الكلمة الصحيحة) */
    var FIXES = {
        'الإله': 'الإعدادات',
        'تعديل نبهم': 'تعديل نبذه',
        'نبزة 🫆': 'نبذه 🫆',
        'نبزة': 'نبذه',
        'الحق الأول': 'الحقل الأول',
        'الزر': 'إلغاء',
        'حفظ الأشياء': 'حفظ التعديلات',
        'حفظ المنتج': 'حفظ التعديلات',
        '🏭 صناعية': '🏭 صناعي',
        '🛠️ خدماتي': '🛠️ خدمي',
        '🛠️ خدمة': '🛠️ خدمي',
        '💻 تمرير': '💻 تقني',
        '📊 سيارة واقتصاد': '📊 سياسة واقتصاد',
        '✓ نشر': '✓ نشر الرأي',
        'عرض البيع': 'عرض للبيع',
        'تعرض منشوراتك بس': '📌 بتعرض منشوراتك بس',
        'تعرض منتجاتك بس': '📌 بتعرض منتجاتك بس',
        '💡 تُخصم منصة رسم 0.1 Pi من كل عملية بيع عند تحويل للبائع.': '💡 تُخصم رسوم منصة 0.1 Pi من كل عملية بيع عند التحويل للبائع.',
        '🛍️ المشترين والمبيعات': '🛍️ المشتريات والمبيعات',
        '📄 المستهلكين والقوانين': '📄 السياسات والقوانين',
        'الأصدقاء': 'أصدقاء',
        '🤝 أضف صديقًا': '🤝 إضافة صديق',
        'طلبات الصداقة ترسل': 'طلبات الصداقة الواردة',
        'لا توجد طلبات متاحة': 'لا توجد طلبات حالياً',
        '⚜️ ara man': '⚜️ ارابيكا',
        '⚜️ ara ظرف': '⚜️ ارابيكا',
        'المتابعون': 'المتابعين',
        'عروض بيع': 'عروض البيع'
    };

    /* تصحيح خصائص CSS التي تُرجمت خطأً للعربية داخل style="" */
    var CSS_FIXES = [
        [/هامش\s+أعلى/g, 'margin-top'],
        [/هامش\s+أسفل/g, 'margin-bottom'],
        [/هامش/g, 'margin'],
        [/خطي-التدرج/g, 'linear-gradient'],
        [/اتجاه/g, 'direction']
    ];

    function fixCssProps(root) {
        var scope = root && root.querySelectorAll ? root : document;
        if (!scope.querySelectorAll) return;
        var els = scope.querySelectorAll('[style]');
        for (var i = 0; i < els.length; i++) {
            var st = els[i].getAttribute('style');
            if (!st || st.search(/[\u0600-\u06FF]/) === -1) continue;
            var fixed = st;
            for (var j = 0; j < CSS_FIXES.length; j++) fixed = fixed.replace(CSS_FIXES[j][0], CSS_FIXES[j][1]);
            if (fixed !== st) els[i].setAttribute('style', fixed);
        }
    }

    /* ذاكرة أصل النص لكل عقدة (للرجوع للعربية بدقة) */
    var origText = new WeakMap();
    var lastOut = new WeakMap();
    var origAttr = new WeakMap();

    /* ===== ترجمة نص واحد ===== */
    function translate(str) {
        if (!str) return str;
        var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(str);
        var lead = m[1], core = m[2], trail = m[3];
        if (!core) return str;
        if (Object.prototype.hasOwnProperty.call(DICT, core)) return lead + DICT[core] + trail;
        for (var i = 0; i < PATTERNS.length; i++) {
            var p = PATTERNS[i];
            if (p.r.test(core)) {
                p.r.lastIndex = 0;
                return lead + core.replace(p.r, p.en) + trail;
            }
        }
        return str;
    }

    function skipped(node, selector) {
        var el = node.parentElement || (node.nodeType === 1 ? node : null);
        return !!(el && el.closest && el.closest(selector));
    }

    /* ===== تصحيح نص مشوّه ===== */
    function fixText(node) {
        var cur = node.nodeValue;
        if (!cur) return cur;
        var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(cur);
        var core = m[2];
        if (!core) return cur;
        if (Object.prototype.hasOwnProperty.call(FIXES, core)) {
            var fixed = m[1] + FIXES[core] + m[3];
            node.nodeValue = fixed;
            return fixed;
        }
        return cur;
    }

    /* ===== ترجمة عقدة نصية (مع تصحيح الأخطاء أولاً) ===== */
    function handleTextNode(node) {
        if (node.nodeType !== 3) return;
        if (skipped(node, SKIP_TEXT)) return;
        var cur = node.nodeValue;
        if (!cur || !cur.trim()) return;

        if (lang === 'en') {
            var base = fixText(node);
            var out = translate(base);
            if (out === base) return;
            if (lastOut.get(node) !== base) origText.set(node, base);
            lastOut.set(node, out);
            node.nodeValue = out;
        } else {
            var orig = origText.get(node);
            if (orig !== undefined && orig !== cur) {
                node.nodeValue = orig;
                cur = orig;
            }
            fixText(node);
        }
    }

    /* ===== خصائص العناصر (placeholder / title) ===== */
    function handleAttrs(el) {
        if (el.nodeType !== 1) return;
        if (skipped(el, SKIP_ATTR)) return;
        for (var i = 0; i < ATTRS.length; i++) {
            var name = ATTRS[i];
            var val = el.getAttribute && el.getAttribute(name);
            if (!val || !val.trim()) continue;
            if (lang === 'en') {
                var out = translate(val);
                if (out === val) continue;
                var store = origAttr.get(el);
                if (!store) { store = {}; origAttr.set(el, store); }
                if (store[name] === undefined) store[name] = val;
                el.setAttribute(name, out);
            } else {
                var st = origAttr.get(el);
                if (st && st[name] !== undefined && st[name] !== val) el.setAttribute(name, st[name]);
            }
        }
    }

    /* ===== المرور على شجرة العناصر ===== */
    function walk(root) {
        if (!root) return;
        if (root.nodeType === 3) { handleTextNode(root); return; }
        if (root.nodeType !== 1) return;

        handleAttrs(root);

        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
        var node = walker.nextNode();
        while (node) {
            if (node.nodeType === 3) handleTextNode(node);
            else handleAttrs(node);
            node = walker.nextNode();
        }
    }

    /* ===== إنشاء زر الترجمة في الهيدر إن لم يكن موجوداً ===== */
    function injectButton() {
        if (document.getElementById('lang-btn')) { updateBtn(); return; }
        var header = document.querySelector('.header');
        if (!header) return;

        var btn = document.createElement('button');
        btn.id = 'lang-btn';
        btn.setAttribute('data-no-i18n', '');
        btn.style.cssText = 'background:none; border:none; color: var(--text-color); font-size: 14px; font-weight: bold; cursor: pointer; padding: 0;';
        btn.onclick = function () { setLang(lang === 'en' ? 'ar' : 'en'); };

        // الوضع بجانب زر التنبيهات (آخر زر في الهيدر)
        var btns = header.querySelectorAll(':scope > button');
        var bell = btns.length ? btns[btns.length - 1] : null;
        if (bell) {
            var wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; gap:12px; align-items:center;';
            header.insertBefore(wrap, bell);
            wrap.appendChild(bell);
            wrap.appendChild(btn);
        } else {
            header.appendChild(btn);
        }
        updateBtn();
    }

    /* ===== تحسينات اتجاه الواجهة (تُطبَّق تلقائياً) ===== */
    function injectStyles() {
        if (document.getElementById('i18n-extra-style')) return;
        var st = document.createElement('style');
        st.id = 'i18n-extra-style';
        st.textContent = '[dir="ltr"] .hero-text{text-align:left}' +
            '[dir="ltr"] .settings-row .row-left span.icon{margin-left:0;margin-right:15px}' +
            '[dir="ltr"] .official-badge{margin-right:0;margin-left:5px}';
        document.head.appendChild(st);
    }

    /* ===== تفعيل اللغة ===== */
    function applyLang() {
        document.documentElement.lang = (lang === 'en') ? 'en' : 'ar';
        document.documentElement.dir = (lang === 'en') ? 'ltr' : 'rtl';
        walk(document.body);
        document.title = (lang === 'en') ? translate(originalTitle) : originalTitle;
        updateBtn();
    }

    function updateBtn() {
        var btn = document.getElementById('lang-btn');
        if (!btn) return;
        btn.textContent = (lang === 'en') ? 'عربي' : 'EN';
        btn.title = (lang === 'en') ? 'التبديل للعربية' : 'Switch to English';
    }

    function setLang(next) {
        lang = (next === 'en') ? 'en' : 'ar';
        try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
        applyLang();
    }

    /* ===== مراقبة النصوص الديناميكية (تُضاف لاحقاً) ===== */
    function startObserver() {
        var pending = false;
        var observer = new MutationObserver(function (muts) {
            if (pending) return;
            pending = true;
            requestAnimationFrame(function () {
                pending = false;
                for (var i = 0; i < muts.length; i++) {
                    var mu = muts[i];
                    if (mu.type === 'characterData') handleTextNode(mu.target);
                    else if (mu.type === 'attributes') handleAttrs(mu.target);
                    else {
                        for (var j = 0; j < mu.addedNodes.length; j++) walk(mu.addedNodes[j]);
                        fixCssProps(document.body);
                    }
                }
            });
        });
        observer.observe(document.body, {
            childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ATTRS
        });
    }

    /* ===== ترجمة نوافذ alert / confirm / prompt الأصلية ===== */
    var nativeAlert = window.alert;
    var nativeConfirm = window.confirm;
    var nativePrompt = window.prompt;
    window.alert = function (msg) { return nativeAlert.call(window, translate(String(msg))); };
    window.confirm = function (msg) { return nativeConfirm.call(window, translate(String(msg))); };
    window.prompt = function (msg, def) { return nativePrompt.call(window, translate(String(msg)), def); };

    /* ===== تشغيل ===== */
    function init() {
        injectStyles();
        injectButton();
        fixCssProps(document);
        if (lang === 'en') applyLang();
        else {
            document.documentElement.lang = 'ar';
            document.documentElement.dir = 'rtl';
            walk(document.body); // لتصحيح أي نصوص مشوّهة في الوضع العربي
        }
        startObserver();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    /* متاح للاستخدام المستقبلي: t('نص عربي') */
    window.t = translate;
    window.toggleLang = function () { setLang(lang === 'en' ? 'ar' : 'en'); };
    window.setLang = setLang;
    window.getLang = function () { return lang; };
})();

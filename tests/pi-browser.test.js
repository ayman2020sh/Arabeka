const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

test('Pi Browser can frame the app without enforcing a CSP on existing scripts', () => {
    const config = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    const globalHeaders = config.headers.find(rule => rule.source === '/(.*)').headers;
    const headers = new Map(globalHeaders.map(({ key, value }) => [key.toLowerCase(), value]));

    assert.equal(headers.has('x-frame-options'), false);
    assert.equal(
        headers.get('content-security-policy'),
        "frame-ancestors 'self' https://app-cdn.minepi.com https://sandbox.minepi.com"
    );
    // Keep the other CSP directives in report-only mode: the existing app uses inline handlers.
    assert.ok(headers.has('content-security-policy-report-only'));
});

function loginHarness(authenticate) {
    const errors = [];
    const listeners = {};
    const loginButton = {
        disabled: false,
        textContent: 'Pi sign.in',
        addEventListener(type, listener) { listeners[type] = listener; }
    };
    const context = {
        Pi: { init() {}, authenticate },
        firebase: { auth() { return { onAuthStateChanged() {} }; } },
        document: {
            getElementById(id) { assert.equal(id, 'login-btn'); return loginButton; },
            readyState: 'loading',
            addEventListener() {}
        },
        window: {},
        console,
        Promise,
        setTimeout() {},
        showError(message) { errors.push(message); }
    };
    vm.runInNewContext(readFileSync(path.join(root, 'auth.js'), 'utf8'), context);
    return { errors, loginButton, click: () => listeners.click() };
}

test('login shows immediate feedback and does not start duplicate authentication', () => {
    let calls = 0;
    const { loginButton, click } = loginHarness(() => {
        calls++;
        return new Promise(() => {});
    });
    click();
    assert.equal(loginButton.disabled, true);
    assert.match(loginButton.textContent, /جارٍ الاتصال/);
    click();
    assert.equal(calls, 1);
});

test('a synchronous Pi SDK error is displayed and the button is restored', () => {
    const { loginButton, errors, click } = loginHarness(() => { throw new Error('Pi bridge unavailable'); });
    click();
    assert.equal(loginButton.disabled, false);
    assert.equal(loginButton.textContent, 'Pi sign.in');
    assert.match(errors[0], /Pi bridge unavailable/);
});

test('a rejected Pi SDK authentication restores the button', async () => {
    const { loginButton, errors, click } = loginHarness(() => Promise.reject(new Error('Pi denied')));
    click();
    await new Promise(setImmediate);
    assert.equal(loginButton.disabled, false);
    assert.equal(loginButton.textContent, 'Pi sign.in');
    assert.match(errors[0], /Pi denied/);
});

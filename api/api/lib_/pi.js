const axios = require('axios');

const API_KEY = process.env.PI_API_KEY;
if (!API_KEY) throw new Error('PI_API_KEY is not set');

const pi = axios.create({
baseURL: 'https://api.minepi.com/v2',
timeout: 8000,
headers: { Authorization: Key ${API_KEY}` }
});

const delay = ms => new Promise(r => setTimeout(r, ms));

// إعادة المحاولة فقط عند أخطاء الشبكة أو 5xx
async function withRetry(fn, { attempts = 3, delayMs = 1500 } = {}) {
let lastErr;
for (let i = 1; i <= attempts; i++) {
try { return await fn(); }
catch (e) {
lastErr = e;
const status = e.response?.status;
const retryable = !status || status >= 500;
if (!retryable || i === attempts) throw e;
await delay(delayMs);
}
}
throw lastErr;
}

const getPayment = id => withRetry(() => pi.get(/payments/${id})).then(r =&gt; r.data); const approvePayment = id =&gt; withRetry(() =&gt; pi.post(/payments/ {id}/complete`, { txid })).then(r => r.data);

const errBody = e => e.response?.data || { message: e.message };

module.exports = { pi, getPayment, approvePayment, completePayment, errBody };

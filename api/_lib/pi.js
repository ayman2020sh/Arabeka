const PiNetwork = require('pi-backend');

let piInstance = null;

function getPi() {
    if (!piInstance) {
        const apiKey = process.env.PI_API_KEY;
        const walletPrivateSeed = process.env.PI_WALLET_PRIVATE_SEED;
        
        if (!apiKey || !walletPrivateSeed) {
            throw new Error('PI_API_KEY and PI_WALLET_PRIVATE_SEED must be set');
        }
        
        piInstance = new PiNetwork(apiKey, walletPrivateSeed);
    }
    return piInstance;
}

async function getPayment(paymentId) {
    const pi = getPi();
    return await pi.getPayment(paymentId);
}

async function approvePayment(paymentId) {
    const pi = getPi();
    return await pi.approvePayment(paymentId);
}

async function completePayment(paymentId, txid) {
    const pi = getPi();
    return await pi.completePayment(paymentId, txid);
}

function errBody(e) {
    if (e.response?.data) return e.response.data;
    if (e.message) return e.message;
    return String(e);
}

module.exports = { getPi, getPayment, approvePayment, completePayment, errBody };

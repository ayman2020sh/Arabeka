const { releaseOrder } = require('./_lib/payout');
const requireUser = require('./_lib/requireUser');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { orderId } = req.body || {};
    if (!orderId) {
        return res.status(400).json({ error: 'orderId required' });
    }

    try {
        const username = await requireUser(req);
        const result = await releaseOrder(orderId, { requireBuyer: username });
        console.log('✅ Order released:', orderId, result);
        return res.status(200).json({ success: true, ...result });
    } catch (e) {
        const status = e.status
            || (e.code === 'FORBIDDEN' ? 403 : e.code === 'NOT_FOUND' ? 404 : 400);

        const piErrorDetails = e.response?.data;
        console.error('❌ release-payment', orderId, e.message);
        if (piErrorDetails) {
            console.error('❌ Pi API response details:', JSON.stringify(piErrorDetails));
        }

        return res.status(status).json({
            error: e.message,
            piApiError: piErrorDetails || null
        });
    }
};

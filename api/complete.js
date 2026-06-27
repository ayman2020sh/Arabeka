const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    const { paymentId, txid } = req.body;
    const PI_API_KEY = "lblpyyemmskpmb1uqatuzfrueofkioh3operkym17j6pzwldslbsnu2hfrwm2vqj";
    
    try {
        const response = await axios.post(`https://api.minepi.com/v2/payments/${paymentId}/complete`, { txid: txid }, {
            headers: { Authorization: `Key ${PI_API_KEY}` }
        });
        res.status(200).json({ message: "Completed", data: response.data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Completion failed" });
    }
};

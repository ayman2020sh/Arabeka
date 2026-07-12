module.exports = async function handler(req, res) {
    const API_KEY = process.env.PI_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: "PI_API_KEY غير موجود في Vercel", exists: false });
    }
    return res.status(200).json({ 
        message: "PI_API_KEY موجود", 
        keyPreview: API_KEY.substring(0, 10) + "...",
        length: API_KEY.length
    });
};

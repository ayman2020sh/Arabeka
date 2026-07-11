// api/ai-assistant.js
// باستخدام Pollinations.ai - مجاني وسحابي، من غير مفاتيح

export default async function handler(req, res) {
    // نسمح فقط بطريقة POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'استخدم POST فقط' });
    }

    // نجيب رسالة المستخدم
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'الرجاء إرسال رسالة' });
    }

    try {
        // بنبعت الطلب لـ Pollinations.ai (سحابي، من غير مفتاح)
        const response = await fetch('https://text.pollinations.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai', // الموديل المجاني
                messages: [
                    {
                        role: 'system',
                        content: `أنت مساعد منصة أرابيكا الرقمية. 
                        مهمتك مساعدة المستخدمين في فهم عملة ARA على شبكة Pi Testnet.
                        جاوب دايماً باللغة العربية.`
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                max_tokens: 500,
                temperature: 0.7
            })
        });

        const data = await response.json();

        // ناخد الرد
        if (data.choices && data.choices.length > 0) {
            const reply = data.choices[0].message.content;
            res.status(200).json({ reply });
        } else {
            res.status(500).json({ error: 'لم أستطع الحصول على رد من الذكاء' });
        }

    } catch (error) {
        console.error('خطأ في المساعد:', error);
        res.status(500).json({ error: 'حصل عطل في الخادم، حاول مرة أخرى' });
    }
}

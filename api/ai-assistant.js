// api/ai-assistant.js
// Pollinations.ai (gen.pollinations.ai) — يتطلب مفتاح API مجاني من enter.pollinations.ai

const ARABEKA_FACTS = `
معلومات حقيقية ثابتة عن منصة أرابيكا (استخدمها فقط، ولا تخترع أي معلومة غيرها):

- أرابيكا (Arabeka) هي منصة اجتماعية وتجارية عربية تعمل فوق شبكة Pi Network.
- الرابط الرسمي: arabeka.vercel.app
- العملة الرقمية الخاصة بالمنصة اسمها ARA، وتعمل حاليًا على شبكة Pi Testnet فقط (شبكة تجريبية، وليست حقيقية أو ذات قيمة مالية فعلية).
- ARA حاليًا نظام نقاط ولاء داخلي (مكافآت على النشاط مثل النشر والمتابعة وإكمال النبذة الشخصية) — وليست وسيلة دفع أو شراء داخل التطبيق.
- الشراء الفعلي داخل المتجر يتم بعملة Pi حصريًا، حسب شروط Pi Network التي تمنع استخدام أي عملة أخرى كوسيلة دفع داخل تطبيقات المنصة.
- التطبيق يتيح: نشر منشورات، التعليق والإعجاب، متابعة مستخدمين آخرين، متجر لعرض وبيع منتجات وخدمات.
- إذا سُئلت عن أي تفصيلة غير مذكورة هنا (مثل: تفاصيل تقنية دقيقة، أسعار، تواريخ إطلاق مستقبلية)، قل بوضوح إنك لا تملك هذه المعلومة بدلاً من تأليف إجابة.
`;

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'استخدم POST فقط' });
    }

    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'الرجاء إرسال رسالة' });
    }

    const POLLINATIONS_KEY = process.env.POLLINATIONS_API_KEY;
    if (!POLLINATIONS_KEY) {
        return res.status(500).json({ error: 'مفتاح المساعد الذكي غير مُعد على الخادم' });
    }

    try {
        const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${POLLINATIONS_KEY}`
            },
            body: JSON.stringify({
                model: 'openai',
                messages: [
                    {
                        role: 'system',
                        content: `أنت مساعد منصة أرابيكا. جاوب دايمًا بالعربية، بإيجاز ووضوح.
${ARABEKA_FACTS}
ممنوع تمامًا اختلاق معلومات عن أرابيكا أو ARA غير المذكورة أعلاه.`
                    },
                    { role: 'user', content: message }
                ],
                max_tokens: 500,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Pollinations error:', response.status, errText);
            return res.status(502).json({ error: 'تعذر الوصول لخدمة الذكاء الاصطناعي حاليًا' });
        }

        const data = await response.json();
        if (data.choices && data.choices.length > 0) {
            return res.status(200).json({ reply: data.choices[0].message.content });
        }
        return res.status(500).json({ error: 'لم أستطع الحصول على رد من الذكاء' });

    } catch (error) {
        console.error('خطأ في المساعد:', error);
        return res.status(500).json({ error: 'حصل عطل في الخادم، حاول مرة أخرى' });
    }
};

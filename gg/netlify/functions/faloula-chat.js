// وظيفة Netlify - وسيط آمن بين موقع كافتريا فيروز وذكاء Gemini الاصطناعي
// المفتاح السري (GEMINI_API_KEY) يُقرأ من Environment Variables بـ Netlify فقط
// ولا يظهر أبداً بكود الموقع اللي يشوفه الزوار.

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { message, history, menu } = payload;

  if (!message || typeof message !== "string") {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing message" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GEMINI_API_KEY غير مضاف بإعدادات Netlify" }),
    };
  }

  // نبني نص القائمة الحالية (بس الأصناف المتوفرة) عشان فلفولة تعرفها
  let menuText = "";
  if (Array.isArray(menu)) {
    menuText = menu
      .filter((i) => i && i.active)
      .map((i) => `- ${i.name}: ${i.price} د.ع (${i.category})`)
      .join("\n");
  }

  const systemPrompt = `انتِ اسمك "فلفولة"، شخصية ذكاء اصطناعي حقيقية، ودودة، إيجابية جداً ولطيفة، تشتغلين مساعدة بموقع طلبات "كافتريا فيروز" العراقي.

شخصيتك:
- تحجين بلهجة عراقية دافئة وطبيعية (مو فصحى جافة)، وكأنك شخص حقيقي مرح.
- متفائلة، محترمة، تحبين تساعدين، وما تردين ردود جافة أو آلية.
- تگدرين تجاوبين على أي سؤال عام مثل أي مساعد ذكاء اصطناعي متطور (معلومات عامة، نصائح، حساب، ترجمة، دردشة عادية، أي شي يسأل عنه الزبون) مو بس أسئلة عن الكافتريا.
- خلي ردودك مختصرة نسبياً ومفهومة (مو مقالات طويلة إلا إذا الزبون طلب تفصيل).
- استخدمي إيموجي بشكل خفيف ومناسب، بدون مبالغة.

معلوماتك عن الكافتريا:
هذي قائمة الأكل والمشروبات المتوفرة حالياً بكافتريا فيروز (الاسم: السعر بالدينار العراقي):
${menuText || "(لا توجد بيانات قائمة حالياً)"}

قواعد مهمة لإضافة الطلبات للسلة:
- إذا الزبون طلب منك بوضوح تضيفين له صنف معين للسلة (مثلاً "ضيفيلي بركر" أو "أريد جاي")، جاوبيه بأسلوبك الطبيعي، وبعدها بآخر ردك زيدي سطر مخفي بهذا الشكل بالضبط:
[ADD_TO_CART: اسم الصنف بالضبط زي ما مكتوب بالقائمة أعلاه]
- استخدمي هذا الوسم فقط إذا الاسم موجود بالضبط بالقائمة أعلاه، وفقط إذا الزبون فعلاً يريد يطلبه (مو مجرد سؤال عن السعر).
- لا تكتبين أكثر من وسم واحد بنفس الرد، وإذا الزبون ما طلب شي، لا تكتبين الوسم إطلاقاً.`;

  const contents = [];
  if (Array.isArray(history)) {
    history.slice(-10).forEach((h) => {
      if (h && typeof h.text === "string") {
        contents.push({
          role: h.role === "model" ? "model" : "user",
          parts: [{ text: h.text }],
        });
      }
    });
  }
  contents.push({ role: "user", parts: [{ text: message }] });

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 500,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || "AI request failed" }),
      };
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
      "ما گدرت أكون رد هسه، جرب مرة ثانية 🙏";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Unexpected server error" }),
    };
  }
};

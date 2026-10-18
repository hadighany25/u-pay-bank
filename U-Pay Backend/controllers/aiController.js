// ============================================================================
// ឯកសារ: controllers/aiController.js
// អត្ថន័យ: ខួរក្បាល AI ជំនួយការឆ្លើយតបសម្រាប់ Admin (Multi-Engine Free Cloud AI)
// ============================================================================

const SYSTEM_PROMPT = `អ្នកគឺជា "ជំនួយការផ្នែកបម្រើអតិថិជនជាន់ខ្ពស់ (Senior Customer Support Specialist)" នៃធនាគារឌីជីថល U-PAY Digital Bank។
ភារកិច្ចរបស់អ្នកគឺជួយសរសេរសារឆ្លើយតបទៅកាន់អតិថិជនជា "ភាសាខ្មែរ" ឱ្យបានគួរសម ទន់ភ្លន់ ច្បាស់លាស់ និងមានវិជ្ជាជីវៈខ្ពស់បំផុត។
ច្បាប់សំខាន់ៗ៖
1. ឆ្លើយតបតែខ្លឹមសារសារដែលត្រូវផ្ញើទៅអតិថិជនប៉ុណ្ណោះ (កុំដាក់សញ្ញាអרכ្សរ "" ឬពាក្យណែនាំខាងក្រៅ)។
2. ប្រើពាក្យគួរសម ដូចជា "សួស្តីបង", "ប្អូនសូមជម្រាបជូនថា", "សូមអរគុណដែលបានប្រើប្រាស់សេវាកម្មធនាគារ U-PAY 🙏"។
3. ខ្លីល្មម (២ ទៅ ៤ ប្រយោគ) ងាយយល់ និងផ្តល់ដំណោះស្រាយចំគោលដៅ។`;

function generateLocalSmartBankingReply(userMsg) {
  const m = String(userMsg || "").toLowerCase();

  if (m.match(/វេរលុយ|ផ្ទេរ|អត់ចូល|កាត់លុយ|បាត់លុយ|យឺត|គាំង|trx|transfer/)) {
    return "សួស្តីបង! 🙏 សូមបងកុំព្រួយបារម្ភណា បច្ចុប្បន្នក្រុមការងារបច្ចេកទេស U-PAY កំពុងត្រួតពិនិត្យលេខយោងប្រតិបត្តិការ (Ref ID) ជូនបងហើយ។ សូមបងមេត្តាផ្ញើរូបភាពវិក្កយបត្រ ឬលេខគណនីមកកាន់ប្អូនបន្ថែម ដើម្បីប្អូនដោះស្រាយជូនភ្លាមៗតែម្ដងបង! 💳✨";
  }
  if (m.match(/កាត|card|nfc|virtual|debit|credit|ជាប់សោ|lock|ដោះសោ/)) {
    return "សួស្តីបង! 💳 ទាក់ទងនឹងសេវាកម្មកាតធនាគារ U-PAY ប្អូនកំពុងឆែកមើលស្ថានភាពកាតក្នុងប្រព័ន្ធជូនបងហើយ។ តើបងចង់ឱ្យប្អូនជួយដោះសោកាត កំណត់កម្រិតទឹកប្រាក់ (Limit) ឬពិនិត្យការដឹកជញ្ជូនកាតរូបវ័ន្តដែរទៅបង? 🙏";
  }
  if (m.match(/kyc|អត្តសញ្ញាណប័ណ្ណ|verify|ផ្ទៀងផ្ទាត់|រូបថត|selfie/)) {
    return "សួស្តីបង! 🪪 ទាក់ទងនឹងការផ្ទៀងផ្ទាត់អត្តសញ្ញាណ (KYC) ប្អូនបានទទួលសំណើរបស់បងហើយ និងកំពុងពិនិត្យអនុម័តជូនបងយ៉ាងឆាប់រហ័សបំផុត។ គ្រាន់តែអនុម័តរួចភ្លាម ប្រព័ន្ធនឹងលោតសារជូនដំណឹងទៅកាន់បងភ្លាមៗតែម្ដង! ✅";
  }
  if (m.match(/លេខសម្ងាត់|ភ្លេច|pin|password|ចូលអត់កើត|login|otp/)) {
    return "សួស្តីបង! 🔐 ដើម្បីសុវត្ថិភាពគណនី និងកំណត់លេខសម្ងាត់ (Password / PIN) ថ្មី សូមបងបញ្ជាក់លេខទូរស័ព្ទ និងអ៊ីមែលរបស់បងមកកាន់ប្អូន ដើម្បីឱ្យប្អូនផ្ញើតំណភ្ជាប់ (Reset Link) ជូនបងប្តូរលេខសម្ងាត់ថ្មីភ្លាមៗណាបង! 🙏";
  }
  if (m.match(/ហាង|merchant|qr|khqr|escrow|hold/)) {
    return "សួស្តីបង! 🏪 ទាក់ទងនឹងគណនីដៃគូហាងទំនិញ (U-PAY Merchant) និងទឹកប្រាក់ទូទាត់តាម KHQR ប្អូនកំពុងត្រួតពិនិត្យជូនបងហើយ។ សូមបងមេត្តារង់ចាំបន្តិច ប្អូននឹងរាយការណ៍លទ្ធផលជូនបងវិញភ្លាមៗ! ✨";
  }
  if (m.match(/អរគុណ|បានហើយ|ok|ល្អ|ជោគជ័យ/)) {
    return "បាទ/ចាស សូមអរគុណច្រើនបង! 🥰 ប្រសិនបើបងមានចម្ងល់ ឬត្រូវការជំនួយអ្វីបន្ថែម ក្រុមការងារធនាគារ U-PAY រង់ចាំជួយបង 24/7 ជានិច្ច។ សូមជូនពរបងឱ្យជួបតែសំណាងល្អ និងរកទទួលទានមានបាន! 🙏💚";
  }

  return "សួស្តីបង! 🙏 សូមអរគុណសម្រាប់ការទាក់ទងមកកាន់ផ្នែកបម្រើអតិថិជនធនាគារ U-PAY។ ប្អូនបានទទួលសាររបស់បងហើយ និងកំពុងត្រួតពិនិត្យព័ត៌មាននេះជូនបងយ៉ាងយកចិត្តទុកដាក់បំផុត។ សូមបងមេត្តារង់ចាំបន្តិចណាបង! 👨‍💻✨";
}

const generateAdminAIReply = async (req, res) => {
  const {
    message,
    conversationContext = "",
    adminDraft = "",
    tone = "polite",
  } = req.body || {};

  const userTaskPrompt = adminDraft
    ? `Admin បានសរសេរព្រាងខ្លីថា៖ "${adminDraft}"។ សូមជួយកែសម្រួល និងពង្រីកឃ្លានេះឱ្យទៅជាសារឆ្លើយតបអតិថិជនជាភាសាខ្មែរដ៏គួរសម និងមានវិជ្ជាជីវៈបំផុត ដើម្បីឆ្លើយតបទៅនឹងសារអតិថិជន៖ "${message}"។`
    : `${conversationContext ? `ប្រវត្តិសន្ទនាថ្មីៗ៖\n${conversationContext}\n\n` : ""}សារចុងក្រោយរបស់អតិថិជន៖ "${message}"\n\nសូមសរសេរសារឆ្លើយតបជាភាសាខ្មែរដ៏គួរសម និងចំគោលដៅ៖`;

  // ១. សាកល្បង Google Gemini API (ឆែកមើលតែ Key ណាដែលផ្តើមដោយ AIza...)
  const geminiKey = (process.env.GEMINI_API_KEY || "")
    .trim()
    .replace(/^["'](.+)["']$/, "$1");
  if (geminiKey.startsWith("AIza")) {
    try {
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: `${SYSTEM_PROMPT}\n\n${userTaskPrompt}` }] },
            ],
            generationConfig: { temperature: 0.4, maxOutputTokens: 320 },
          }),
        },
      );
      const gemData = await gemRes.json();
      const gemText =
        gemData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (gemText) {
        return res.json({
          success: true,
          engine: "Gemini 2.5 Flash",
          reply: gemText.replace(/^["']|["']$/g, ""),
        });
      }
    } catch (e) {}
  }

  // ២. សាកល្បង Groq API (ឆែកមើល Key ដែលផ្តើមដោយ gsk_...)
  const groqKey = (process.env.GROQ_API_KEY || "")
    .trim()
    .replace(/^["'](.+)["']$/, "$1");
  if (groqKey.startsWith("gsk_")) {
    try {
      const groqRes = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userTaskPrompt },
            ],
            temperature: 0.4,
            max_tokens: 320,
          }),
        },
      );
      const groqData = await groqRes.json();
      const groqText = groqData?.choices?.[0]?.message?.content?.trim();
      if (groqText) {
        return res.json({
          success: true,
          engine: "Groq Llama-3.3 70B",
          reply: groqText.replace(/^["']|["']$/g, ""),
        });
      }
    } catch (e) {}
  }

  // ៣. សាកល្បង Free Cloud AI (មិនបាច់មាន API Key សោះ - គាំទ្រ GPT-4o-mini / Mistral)
  const freeModels = ["openai", "mistral"];
  for (const mdl of freeModels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const freeRes = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: mdl,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userTaskPrompt },
          ],
          temperature: 0.4,
        }),
      });
      clearTimeout(timeoutId);

      if (freeRes.ok) {
        const freeData = await freeRes.json();
        const freeText = freeData?.choices?.[0]?.message?.content?.trim();
        if (freeText) {
          return res.json({
            success: true,
            engine: "U-Pay Cloud AI (Free)",
            reply: freeText.replace(/^["']|["']$/g, ""),
          });
        }
      }
    } catch (e) {}
  }

  // ៤. Fallback ចុងក្រោយ៖ ខួរក្បាលជំនាញធនាគារ U-Pay
  return res.json({
    success: true,
    engine: "U-Pay Banking Brain",
    reply: generateLocalSmartBankingReply(message),
  });
};

module.exports = {
  generateAdminAIReply,
};

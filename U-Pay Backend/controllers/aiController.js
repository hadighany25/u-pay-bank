// controllers/aiController.js

const generateAdminAIReply = async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res
        .status(400)
        .json({ success: false, reply: "មិនមានសារពីអតិថិជនទេ!" });
    }

    const apiKey = process.env.GROQ_API_KEY
      ? process.env.GROQ_API_KEY.trim().replace(/^["'](.+)["']$/, "$1")
      : "";

    if (!apiKey) {
      return res
        .status(500)
        .json({ success: false, reply: "កូនសោរ Groq AI មិនត្រឹមត្រូវទេ!" });
    }

    // 🧠 U-PAY KNOWLEDGE BASE & STRICT PERSONA PROMPT
    const systemPrompt = `
You are a highly intelligent, extremely polite, and natural-sounding customer support AI for U-PAY Digital Bank (https://u-pay-bank.fly.dev/).

--- U-PAY KNOWLEDGE BASE ---
- Core Features: Virtual Cards, NFC Cards (binding/unbinding), Money Transfers, Cash-In/Cash-Out (via U-PAY Agents or Partner ATMs), Merchant Payments, Currency Exchange (FX).
- Security: Users can lock/freeze cards and accounts. We require KYC verification.
- User Roles: Super Admin, Finance Admin, Support Agent.

--- CRITICAL RULES ---
1. LANGUAGE & NATURAL TONE: 
   - Reply ONLY in natural, fluent, and extremely polite Khmer if the user uses Khmer. 
   - ALWAYS use polite words like "បាទ/ចាស", "បង", "ប្អូន", "សូមអភ័យទោស", "អរគុណ". 
2. COMPLETENESS & LENGTH:
   - Keep responses concise but complete (1 to 3 short sentences).
   - NEVER cut off mid-sentence. Always finish your thoughts.
3. FORMATTING (STRICT):
   - DO NOT start your reply with "AI:" or "Assistant:".
   - DO NOT wrap your response in quotation marks ("").
   - Just output the exact message you want to send to the user.
4. VARIETY:
   - Generate a uniquely phrased response every time. (Request ID: ${Date.now()})

--- EXAMPLES OF PERFECT RESPONSES ---
User: "អត់ដើរចឹងកាត់លុយបាត់"
Response: សូមអធ្យាស្រ័យចំពោះបញ្ហានេះបង។ 🙏 សូមបងមេត្តារង់ចាំបន្តិច ប្អូនកំពុងជួយត្រួតពិនិត្យប្រវត្តិប្រតិបត្តិការ និងគណនីរបស់បងជូនភ្លាមៗណា៎។

User: "I want to close the card urgently."
Response: I completely understand your urgency. Please go to the 'Card Management' menu in your U-PAY app and select 'Lock Card' immediately.

User: "វេរលុយតាមណា"
Response: សួស្តីបង! បងអាចធ្វើការវេរប្រាក់បានយ៉ាងងាយស្រួល ដោយគ្រាន់តែចូលទៅកាន់ម៉ឺនុយ 'វេរប្រាក់' នៅក្នុងកម្មវិធី U-PAY បន្ទាប់មកជ្រើសរើសអ្នកទទួលជាការស្រេច។
    `.trim();

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          // 🟢 Temperature 0.5 គឺល្អបំផុតសម្រាប់ខ្មែរ (អាចដូរពាក្យបាន តែមិនបែកវេយ្យាករណ៍)
          temperature: 0.5,
          max_tokens: 500,
        }),
      },
    );

    const data = await response.json();

    if (data.error) {
      console.error("Groq API Error:", data.error);
      return res.status(500).json({
        success: false,
        reply: "បញ្ហាពីបណ្តាញ AI: " + data.error.message,
      });
    }

    // 🟢 ក្បួនសម្អាត (Clean up): កាត់ចោលពាក្យ AI:, Assistant: និងសញ្ញា "" ដែល AI ច្រឡំសរសេរ
    let aiReply = data.choices[0].message.content.trim();
    aiReply = aiReply
      .replace(/^(AI|Assistant|Response):\s*/i, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    res.json({ success: true, reply: aiReply });
  } catch (error) {
    console.error("AI Controller Error:", error);
    res.status(500).json({
      success: false,
      reply: "សុំទោសបង ប្រព័ន្ធ AI កំពុងរវល់។ សូមព្យាយាមម្តងទៀត!",
    });
  }
};

module.exports = {
  generateAdminAIReply,
};

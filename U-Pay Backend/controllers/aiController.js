// controllers/aiController.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

const generateAdminAIReply = async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res
        .status(400)
        .json({ success: false, reply: "មិនមានសារពីអតិថិជនទេ!" });
    }

    const apiKey = process.env.GEMINI_API_KEY
      ? process.env.GEMINI_API_KEY.trim().replace(/^["'](.+)["']$/, "$1")
      : "";

    if (!apiKey) {
      return res
        .status(500)
        .json({ success: false, reply: "កូនសោរ Gemini AI មិនត្រឹមត្រូវទេ!" });
    }

    // បង្កើត Instance របស់ Google AI ដោយប្រើ API Key
    const genAI = new GoogleGenerativeAI(apiKey);
    const systemPrompt = `You are a highly intelligent, extremely polite, and natural-sounding customer support AI for U-PAY Digital Bank... (ដាក់ Prompt របស់អ្នកដដែលនៅទីនេះ)`;

    // ជ្រើសរើស Model និកំណត់ System Instruction តាមរយៈ SDK ផ្ទាល់
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest", // ដកពាក្យ 1.5- ចេញ ដាក់ត្រឹមប៉ុណ្ណេះបានហើយ
      systemInstruction: systemPrompt,
    });

    // ហៅ AI ឱ្យដំណើរការ
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 150,
      },
    });

    // ទាញយកចម្លើយ
    let aiReply = result.response.text();

    // សម្អាតទម្រង់ដែល AI អាចច្រឡំសរសេរចូល
    aiReply = aiReply
      .replace(/^(AI|Assistant|Response):\s*/i, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    res.json({ success: true, reply: aiReply });
  } catch (error) {
    console.error("AI Controller Error:", error);
    res.status(500).json({
      success: false,
      reply:
        "សុំទោសបង ប្រព័ន្ធ AI កំពុងរវល់ឬមានបញ្ហាបច្ចេកទេស។ សូមព្យាយាមម្តងទៀត!",
    });
  }
};

module.exports = { generateAdminAIReply };

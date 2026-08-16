// controllers/aiController.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ទាញយកកូនសោរពី .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// មុខងារសម្រាប់ឆ្លើយតបសារ Admin Chat
const generateAdminAIReply = async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res
        .status(400)
        .json({ success: false, reply: "មិនមានសារពីអតិថិជនទេ!" });
    }

    // ប្រើប្រាស់ Model ស៊េរីថ្មីបំផុត និងលឿនបំផុត (gemini-1.5-flash)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 🧠 កំណត់តួនាទីឱ្យ AI (System Prompt)
    const prompt = `
            អ្នកគឺជាភ្នាក់ងារបម្រើអតិថិជនដ៏ឆ្លាតវៃរបស់ធនាគារ U-PAY។
            អតិថិជនបានផ្ញើសារមកថា៖ "${userMessage}"
            
            សូមសរសេរសារឆ្លើយតបជាភាសាខ្មែរឱ្យបានខ្លី ពិរោះ សុភាពរាបសារ និងប្រកបដោយវិជ្ជាជីវៈ។
            ប្រសិនបើអតិថិជនខឹង ឬរអ៊ូរទាំ សូមប្រើពាក្យលួងលោម និងសុំទោសជាមុនសិន។
            កុំប្រើពាក្យប្លែកៗ កុំសរសេរវែងពេក។
        `;

    // បញ្ជាឱ្យ AI គិតនិងបង្កើតចម្លើយ
    const result = await model.generateContent(prompt);
    const aiReply = result.response.text();

    // បោះចម្លើយត្រលប់ទៅឱ្យ Frontend វិញ
    res.json({ success: true, reply: aiReply });
  } catch (error) {
    console.error("AI Controller Error:", error);
    res
      .status(500)
      .json({
        success: false,
        reply: "សុំទោសបង ប្រព័ន្ធ AI កំពុងរវល់។ សូមព្យាយាមម្តងទៀត!",
      });
  }
};

// Export មុខងារនេះយកទៅប្រើនៅខាងក្រៅ
module.exports = {
  generateAdminAIReply,
};

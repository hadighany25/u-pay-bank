// controllers/aiController.js

const generateAdminAIReply = async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res
        .status(400)
        .json({ success: false, reply: "មិនមានសារពីអតិថិជនទេ!" });
    }

    // យក Token ពី Environment Variable
    const apiKey = process.env.GEMINI_API_KEY
      ? process.env.GEMINI_API_KEY.trim().replace(/^["'](.+)["']$/, "$1")
      : "";

    if (!apiKey) {
      return res
        .status(500)
        .json({ success: false, reply: "កូនសោរ Gemini AI មិនត្រឹមត្រូវទេ!" });
    }

    const systemPrompt = `You are a highly intelligent, extremely polite, and natural-sounding customer support AI for U-PAY Digital Bank... (ដាក់ Prompt របស់អ្នកដដែលនៅទីនេះ)`;

    // ហៅទៅកាន់ Google Gemini 1.5 Flash API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userMessage }],
            },
          ],
          generationConfig: {
            temperature: 0.4, // បន្ថយមកត្រឹម 0.4 ឱ្យឆ្លើយចំៗ និងផ្លូវការ
            maxOutputTokens: 150, // កំណត់ត្រឹមនេះកុំឱ្យវាឆ្លើយវែងពេកសន្សំ Limit
          },
        }),
      },
    );

    const data = await response.json();

    if (data.error) {
      console.error("Gemini API Error:", data.error);
      return res.status(500).json({
        success: false,
        reply: "បញ្ហាពីបណ្តាញ AI: " + data.error.message,
      });
    }

    let aiReply = data.candidates[0].content.parts[0].text;

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
      reply: "សុំទោសបង ប្រព័ន្ធ AI កំពុងរវល់។ សូមព្យាយាមម្តងទៀត!",
    });
  }
};

module.exports = { generateAdminAIReply };

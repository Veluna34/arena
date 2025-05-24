require("dotenv").config();
const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Format team fighters into readable string for prompt
function formatTeam(teamFighters) {
  return teamFighters
    .map((f) => `- ${f.name} (🧠 ${f.mental || "None"} | 💪 ${f.physical || "None"} | 🎒 ${f.item || "None"})`)
    .join("\n");
}

// Battle simulation route
app.post("/api/battle", async (req, res) => {
  const {
    team1Fighters,
    team2Fighters,
    team1Avatar,
    team2Avatar,
    team1,
    team2,
    team1Mental,
    team1Physical,
    team2Mental,
    team2Physical
  } = req.body;

  let team1Formatted = "";
  let team2Formatted = "";

  if (Array.isArray(team1Fighters) && Array.isArray(team2Fighters)) {
    team1Formatted = formatTeam(team1Fighters);
    team2Formatted = formatTeam(team2Fighters);
  } else {
    team1Formatted = `- ${team1} (🧠 ${team1Mental || "Unknown"} | 💪 ${team1Physical || "Unknown"})`;
    team2Formatted = `- ${team2} (🧠 ${team2Mental || "Unknown"} | 💪 ${team2Physical || "Unknown"})`;
  }

  const prompt = `
You are a legendary battle narrator AI. Write a long, cinematic, strategic, and round-by-round battle between two fighters or teams.

Each fighter has unique mental, physical, and item-based abilities. Incorporate their gear, tactics, and personality.

Each fight must end in death — no ties, no peace. One side must fall dramatically.

Use vivid action, environmental detail, and creative attack/counter moves.

Team 1:
${team1Formatted}

Team 2:
${team2Formatted}

Begin:
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a brutal, unforgiving battle narrator. You MUST kill one side. Never end in peace.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 4500,
      temperature: 0.9,
    });

    let summary = completion.choices[0].message.content.trim();

    // Extract steps and pad to 5 if needed
    let steps = summary.split(/(?<=\.)\s*\n+/).filter(Boolean);

    while (steps.length < 5) {
      steps.push("A tense moment between two fighters in a dramatic battleground.");
    }

    steps = steps.slice(0, 5); // Only use first 5

    let imageResponses = [];

    try {
      imageResponses = await Promise.all(
        steps.map(async (text, index) => {
          try {
            const rawPrompt = `Dramatic illustrated battle moment: ${text}, in cinematic lighting and action pose, intense expression, dynamic angle`;

            const safePrompt = rawPrompt
              .replace(/[^\w\s.,'’"!?-]/g, "")
              .slice(0, 950);

            console.log(`🎯 Prompt for image ${index + 1}:`, safePrompt);

            const image = await openai.images.generate({
              model: "dall-e-3",
              prompt: safePrompt,
              size: "1024x1024",
            });

            const imageUrl = image.data[0]?.url;
            console.log(`✅ Image ${index + 1} URL:`, imageUrl);
            return imageUrl || null;
          } catch (imgErr) {
            console.warn(`⚠️ Image generation failed at step ${index + 1}:`, imgErr.message);
            return null;
          }
        }),
      )
            res.json({
      summary,
      images: imageResponses.filter(Boolean),
        });
  
  }catch (imgOuterErr) {
      console.error("❌ Unexpected image generation error:", imgOuterErr.message || imgOuterErr);
      imageResponses = [];
    }



  } catch (err) {
    console.error("❌ OpenAI Error:", err.message || err);
    res.status(500).json({ summary: null, images: [] });
  }
});



app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
    apiKey: process.env.GPTA_API_KEY,
});

async function main() {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: "Hello, how are you?" }],
        });
        console.log("API Response:", JSON.stringify(completion, null, 2)); // Log the full API response
        console.log(
            "Extracted Content:",
            completion.choices[0].message.content
        ); // Attempt to log specific content
    } catch (error) {
        console.error("Error during API call:", error);
    }
}

main();

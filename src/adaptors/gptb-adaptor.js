// File: src/adaptors/gptb-adaptor.js

// Import necessary libraries
const { OpenAI } = require("openai");
const fs = require("fs").promises;
require("dotenv").config({ path: '../../config/.env' });

// Configuration using GPTB's specific API key from the .env file
const openai = new OpenAI({
    apiKey: process.env.GPTB_API_KEY,
});

// Utility function to read and validate JSON data logged by GPTA
const readAndValidateData = async (filename) => {
    const filePath = `data/news/${filename}`;
    try {
        const dataJson = await fs.readFile(filePath, { encoding: "utf8" });
        const data = JSON.parse(dataJson);
        if (!data) {
            throw new Error("Invalid or empty JSON data");
        }
        return data;
    } catch (error) {
        console.error(`Error processing file: ${filePath}`, error);
        throw error; // Ensure errors are propagated up
    }
};

// Function to read and parse stock price data which is not in JSON format
const readStockPriceData = async (filename) => {
    const filePath = `data/stock/${filename}`;
    try {
        const stockPriceDataText = await fs.readFile(filePath, {
            encoding: "utf8",
        });
        // Assuming the data is tab-separated; adjust if it uses commas or another delimiter
        const rows = stockPriceDataText
            .split("\n")
            .map((row) => row.split("\t"));

        // Optionally convert rows into a more structured format if needed
        const headers = rows[0];
        const data = rows.slice(1).map((row) => {
            let rowData = {};
            row.forEach((value, index) => {
                rowData[headers[index]] = value;
            });
            return rowData;
        });

        return data; // Return parsed data as an array of objects
    } catch (error) {
        console.error(`Error processing stock price file: ${filePath}`, error);
        throw error;
    }
};

// Function to analyze how news, sentiment, and stock prices affected market trends
const analyzeImpactOnStockPrices = async (
    extractedInfo,
    sentimentAnalysis,
    stockPrices,
    day
) => {
    const prompt = `Utilise the following data to conduct a comprehensive analysis of how these factors might influence stock price movements for ${day}. Focus on the extracted information, its sentiment analysis, and the corresponding stock price data. Your analysis should cover the following aspects in detail:

1. **Relevance to Stock Prices**: Identify and explain the direct relevance of the extracted information to stock market trends. Specify the presence of company earnings reports, policy changes, market sentiment shifts, geopolitical events, or other significant factors, and discuss their potential impact on stock prices.

2. **Sentiment Influence**: Analyse how the sentiment (positive, negative, neutral) expressed in the news correlates with observed or potential stock price movements. Consider whether the sentiment could lead to increased trading volume, market optimism or pessimism, or price volatility, and provide examples to support your analysis.

3. **Causative Links**: Establish and explain any causative links between the news sentiment and stock price fluctuations. Highlight clear patterns where certain types of news or sentiment consistently impact stock prices, and discuss the strength and reliability of these patterns.

4. **Comparative Analysis**: Compare the impact of the current day's news and sentiment with data from previous days. Identify cumulative effects or changing trends that might influence future stock price predictions. Discuss how these trends could affect market behaviour and provide insights for future analysis.

5. **Potential Anomalies or Exceptions**: Identify and explain any anomalies or exceptions where the expected impact of news sentiment did not align with actual stock price movements. Suggest possible reasons for these discrepancies, considering factors such as market conditions, external influences, or data inconsistencies.

Provide a detailed and structured analysis, incorporating quantitative and qualitative insights to support your conclusions.`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: prompt },
                {
                    role: "user",
                    content: JSON.stringify({
                        extractedInformation: extractedInfo,
                        sentiment: sentimentAnalysis,
                        stockPrices: stockPrices,
                    }),
                },
            ],
        });

        if (
            !completion ||
            !completion.choices ||
            completion.choices.length === 0
        ) {
            throw new Error("Invalid response structure from API.");
        }

        const impactAnalysis = completion.choices[0].message.content.trim();
        await fs.writeFile(
            `data/logs/log.GPTB.${day}.impact.json`,
            JSON.stringify({ impactAnalysis }, null, 2),
            { encoding: "utf8" }
        );
        return impactAnalysis;
    } catch (error) {
        console.error(
            `Error analyzing impact on stock prices for ${day}:`,
            error
        );
        throw error;
    }
};

// Function to predict future stock prices based on the analysis
const predictStockPrices = async (impactAnalysis, day) => {
    const prompt = `Using the analysis of news impact and market sentiment from Day ${
        parseInt(day.replace("day", "")) - 1
    }, forecast the stock prices for Day ${parseInt(
        day.replace("day", "")
    )}. Your prediction should clearly state whether stock prices will rise or fall, by how much, and the reasoning behind your forecast. Ensure that the prediction is quantitative, specifying the expected percentage change or price range. Consider all relevant factors such as market trends, sentiment shifts, historical data, and any anomalies observed. The prediction must be actionable and precise, enabling further validation and fine-tuning.`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: prompt },
                {
                    role: "user",
                    content: impactAnalysis,
                },
            ],
        });

        if (
            !completion ||
            !completion.choices ||
            completion.choices.length === 0
        ) {
            throw new Error("Invalid response structure from API.");
        }

        const prediction = completion.choices[0].message.content.trim();
        await fs.writeFile(
            `data/logs/log
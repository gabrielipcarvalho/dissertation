// File: GPTC_Adaptor.js
const { OpenAI } = require("openai");
const fs = require("fs").promises;

// Configuration using GPTC's specific API key from the .env file
const openai = new OpenAI({
	apiKey: process.env.GPTC_API_KEY,
});

// Function to read and parse stock price data from a TSV file
const readStockPriceData = async (filename) => {
	const filePath = `Data/${filename}`;
	try {
		const stockPriceDataText = await fs.readFile(filePath, {
			encoding: "utf8",
		});
		const rows = stockPriceDataText
			.trim()
			.split("\n")
			.map((row) => row.split("\t"));
		const headers = rows.shift(); // Extract headers
		const data = rows.map((row) => {
			return row.reduce((obj, value, index) => {
				obj[headers[index]] = value;
				return obj;
			}, {});
		});
		return data;
	} catch (error) {
		console.error(
			`Error reading stock price data from file: ${filePath}`,
			error
		);
		throw error;
	}
};

// Function to analyze stock prices using GPT model
const analyzeStockPricesWithGPT = async (stockPrices) => {
	const prompt = `Analyze the following stock price data for trends and patterns, and make a concrete prediction for the next trading day. Clearly state whether stock prices are expected to rise or fall, and specify the expected percentage change or price range. Your prediction must be quantitative and actionable, enabling validation against actual market outcomes. Consider historical trends, recent market behaviour, and any notable anomalies in the data. The stock price data to analyze is: ${JSON.stringify(
		stockPrices
	)}`;

	try {
		const completion = await openai.chat.completions.create({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "system",
					content:
						"You are a financial analyst. Your task is to analyze the provided stock price data and make a concrete prediction about future stock price movements. Your prediction must be clear, quantitative, and actionable.",
				},
				{ role: "user", content: prompt },
			],
		});

		if (
			!completion ||
			!completion.choices ||
			completion.choices.length === 0
		) {
			console.error(
				"Invalid response from the API or missing data:",
				completion
			);
			throw new Error("Invalid response structure from API.");
		}

		const insights = completion.choices[0].message.content.trim();
		return insights;
	} catch (error) {
		console.error(
			"Error during GPT model analysis of stock prices:",
			error
		);
		throw error;
	}
};

// Export functions to be used by the orchestration program
module.exports = {
	readStockPriceData,
	analyzeStockPricesWithGPT,
};

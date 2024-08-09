// File: gpta-adaptor.js

// Import necessary libraries
const { OpenAI } = require("openai");
const fs = require("fs").promises; // Using fs.promises for async file operations
require("dotenv").config();

// Configuration using GPTA's specific API key from the .env file
const openai = new OpenAI({
	apiKey: process.env.GPTA_API_KEY,
});

// Utility function to log data to a file, ensuring it is in JSON format
const logToFile = async (filename, data) => {
	const path = `Data/${filename}`;
	const dataToLog = JSON.stringify(data, null, 2); // Convert data to a JSON string
	await fs.writeFile(path, dataToLog, { encoding: "utf8" }); // Write data as JSON
};

// Function to collect and log news data from a file
const collectAndLogNews = async (day) => {
	const filePath = `Data/news-data-${day}.txt`;

	try {
		const newsDataText = await fs.readFile(filePath, {
			encoding: "utf8",
		});

		// Log the collected news data as JSON
		await logToFile(`log.news.${day}.txt`, { content: newsDataText });

		return newsDataText; // Return text directly
	} catch (error) {
		console.error(`Error reading news data from file for ${day}:`, error);
		throw error;
	}
};

// Function to extract key information from news using GPT-4 with the chat completions endpoint
const extractKeyInformation = async (newsData, day) => {
	try {
		const completion = await openai.chat.completions.create({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "system",
					content:
						"Please analyse the following text and extract key information that could significantly impact stock market trends. Focus on identifying critical details related to corporate earnings, economic announcements, geopolitical events, market forecasts, and other influential factors. Ensure the summary is concise and highlights the potential market implications of each identified element.",
				},
				{
					role: "user",
					content: newsData,
				},
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

		const extractedInformation =
			completion.choices[0].message.content.trim();
		await logToFile(`log.GPTA.${day}.extracted.txt`, {
			extractedInformation,
		});

		return extractedInformation;
	} catch (error) {
		console.error(`Error extracting key information for ${day}:`, error);
		throw error;
	}
};

// Function to execute sentiment analysis on extracted news, now using the chat completions endpoint
const executeSentimentAnalysis = async (extractedInformation, day) => {
	try {
		const completion = await openai.chat.completions.create({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "system",
					content:
						"Utilise the provided information to perform a comprehensive sentiment analysis, determining the overall sentiment (positive, negative, or neutral) and its intensity. Focus on how this sentiment might affect stock market trends, considering the potential impact on market movements, investor behaviour, and future market forecasts. Provide a detailed explanation of your analysis and its implications for stock market trends.",
				},
				{
					role: "user",
					content: extractedInformation,
				},
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

		const sentimentAnalysis = completion.choices[0].message.content.trim();
		await logToFile(`log.GPTA.${day}.sentiment.txt`, { sentimentAnalysis });

		return sentimentAnalysis;
	} catch (error) {
		console.error(`Error during sentiment analysis for ${day}:`, error);
		throw error;
	}
};

// Export functions to be used by the orchestration program
module.exports = {
	collectAndLogNews,
	extractKeyInformation,
	executeSentimentAnalysis,
};

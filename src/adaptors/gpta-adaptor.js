// File: src/adaptors/gpta-adaptor.js

// Import necessary libraries
const { OpenAI } = require("openai");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config({
	path: path.resolve(__dirname, "../../config/.env"),
});
const ProgressBar = require("progress");

// Configuration using GPTA's specific API key from the .env file
const openai = new OpenAI({
	apiKey: process.env.GPTA_API_KEY,
});

// Function to load the planner file and find the corresponding news entries for a given position
const getNewsForPosition = async (position) => {
	console.log(
		`Loading planner file to find news entries for position ${position}...`
	);
	const plannerPath = path.resolve(
		__dirname,
		"../../data/planner/planner.json"
	);
	const plannerData = JSON.parse(await fs.readFile(plannerPath, "utf8"));
	const entry = plannerData.find((item) => item.position === position);

	if (!entry || !entry.news) {
		throw new Error(`No news found for position ${position}`);
	}

	console.log(`Found news entries for position ${position}: ${entry.news}`);
	return entry.news.split(", ").map((newsId) => newsId.trim());
};

// Function to fetch news data for a given news ID from news.json
const fetchNewsData = async (newsId) => {
	console.log(`Fetching news data for ${newsId}...`);
	const newsPath = path.resolve(__dirname, "../../data/news/news.json");
	const allNewsData = JSON.parse(await fs.readFile(newsPath, "utf8"));

	if (!allNewsData[newsId]) {
		throw new Error(`News data for ${newsId} not found`);
	}

	// Extract relevant parts from the news object and concatenate them
	const newsArticles = allNewsData[newsId];
	console.log(`Fetched ${newsArticles.length} articles for ${newsId}`);
	return newsArticles
		.map((article) => `${article.title}\n\n${article.body}`)
		.join("\n\n");
};

// Function to extract key information using GPT
const extractKeyInformation = async (newsData) => {
	console.log("Extracting key information from news data...");

	const completion = await openai.chat.completions.create({
		model: "gpt-4o",
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

	if (!completion || !completion.choices || completion.choices.length === 0) {
		throw new Error("Invalid response structure from API.");
	}

	const extractedInformation = completion.choices[0].message.content.trim();

	console.log("Completed extraction of key information.");
	return extractedInformation;
};

// Function to perform sentiment analysis using GPT
const performSentimentAnalysis = async (keyInformation) => {
	console.log("Performing sentiment analysis on key information...");
	const completion = await openai.chat.completions.create({
		model: "gpt-4o",
		messages: [
			{
				role: "system",
				content:
					"Utilise the provided information to perform a comprehensive sentiment analysis, determining the overall sentiment (positive, negative, or neutral) and its intensity. Focus on how this sentiment might affect stock market trends, considering the potential impact on market movements, investor behaviour, and future market forecasts. Provide a detailed explanation of your analysis and its implications for stock market trends.",
			},
			{
				role: "user",
				content: keyInformation,
			},
		],
	});

	if (!completion || !completion.choices || completion.choices.length === 0) {
		throw new Error("Invalid response structure from API.");
	}

	console.log("Completed sentiment analysis.");
	return completion.choices[0].message.content.trim();
};

// Function to log the results to the gpta.logs.json file
const logResults = async (
	position,
	currentDay,
	keyInformation,
	sentimentAnalysis
) => {
	console.log(
		`Logging results for position ${position}, day ${currentDay}...`
	);
	const logFilePath = path.resolve(
		__dirname,
		"../../data/logs/gpta.logs.json"
	);

	// Read existing log data
	let logData = [];
	try {
		// Attempt to read the log file
		const logFileContents = await fs.readFile(logFilePath, "utf8");

		// If the log file is not empty, parse it
		if (logFileContents.trim()) {
			logData = JSON.parse(logFileContents);
		} else {
			console.log("Log file is empty, starting with a new log file.");
		}
	} catch (error) {
		if (error.code === "ENOENT") {
			// File does not exist, this is fine and we will start with an empty array
			console.log("Log file not found, creating a new one.");
		} else if (error instanceof SyntaxError) {
			// JSON is malformed, log this error
			console.error(
				"Log file is malformed, starting with a new log file."
			);
		} else {
			throw error; // Throw any error that is not related to file existence or JSON parsing
		}
	}

	// Append the new log entry
	logData.push({
		position: position,
		"current day": currentDay,
		data: {
			"key information": keyInformation,
			"sentiment analysis": sentimentAnalysis,
		},
	});

	// Write the updated log data back to the file
	await fs.writeFile(logFilePath, JSON.stringify(logData, null, 2), {
		encoding: "utf8",
	});
	console.log(
		`Results logged successfully for position ${position}, day ${currentDay}.`
	);
};

// Main GPTA function
const gpta = async (position) => {
	try {
		console.log(`Starting GPTA processing for position ${position}...`);
		const newsIds = await getNewsForPosition(position);

		for (const newsId of newsIds) {
			const newsData = await fetchNewsData(newsId);
			const keyInformation = await extractKeyInformation(newsData);
			const sentimentAnalysis = await performSentimentAnalysis(
				keyInformation
			);

			await logResults(
				position,
				newsId,
				keyInformation,
				sentimentAnalysis
			);
			console.log(
				`GPTA processed news for ${newsId} at position ${position}`
			);
		}

		console.log(`GPTA completed processing for position ${position}.`);
	} catch (error) {
		console.error(`Error in GPTA for position ${position}:`, error);
		throw error;
	}
};

module.exports = {
	gpta,
};

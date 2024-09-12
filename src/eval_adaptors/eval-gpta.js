// File: src/eval_adaptors/eval-gpta.js

const fs = require("fs/promises");
const path = require("path");
const { OpenAI } = require("openai");
require("dotenv").config({
	path: path.resolve(__dirname, "../../config/.env"),
});

// Configuration using GPTA's specific API key from the .env file
const openai = new OpenAI({
	apiKey: process.env.GPTA_API_KEY,
});

// Function to load JSON data from a file
async function loadJsonFile(filePath) {
	try {
		const fileContents = await fs.readFile(filePath, "utf8");
		return JSON.parse(fileContents);
	} catch (error) {
		console.error(`Error loading JSON from file ${filePath}:`, error);
		throw error;
	}
}

// Function to fetch data for GPTA evaluation based on the provided position
async function fetchData(position) {
	console.log(`Fetching data for position: ${position}`);

	const plannerFilePath = path.join(
		__dirname,
		"../../data/planner/planner.json"
	);
	const plannerData = await loadJsonFile(plannerFilePath);

	const currentEntry = plannerData.find(
		(entry) => entry.position === position
	);
	if (!currentEntry) {
		throw new Error(`No planner data found for position ${position}`);
	}

	const newsIds = currentEntry.news
		.split(", ")
		.map((newsId) => newsId.trim());

	const newsFilePath = path.join(__dirname, "../../data/news/news.json");
	const newsData = await loadJsonFile(newsFilePath);

	const relevantNews = newsIds.map((newsId) => newsData[newsId]).flat();

	const gptaLogsFilePath = path.join(
		__dirname,
		"../../data/logs/gpta.logs.json"
	);
	const gptaLogsData = await loadJsonFile(gptaLogsFilePath);
	const gptaLogEntries = gptaLogsData.filter(
		(entry) => entry.position === position
	); // Use filter to get all entries

	const gptbLogsFilePath = path.join(
		__dirname,
		"../../data/logs/gptb.logs.json"
	);
	const gptbLogsData = await loadJsonFile(gptbLogsFilePath);
	const gptbLogEntry = gptbLogsData.find(
		(entry) => entry.position === position
	);

	const gptbEvalFilePath = path.join(
		__dirname,
		"../../data/logs/eval-gptb.logs.json"
	);
	const gptbEvalData = await loadJsonFile(gptbEvalFilePath);
	const gptbEvalEntry = gptbEvalData.find(
		(entry) => entry.position === position + 1
	); // Fetch for position + 1

	if (!gptaLogEntries.length || !gptbLogEntry || !gptbEvalEntry) {
		throw new Error(`No log data found for position ${position}`);
	}

	return {
		news: relevantNews,
		gptaLogEntries,
		gptbLogEntry,
		gptbEvalEntry,
	};
}

// Function to perform GPTA evaluation
async function evaluateGPTA(
	gptaLogEntry,
	gptbLogEntry,
	gptbEvalEntry,
	modelName
) {
	// Added modelName parameter
	const { "key information": keyInfo, "sentiment analysis": sentiment } =
		gptaLogEntry.data;
	const { prediction } = gptbLogEntry.data;
	const { "predict-evaluation": evaluation } = gptbEvalEntry.data;

	const prompt = `
    GPTA performed a sentiment analysis for the following key information:
    ${keyInfo}

    Sentiment analysis result:
    ${sentiment}

    GPTB prediction:
    ${prediction}

    GPTB evaluation:
    ${evaluation}

	- Did GPTB’s prediction match the actual outcome?
    - How much did GPTA's sentiment analysis influence GPTB’s prediction accuracy?
    - If GPTB was correct, assess the sentiment’s contribution.
    - If GPTB was incorrect, evaluate whether GPTA’s sentiment analysis caused GPTB to exaggerate positive or negative aspects, leading to an incorrect prediction.
    - Provide suggestions on how GPTA can, without any new dataset, improve its sentiment analysis for future predictions.
    - The response must be within 1500 characters.
	`;

	console.log("Sending API request for GPTA evaluation.");
	const completion = await openai.chat.completions.create({
		model: modelName, // Use dynamic model name here
		messages: [
			{
				role: "system",
				content:
					"You are an expert in stock market sentiment analysis evaluation.",
			},
			{ role: "user", content: prompt },
		],
	});

	if (!completion || !completion.choices || completion.choices.length === 0) {
		throw new Error("Invalid response structure from API.");
	}

	return completion.choices[0].message.content.trim();
}

// Function to log GPTA evaluation results
async function logGPTAEvaluation(position, evaluation) {
	console.log(`Logging GPTA evaluation result for position ${position}`);
	const logFilePath = path.join(
		__dirname,
		"../../data/logs/eval-gpta.logs.json"
	);

	let logData = [];
	try {
		const logFileContents = await fs.readFile(logFilePath, "utf8");
		if (logFileContents.trim()) {
			logData = JSON.parse(logFileContents);
		}
	} catch (error) {
		if (error.code !== "ENOENT") {
			throw error; // Rethrow if error is not related to file non-existence
		}
		console.log("Log file not found, creating a new one.");
	}

	const newEntry = {
		position,
		evaluation: evaluation,
	};

	logData.push(newEntry);
	await fs.writeFile(logFilePath, JSON.stringify(logData, null, 2), "utf8");
	console.log(
		`GPTA evaluation result logged successfully for position ${position}`
	);
}

// Main function to handle GPTA evaluation
async function main(position, modelName) {
	// Changed the function name to 'main'
	try {
		const { news, gptaLogEntries, gptbLogEntry, gptbEvalEntry } =
			await fetchData(position);

		// Iterate over multiple GPTA log entries
		for (const gptaLogEntry of gptaLogEntries) {
			const evaluation = await evaluateGPTA(
				gptaLogEntry,
				gptbLogEntry,
				gptbEvalEntry,
				modelName // Pass modelName to evaluation function
			);
			await logGPTAEvaluation(position, evaluation);
		}

		console.log(`GPTA evaluation completed for position ${position}`);
	} catch (error) {
		console.error("Error during GPTA evaluation:", error.message);
	}
}

module.exports = { main }; // Export 'main'

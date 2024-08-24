// File: src/adaptors/gptb-adaptor.js

// Import necessary libraries
const { OpenAI } = require("openai");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config({
	path: path.resolve(__dirname, "../../config/.env"),
});
const ProgressBar = require("progress");

// Configuration using GPTB's specific API key from the .env file
const openai = new OpenAI({
	apiKey: process.env.GPTB_API_KEY,
});

// Function to load the planner file and find the corresponding daily entry for a given position
const getDailyForPosition = async (position) => {
	console.log(
		`Loading planner file to find daily entry for position ${position}...`
	);
	const plannerPath = path.resolve(
		__dirname,
		"../../data/planner/planner.json"
	);
	const plannerData = JSON.parse(await fs.readFile(plannerPath, "utf8"));
	const entry = plannerData.find((item) => item.position === position);

	if (!entry || !entry.daily) {
		throw new Error(`No daily entry found for position ${position}`);
	}

	console.log(`Found daily entry for position ${position}: ${entry.daily}`);
	return entry.daily;
};

// Function to fetch stock price data for a given day from daily_SPY.json
const fetchStockPriceData = async (day) => {
	console.log(`Fetching stock price data for ${day}...`);
	const stockPath = path.resolve(
		__dirname,
		"../../data/stock/daily_SPY.json"
	);
	const stockData = JSON.parse(await fs.readFile(stockPath, "utf8"));

	const dailyData = stockData["Time Series (Daily)"][day];
	if (!dailyData) {
		throw new Error(`Stock price data for ${day} not found`);
	}

	console.log(`Fetched stock price data for ${day}`);
	return dailyData;
};

// Function to fetch sentiment analysis from gpta.logs.json for a given position
const fetchSentimentAnalysis = async (position) => {
	console.log(`Fetching sentiment analysis for position ${position}...`);
	const logPath = path.resolve(__dirname, "../../data/logs/gpta.logs.json");
	const logData = JSON.parse(await fs.readFile(logPath, "utf8"));

	const filteredLogs = logData.filter((entry) => entry.position === position);

	if (filteredLogs.length === 0) {
		throw new Error(`No GPTA logs found for position ${position}`);
	}

	const sentimentAnalysis = filteredLogs.map((entry) => ({
		sentimentAnalysis: entry.data["sentiment analysis"],
		currentDay: entry["current day"],
	}));

	console.log(`Fetched sentiment analysis for position ${position}`);
	return sentimentAnalysis;
};

// Function to analyze how sentiment and stock prices affected market trends
const analyzeImpactOnStockPrices = async (
	sentimentAnalysis,
	stockPrices,
	day
) => {
	console.log(`Analyzing impact on stock prices for ${day}...`);

	const prompt = `Utilise the following data to conduct a comprehensive analysis of how these factors might influence stock price movements for ${day}. Focus on the sentiment analysis and the corresponding stock price data. Your analysis should cover the following aspects in detail:

1. **Relevance to Stock Prices**: Identify and explain the direct relevance of the sentiment to stock market trends.

2. **Sentiment Influence**: Analyse how the sentiment (positive, negative, neutral) correlates with observed or potential stock price movements.

3. **Causative Links**: Establish and explain any causative links between the news sentiment and stock price fluctuations.

4. **Comparative Analysis**: Compare the impact of the current day's sentiment with data from previous days.

5. **Potential Anomalies or Exceptions**: Identify and explain any anomalies where the expected impact of sentiment did not align with actual stock price movements.

Provide a detailed and structured analysis, incorporating quantitative and qualitative insights to support your conclusions.`;

	const combinedData = JSON.stringify({
		sentimentAnalysis,
		stockPrices,
	});

	const completion = await openai.chat.completions.create({
		model: "gpt-4o",
		messages: [
			{ role: "system", content: prompt },
			{ role: "user", content: combinedData },
		],
	});

	if (!completion || !completion.choices || completion.choices.length === 0) {
		throw new Error("Invalid response structure from API.");
	}

	const analysisResult = completion.choices[0].message.content.trim();

	console.log("Completed analysis of impact on stock prices.");
	return analysisResult;
};

// Function to log analysis results to gptb.logs.json
const logAnalysisResults = async (position, day, analysis) => {
	console.log(
		`Logging analysis results for position ${position}, day ${day}...`
	);
	const logPath = path.resolve(__dirname, "../../data/logs/gptb.logs.json");

	// Read existing log data
	let logData = [];
	try {
		const logFileContents = await fs.readFile(logPath, "utf8");
		if (logFileContents.trim()) {
			logData = JSON.parse(logFileContents);
		} else {
			console.log("Log file is empty, starting with a new log file.");
		}
	} catch (error) {
		if (error.code === "ENOENT") {
			console.log("Log file not found, creating a new one.");
		} else if (error instanceof SyntaxError) {
			console.error(
				"Log file is malformed, starting with a new log file."
			);
		} else {
			throw error;
		}
	}

	// Append the new log entry
	logData.push({
		position: position,
		"current day": day,
		data: {
			analysis,
		},
	});

	// Write the updated log data back to the file
	await fs.writeFile(logPath, JSON.stringify(logData, null, 2), {
		encoding: "utf8",
	});
	console.log(
		`Analysis results logged successfully for position ${position}, day ${day}.`
	);
};

// Function to predict future stock prices based on the analysis
const predictStockPrices = async (analysis, currentDay) => {
	const nextDay = `day${parseInt(currentDay.replace("day", "")) + 1}`;
	console.log(`Predicting stock prices for ${nextDay}...`);

	const prompt = `Using the analysis of sentiment impact and market sentiment from ${currentDay}, forecast the stock prices for ${nextDay}. Please provide the prediction in the following format:

Prediction:
- Direction: Raise or Fall?
- Amount: Specify the expected percentage change (e.g., 5%, 1%, 0.5%)
- Confidence: Express the confidence level of this prediction as a percentage (0-100%).

Reasoning: Provide a concise explanation for the prediction, including relevant factors such as market trends, sentiment shifts, historical data, and any anomalies observed.

Ensure that the prediction is quantitative, precise, and includes a clear confidence level that reflects how certain the model is in its forecast. The prediction must be actionable and suitable for further validation and fine-tuning.`;

	const completion = await openai.chat.completions.create({
		model: "gpt-4o",
		messages: [
			{ role: "system", content: prompt },
			{ role: "user", content: analysis },
		],
	});

	if (!completion || !completion.choices || completion.choices.length === 0) {
		throw new Error("Invalid response structure from API.");
	}

	const prediction = completion.choices[0].message.content.trim();
	console.log(`Stock price prediction for ${nextDay} completed.`);
	return prediction;
};

// Function to log prediction results to gptb.logs.json
const logPredictionResults = async (position, day, prediction) => {
	console.log(
		`Logging prediction results for position ${position}, day ${day}...`
	);
	const logPath = path.resolve(__dirname, "../../data/logs/gptb.logs.json");

	// Read existing log data
	let logData = [];
	try {
		const logFileContents = await fs.readFile(logPath, "utf8");
		if (logFileContents.trim()) {
			logData = JSON.parse(logFileContents);
		} else {
			console.log("Log file is empty, starting with a new log file.");
		}
	} catch (error) {
		if (error.code === "ENOENT") {
			console.log("Log file not found, creating a new one.");
		} else if (error instanceof SyntaxError) {
			console.error(
				"Log file is malformed, starting with a new log file."
			);
		} else {
			throw error;
		}
	}

	// Find the entry for the current day and update it with the prediction
	const entryIndex = logData.findIndex(
		(entry) => entry.position === position && entry["current day"] === day
	);

	if (entryIndex !== -1) {
		logData[entryIndex].data.prediction = prediction;
	} else {
		logData.push({
			position: position,
			"current day": day,
			data: {
				prediction,
			},
		});
	}

	// Write the updated log data back to the file
	await fs.writeFile(logPath, JSON.stringify(logData, null, 2), {
		encoding: "utf8",
	});
	console.log(
		`Prediction results logged successfully for position ${position}, day ${day}.`
	);
};

// Function to handle the entire GPTB processing
const gptb = async (position) => {
	try {
		console.log(`Starting GPTB processing for position ${position}...`);

		const day = await getDailyForPosition(position);
		const stockPrices = await fetchStockPriceData(day);
		const sentimentAnalysis = await fetchSentimentAnalysis(position);

		const analysis = await analyzeImpactOnStockPrices(
			sentimentAnalysis,
			stockPrices,
			day
		);
		await logAnalysisResults(position, day, analysis);

		const prediction = await predictStockPrices(analysis, day);
		await logPredictionResults(position, day, prediction);

		console.log(`GPTB processing completed for position ${position}.`);
	} catch (error) {
		console.error(`Error in GPTB for position ${position}:`, error);
		throw error;
	}
};

// Export the gptb function so it can be used in other files
module.exports = {
	gptb,
};
